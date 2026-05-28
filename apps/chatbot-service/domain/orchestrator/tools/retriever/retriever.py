from __future__ import annotations

import asyncio
from functools import partial
from typing import Any
from typing import Dict
from typing import List
from typing import Optional

from domain.storage_services import QdrantService
from infrastructure.embedding import BaseEmbeddingInput
from infrastructure.embedding import EmbeddingService
from joint.base import BaseModel
from joint.base import BaseService
from joint.logging import get_logger
from joint.settings.settings import Settings
from langchain.schema import Document
from langchain_community.retrievers import BM25Retriever
from langchain_qdrant import QdrantVectorStore
from qdrant_client import models

# Type alias for MetadataFilter
MetadataFilter = Dict[str, Any]

logger = get_logger(__name__)


class RetrieverInput(BaseModel):
    """
    Input model for the RetrieverService with section-aware parameters.
    """
    query: str
    document_name_filter: Optional[List[str]] = None
    # "balanced" | "section_focused" | "diversity"
    retrieval_mode: Optional[str] = 'balanced'
    expand_by_section: Optional[bool] = False
    section_keywords: Optional[List[str]] = None
    max_chunks: Optional[int] = 8


class RetrieverOutput(BaseModel):
    """
    Output model for the RetrieverService, containing a list of retrieved documents.
    """
    documents: List[Document]


class RetrieverService(BaseService):
    """
    Service responsible for retrieving relevant documents based on a user's query.
    It uses cosine similarity and MMR retrieval from vector database,
    then reranks with BM25, and finally combines using RRF algorithm.

    Supports retrieval across multiple Qdrant collections — results from
    every bound collection are concatenated before reranking.
    """
    settings: Settings
    provider_storage: str
    provider_embedding: str
    # List of Qdrant collection names. A chatbot may bind several collections;
    # this service fans the query out and merges results.
    collection_names: List[str]

    @property
    def collection_name(self) -> str:
        """Primary collection name — used for logging/error messages only."""
        return self.collection_names[0] if self.collection_names else ''

    @property
    def embedding_service(self) -> EmbeddingService:
        """ Returns the embedding service instance for processing embeddings.
        Returns:
            EmbeddingService: An instance of the embedding service.
        """
        return EmbeddingService(settings=self.settings)

    @property
    def qdrant_service(self) -> QdrantService:
        """ Returns the Qdrant service instance for interacting with the Qdrant database.
        Returns:
            QdrantService: An instance of the Qdrant service.
        """
        return QdrantService(
            settings=self.settings,
            provider_storage=self.provider_storage,
            provider_embedding=self.provider_embedding,
        )

    @property
    def embedding_client(self) -> Any:
        """ Returns the embedding client instance for processing embeddings.
        Returns:
            EmbeddingService: An instance of the embedding service.
        """
        embedding_input = BaseEmbeddingInput(
            provider_name=self.provider_embedding,
        )
        return self.embedding_service.process(embedding_input)

    async def _get_vector_stores(self) -> List[QdrantVectorStore]:
        """Return one QdrantVectorStore per bound collection.

        Returns:
            List of configured vector stores, in the same order as
            ``self.collection_names``.
        """
        if not self.collection_names:
            return []
        stores = await asyncio.gather(*[
            self.qdrant_service.initial_vectorstore(name)
            for name in self.collection_names
        ])
        return list(stores)

    def build_qdrant_filter(self, document_names: List[str]) -> Any:
        """
        Build Qdrant filter for multiple document names.

        Args:
            document_names (List[str]): List of document names to filter by

        Returns:
            Qdrant filter object for filtering by document names
        """
        try:
            if not document_names:
                return None

            # Create conditions for each document name
            conditions = []
            for doc_name in document_names:
                conditions.append(
                    models.FieldCondition(
                        key='metadata.document_name',
                        match=models.MatchText(text=doc_name),
                    ),
                )

            # Use should (OR) to match any of the document names
            qdrant_filter = models.Filter(should=conditions)
            logger.info(
                f'Built filter for {len(document_names)} document names: {document_names}',
            )
            return qdrant_filter

        except Exception as e:
            logger.error(f'Error building Qdrant filter: {str(e)}')
            return None

    async def get_filtered_documents(self, document_name_filter: List[str] | None = None, k: int = 100) -> List[Document]:
        """
        Get documents from vector store with optional document name filtering.

        Args:
            document_name_filter (List[str], optional): List of document names to filter by
            k (int): Number of documents to retrieve per bound collection

        Returns:
            List[Document]: Filtered documents from all bound collections
        """
        try:
            vector_stores = await self._get_vector_stores()
            if not vector_stores:
                return []
            qdrant_filter = None
            if document_name_filter:
                qdrant_filter = self.build_qdrant_filter(document_name_filter)

            async def _search(store):
                if qdrant_filter:
                    return await store.asimilarity_search(
                        '', k=k, score_threshold=0.0, filter=qdrant_filter,
                    )
                return await store.asimilarity_search(
                    '', k=k, score_threshold=0.0,
                )

            results = await asyncio.gather(
                *[_search(s) for s in vector_stores],
                return_exceptions=True,
            )

            documents: List[Document] = []
            for result in results:
                if isinstance(result, Exception):
                    logger.warning(f'Per-collection search failed: {result}')
                    continue
                documents.extend(
                    Document(page_content=d.page_content, metadata=d.metadata)
                    for d in result
                )

            logger.info(
                f'Retrieved {len(documents)} documents from '
                f'{len(vector_stores)} collection(s)'
                + (f' with filter: {document_name_filter}' if document_name_filter else ''),
            )
            return documents

        except Exception as e:
            logger.error(f'Error retrieving filtered documents: {str(e)}')
            return []

    async def get_cosine_documents(
        self, query: str, k: int = 10, score_threshold: float = 0.5,
        document_name_filter: List[str] | None = None,
    ) -> List[Document]:
        """
        Retrieve documents using cosine similarity search with optional filtering.
        Fans out across all bound collections; results are concatenated for RRF.
        """
        vector_stores = await self._get_vector_stores()
        if not vector_stores:
            return []
        qdrant_filter = None
        if document_name_filter:
            qdrant_filter = self.build_qdrant_filter(document_name_filter)

        async def _search(store):
            try:
                kwargs = {'k': k, 'score_threshold': score_threshold}
                if qdrant_filter:
                    kwargs['filter'] = qdrant_filter
                docs = await store.asimilarity_search_with_score(query, **kwargs)
                return [d for d, _ in docs]
            except Exception as e:
                logger.warning(
                    f'Cosine per-collection search failed: {e}; trying fallback',
                )
                try:
                    if qdrant_filter:
                        return await store.asimilarity_search(query, k=k, filter=qdrant_filter)
                    return await store.asimilarity_search(query, k=k)
                except Exception:
                    return []

        results = await asyncio.gather(*[_search(s) for s in vector_stores])
        merged = [d for sub in results for d in sub]
        filter_info = f' with filter: {document_name_filter}' if document_name_filter else ''
        logger.info(
            f'Retrieved {len(merged)} documents using cosine similarity '
            f'(score_threshold: {score_threshold}, collections: {len(vector_stores)}){filter_info}',
        )
        return merged

    async def get_mmr_documents(
        self, query: str, k: int = 10, fetch_k: int = 20, lambda_mult: float = 0.5,
        score_threshold: float = 0.5, document_name_filter: List[str] | None = None,
    ) -> List[Document]:
        """MMR search across all bound collections, then concatenated."""
        vector_stores = await self._get_vector_stores()
        if not vector_stores:
            return []
        qdrant_filter = None
        if document_name_filter:
            qdrant_filter = self.build_qdrant_filter(document_name_filter)

        async def _search(store):
            try:
                kwargs = dict(
                    k=k, fetch_k=fetch_k, lambda_mult=lambda_mult,
                    score_threshold=score_threshold,
                )
                if qdrant_filter:
                    kwargs['filter'] = qdrant_filter
                return await store.amax_marginal_relevance_search(query, **kwargs)
            except Exception as e:
                logger.warning(f'MMR per-collection search failed: {e}; trying fallback')
                try:
                    kwargs = dict(k=k, fetch_k=fetch_k, lambda_mult=lambda_mult)
                    if qdrant_filter:
                        kwargs['filter'] = qdrant_filter
                    return await store.amax_marginal_relevance_search(query, **kwargs)
                except Exception:
                    return []

        results = await asyncio.gather(*[_search(s) for s in vector_stores])
        merged = [d for sub in results for d in sub]
        filter_info = f' with filter: {document_name_filter}' if document_name_filter else ''
        logger.info(
            f'Retrieved {len(merged)} documents using MMR (score_threshold: '
            f'{score_threshold}, collections: {len(vector_stores)}){filter_info}',
        )
        return merged

    def rerank_with_bm25(self, documents: List[Document], query: str, top_k: int = 5) -> List[Document]:
        """
        Rerank documents using BM25 algorithm.

        Args:
            documents (List[Document]): Documents to rerank
            query (str): The search query for ranking
            top_k (int): Number of top documents to return after reranking

        Returns:
            List[Document]: Reranked documents using BM25
        """
        try:
            if not documents:
                return []

            # Create BM25 retriever from documents
            bm25_retriever = BM25Retriever.from_documents(documents=documents)
            bm25_retriever.k = top_k

            # Get reranked documents
            reranked_docs = bm25_retriever.invoke(query)
            logger.info(f'Reranked {len(reranked_docs)} documents using BM25')
            return reranked_docs

        except Exception as e:
            logger.error(f'Error in BM25 reranking: {str(e)}')
            return documents[:top_k]  # Fallback to original order

    async def get_retriever_with_filter(self, document_name_filter: List[str] | None = None) -> BM25Retriever:
        """
        Initializes and returns a BM25 retriever with optional document_name filter.

        Args:
            document_name_filter (List[str], optional): List of document names to filter by.

        Returns:
            BM25Retriever: A BM25 retriever instance configured with filtered documents from the Qdrant store,
                           or a retriever containing a default error message document if initialization fails.
        """
        try:
            # Get filtered documents from vector store
            documents = await self.get_filtered_documents(
                document_name_filter, k=100,
            )

            if not documents:
                filter_info = f" with filter: {document_name_filter}" if document_name_filter else ''
                raise ValueError(
                    f"No documents found in collections {self.collection_names}{filter_info}",
                )

            bm25_retriever = BM25Retriever.from_documents(documents=documents)
            bm25_retriever.k = 4

            filter_info = f" with filter: {document_name_filter}" if document_name_filter else ''
            logger.info(
                f'BM25 Retriever initialized successfully! Found {len(documents)} documents{filter_info}',
            )
            return bm25_retriever

        except Exception as e:
            logger.error(
                f'Error during BM25 retriever initialization: {str(e)}',
            )
            default_doc = [
                Document(
                    page_content='An error occurred while connecting to the database. Please try again later.',
                    metadata={'source': 'error'},
                ),
            ]
            logger.info('BM25 Retriever initialization failed!')
            return BM25Retriever.from_documents(default_doc)

    def rrf_algorithm(self, docs_lists: List[List[Document]], rrf_k: int = 60) -> List[Document]:
        """
        Implements the Reciprocal Rank Fusion (RRF) algorithm to combine results from multiple retrievers.

        Args:
            docs_lists (List[List[Document]]): A list of document lists, where each inner list represents the
                                                 results from a single retriever.
            rrf_k (int): The RRF parameter 'k', which influences the weighting of documents based on their rank.
                           A higher value gives more weight to higher-ranked documents.  Defaults to 60.

        Returns:
            List[Document]: A single list of documents, ranked according to the RRF algorithm.
        """
        score_dict: dict[str, float] = {}
        doc_mapping: dict[str, Document] = {}
        for doc_list in docs_lists:
            for rank, doc in enumerate(doc_list, start=1):
                key = self.get_doc_key(doc)
                score = 1 / (rrf_k + rank)
                if key in score_dict:
                    score_dict[key] += score
                else:
                    score_dict[key] = score
                    doc_mapping[key] = doc
        sorted_keys = sorted(
            score_dict.items(),
            key=lambda x: x[1], reverse=True,
        )
        return [doc_mapping[key] for key, _ in sorted_keys]

    async def search_by_section_name(
        self,
        query: str,
        document_name_filter: List[str] | None = None,
        max_chunks: int = 15,
    ) -> List[Document]:
        """Section-name search fanned out across bound collections."""
        try:
            vector_stores = await self._get_vector_stores()
            if not vector_stores:
                return []
            conditions = [
                models.FieldCondition(
                    key='metadata.section_heading',
                    match=models.MatchText(text=query),
                ),
            ]
            if document_name_filter:
                doc_conditions = [
                    models.FieldCondition(
                        key='metadata.document_name',
                        match=models.MatchText(text=doc_name),
                    )
                    for doc_name in document_name_filter
                ]
                conditions.append(models.Filter(should=doc_conditions))
            qdrant_filter = models.Filter(must=conditions)

            async def _search(store):
                try:
                    return await store.asimilarity_search(
                        '', k=max_chunks, filter=qdrant_filter,
                    )
                except Exception as e:
                    logger.warning(f'Section-name per-collection search failed: {e}')
                    return []

            results = await asyncio.gather(*[_search(s) for s in vector_stores])
            documents = [d for sub in results for d in sub]
            sorted_docs = sorted(
                documents,
                key=lambda d: d.metadata.get('chunk_index', 0),
            )
            logger.info(
                f'Section name search found {len(sorted_docs)} chunks for query "{query}"',
            )
            return sorted_docs

        except Exception as e:
            logger.error(f'Error in section name search: {str(e)}')
            return []

    async def get_section_chunks(
        self,
        section_heading: str,
        document_name: str,
        document_name_filter: List[str] | None = None,
        max_chunks: int = 15,
    ) -> List[Document]:
        """Retrieve all chunks of a section across bound collections."""
        try:
            vector_stores = await self._get_vector_stores()
            if not vector_stores:
                return []
            conditions = [
                models.FieldCondition(
                    key='metadata.section_heading',
                    match=models.MatchText(text=section_heading),
                ),
                models.FieldCondition(
                    key='metadata.document_name',
                    match=models.MatchText(text=document_name),
                ),
            ]
            if document_name_filter:
                doc_conditions = [
                    models.FieldCondition(
                        key='metadata.document_name',
                        match=models.MatchText(text=doc_name),
                    )
                    for doc_name in document_name_filter
                ]
                conditions.append(models.Filter(should=doc_conditions))
            qdrant_filter = models.Filter(must=conditions)

            async def _search(store):
                try:
                    return await store.asimilarity_search(
                        '', k=max_chunks, filter=qdrant_filter,
                    )
                except Exception as e:
                    logger.warning(f'Section-chunks per-collection failed: {e}')
                    return []

            results = await asyncio.gather(*[_search(s) for s in vector_stores])
            documents = [d for sub in results for d in sub]
            sorted_docs = sorted(
                documents,
                key=lambda d: d.metadata.get('chunk_index', 0),
            )
            logger.info(
                f'Retrieved {len(sorted_docs)} chunks from section "{section_heading}" '
                f'in document "{document_name}"',
            )
            return sorted_docs

        except Exception as e:
            logger.error(f'Error retrieving section chunks: {str(e)}')
            return []

    def merge_section_chunks(self, chunks: List[Document]) -> List[Document]:
        """
        Merge chunks from the same section into single chunks.
        Preserves order within sections and merges metadata intelligently.

        Args:
            chunks: List of chunks to merge

        Returns:
            List of merged chunks grouped by section
        """
        if not chunks:
            return []

        try:
            section_groups: dict[tuple[str, str], list[Document]] = {}

            for chunk in chunks:
                section_heading = chunk.metadata.get(
                    'section_heading', 'unknown',
                )
                document_name = chunk.metadata.get('document_name', 'unknown')
                key = (section_heading, document_name)

                if key not in section_groups:
                    section_groups[key] = []
                section_groups[key].append(chunk)

            merged_chunks = []

            for (section_heading, document_name), group_chunks in section_groups.items():
                sorted_group = sorted(
                    group_chunks,
                    key=lambda d: d.metadata.get('chunk_index', 0),
                )

                merged_content = '\n\n'.join(
                    chunk.page_content for chunk in sorted_group
                )

                merged_metadata = sorted_group[0].metadata.copy()

                all_pages = set()
                all_chunk_ids = []
                all_chunk_indices = []

                for chunk in sorted_group:
                    page_number = chunk.metadata.get('page_number', [])
                    if isinstance(page_number, list):
                        all_pages.update(page_number)
                    elif isinstance(page_number, (int, float)):
                        all_pages.add(int(page_number))
                    all_chunk_ids.append(chunk.metadata.get('chunk_id', ''))
                    all_chunk_indices.append(
                        chunk.metadata.get('chunk_index', 0),
                    )

                merged_metadata['page_number'] = sorted(list(all_pages))
                merged_metadata['merged_chunk_ids'] = all_chunk_ids
                merged_metadata['chunk_index_range'] = f"{min(all_chunk_indices)}-{max(all_chunk_indices)}"
                merged_metadata['merged_count'] = len(sorted_group)

                merged_doc = Document(
                    page_content=merged_content,
                    metadata=merged_metadata,
                )
                merged_chunks.append(merged_doc)

            logger.info(
                f'Merged {len(chunks)} chunks into {len(merged_chunks)} section chunks '
                f'({len(chunks) - len(merged_chunks)} chunks consolidated)',
            )

            return merged_chunks

        except Exception as e:
            logger.error(f'Error merging section chunks: {str(e)}')
            return chunks

    async def expand_by_section_heading(
        self,
        top_chunks: List[Document],
        query: str,
        section_keywords: List[str] | None = None,
        document_name_filter: List[str] | None = None,
        max_expansion: int = 5,
    ) -> List[Document]:
        """
        Expand top chunks by including related chunks from the same section.

        Args:
            top_chunks: Top chunks from RRF
            query: Original query for context
            section_keywords: Optional hints about target sections
            document_name_filter: Optional filter for document names
            max_expansion: Max additional chunks per section

        Returns:
            Expanded list of documents with section context
        """
        if not top_chunks:
            return []

        try:
            section_map: dict[tuple[str, str], list[Document]] = {}

            for chunk in top_chunks[:3]:
                section_heading = chunk.metadata.get('section_heading')
                document_name = chunk.metadata.get('document_name')

                if section_heading and document_name:
                    key = (section_heading, document_name)
                    if key not in section_map:
                        section_map[key] = []
                    section_map[key].append(chunk)

            priority_sections = []

            if section_keywords:
                for (section_heading, doc_name), chunks in section_map.items():
                    if any(kw.lower() in section_heading.lower() for kw in section_keywords):
                        priority_sections.append(
                            (section_heading, doc_name, len(chunks)),
                        )

            if not priority_sections:
                priority_sections = [
                    (sh, dn, len(chunks))
                    for (sh, dn), chunks in section_map.items()
                ]

            priority_sections.sort(key=lambda x: x[2], reverse=True)

            expanded_docs = list(top_chunks)
            existing_chunk_ids = {
                chunk.metadata.get('chunk_id')
                for chunk in top_chunks
            }

            for section_heading, document_name, _ in priority_sections[:2]:
                logger.info(
                    f'Attempting to expand section: "{section_heading}" in "{document_name}"',
                )
                section_chunks = await self.get_section_chunks(
                    section_heading=section_heading,
                    document_name=document_name,
                    document_name_filter=document_name_filter,
                    max_chunks=15,
                )

                logger.info(
                    f'Found {len(section_chunks)} total chunks in this section',
                )

                added_count = 0
                for chunk in section_chunks:
                    chunk_id = chunk.metadata.get('chunk_id')
                    if chunk_id not in existing_chunk_ids and added_count < max_expansion:
                        expanded_docs.append(chunk)
                        existing_chunk_ids.add(chunk_id)
                        added_count += 1

                logger.info(
                    f'Expanded with {added_count} new chunks from section "{section_heading}"',
                )

            merged_docs = self.merge_section_chunks(expanded_docs)

            logger.info(
                f'After merging: {len(expanded_docs)} chunks -> {len(merged_docs)} section-grouped chunks',
            )

            return merged_docs

        except Exception as e:
            logger.error(f'Error in section expansion: {str(e)}')
            return top_chunks

    async def search_by_text_match(
        self,
        query: str,
        document_name_filter: List[str] | None = None,
        max_chunks: int = 5,
    ) -> List[Document]:
        """Full-text match search across bound collections."""
        try:
            vector_stores = await self._get_vector_stores()
            if not vector_stores:
                return []
            clean_query = query.strip().rstrip('?!').strip()
            if not clean_query:
                return []

            conditions: list = [
                models.FieldCondition(
                    key='page_content',
                    match=models.MatchText(text=clean_query),
                ),
            ]
            if document_name_filter:
                doc_conditions = [
                    models.FieldCondition(
                        key='metadata.document_name',
                        match=models.MatchText(text=doc_name),
                    )
                    for doc_name in document_name_filter
                ]
                conditions.append(models.Filter(should=doc_conditions))
            qdrant_filter = models.Filter(must=conditions)

            async def _search(store):
                try:
                    return await store.asimilarity_search(
                        query, k=max_chunks, filter=qdrant_filter,
                    )
                except Exception as e:
                    logger.warning(f'Text-match per-collection failed: {e}')
                    return []

            results = await asyncio.gather(*[_search(s) for s in vector_stores])
            documents = [d for sub in results for d in sub]
            logger.info(f'Text match search found {len(documents)} chunks')
            return documents

        except Exception as e:
            logger.warning(f'Text match search unavailable: {e}')
            return []

    def adjust_retrieval_parameters(self, retrieval_mode: str) -> Dict[str, Any]:
        """Adjust retrieval parameters based on mode.

        Args:
            retrieval_mode: "balanced" | "section_focused" | "diversity"

        Returns:
            Dictionary of adjusted parameters.
        """
        params = {
            'balanced': {
                'cosine_k': 15,
                'mmr_k': 15,
                'mmr_lambda': 0.5,
                'bm25_top_k': 8,
                'final_k': 8,
                'score_threshold': 0.6,
                'text_match_k': 5,
            },
            'section_focused': {
                'cosine_k': 10,
                'mmr_k': 10,
                'mmr_lambda': 0.7,
                'bm25_top_k': 6,
                'final_k': 6,
                'score_threshold': 0.55,
                'text_match_k': 5,
            },
            'diversity': {
                'cosine_k': 20,
                'mmr_k': 20,
                'mmr_lambda': 0.3,
                'bm25_top_k': 10,
                'final_k': 10,
                'score_threshold': 0.6,
                'text_match_k': 5,
            },
        }
        return params.get(retrieval_mode, params['balanced'])

    def get_doc_key(self, doc: Document) -> str:
        """
        Generates a unique key for a Document object based on its content and metadata.

        Args:
            doc (Document): The Document object to generate a key for.

        Returns:
            str: A string key containing the document's page content and metadata items.
        """
        meta_items = tuple(
            sorted(
                (str(k), str(v))
                for k, v in doc.metadata.items()
            ),
        ) if doc.metadata else ()
        return str((doc.page_content, meta_items))

    async def process(self, input: RetrieverInput) -> RetrieverOutput:
        """
        Enhanced processing with section-aware retrieval.

        Flow:
        1. Adjust parameters based on retrieval_mode
        2. Standard retrieval: Cosine + MMR + Text Match -> BM25 -> RRF
        3. Section expansion (if enabled)
        4. Smart truncation to max_chunks

        Args:
            input: Enhanced RetrieverInput with section parameters.

        Returns:
            RetrieverOutput with optimized document set.
        """
        logger.info('---ROUTE RETRIEVER (SECTION-AWARE)---')
        query = input.query
        document_name_filter = input.document_name_filter
        retrieval_mode = input.retrieval_mode or 'balanced'
        expand_by_section = input.expand_by_section or False
        section_keywords = input.section_keywords
        max_chunks = input.max_chunks or 8

        logger.info(
            f'Mode: {retrieval_mode} | Expand: {expand_by_section} | '
            f'Keywords: {section_keywords} | Max chunks: {max_chunks}',
        )

        try:
            params = self.adjust_retrieval_parameters(retrieval_mode)

            logger.info(f'Retrieving with mode: {retrieval_mode}')

            section_docs = []
            if retrieval_mode == 'section_focused' and section_keywords:
                logger.info('Attempting section name search as fallback...')
                section_docs = await self.search_by_section_name(
                    query=query,
                    document_name_filter=document_name_filter,
                    max_chunks=10,
                )
                if section_docs:
                    logger.info(
                        f'Section name search found {len(section_docs)} chunks',
                    )

            # Run cosine, MMR, and text match searches concurrently
            cosine_docs, mmr_docs, text_match_docs = await asyncio.gather(
                self.get_cosine_documents(
                    query,
                    k=params['cosine_k'],
                    score_threshold=params['score_threshold'],
                    document_name_filter=document_name_filter,
                ),
                self.get_mmr_documents(
                    query,
                    k=params['mmr_k'],
                    fetch_k=params['mmr_k'] + 10,
                    lambda_mult=params['mmr_lambda'],
                    score_threshold=params['score_threshold'],
                    document_name_filter=document_name_filter,
                ),
                self.search_by_text_match(
                    query=query,
                    document_name_filter=document_name_filter,
                    max_chunks=params['text_match_k'],
                ),
            )

            # Run BM25 reranking concurrently in thread pool
            loop = asyncio.get_running_loop()
            cosine_reranked, mmr_reranked = await asyncio.gather(
                loop.run_in_executor(
                    None,
                    partial(self.rerank_with_bm25, cosine_docs, query, top_k=params['bm25_top_k']),
                ),
                loop.run_in_executor(
                    None,
                    partial(self.rerank_with_bm25, mmr_docs, query, top_k=params['bm25_top_k']),
                ),
            )

            docs_lists = [cosine_reranked, mmr_reranked]
            if text_match_docs:
                docs_lists.append(text_match_docs)
            if section_docs:
                docs_lists.append(section_docs)

            combined_docs = self.rrf_algorithm(docs_lists)

            if expand_by_section:
                logger.info('Expanding by section heading...')
                combined_docs = await self.expand_by_section_heading(
                    top_chunks=combined_docs[:params['final_k']],
                    query=query,
                    section_keywords=section_keywords,
                    document_name_filter=document_name_filter,
                    max_expansion=5,
                )

            final_docs = combined_docs[:max_chunks]

            logger.info(
                f'Retrieval completed! Returning {len(final_docs)} documents '
                f'(mode: {retrieval_mode}, expanded: {expand_by_section})',
            )

            return RetrieverOutput(documents=final_docs)

        except Exception as e:
            logger.error(f'Error in enhanced retrieval: {str(e)}')
            error_doc = Document(
                page_content='An error occurred while retrieving documents.',
                metadata={'source': 'error'},
            )
            return RetrieverOutput(documents=[error_doc])
