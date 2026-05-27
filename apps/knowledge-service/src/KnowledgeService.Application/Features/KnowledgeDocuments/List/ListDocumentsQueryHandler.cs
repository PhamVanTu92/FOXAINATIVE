using KnowledgeService.Application.Common.Abstractions;
using KnowledgeService.Application.Features.KnowledgeBases.List;
using KnowledgeService.Application.Features.KnowledgeDocuments.Dtos;
using Mapster;
using MediatR;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.List;

public class ListDocumentsQueryHandler : IRequestHandler<ListDocumentsQuery, PagedResult<KnowledgeDocumentDto>>
{
    private readonly IKnowledgeDocumentRepository _repo;

    public ListDocumentsQueryHandler(IKnowledgeDocumentRepository repo) => _repo = repo;

    public async Task<PagedResult<KnowledgeDocumentDto>> Handle(ListDocumentsQuery query, CancellationToken ct)
    {
        var (items, total) = await _repo.ListAsync(
            query.KnowledgeBaseId,
            string.IsNullOrEmpty(query.Status) ? null : query.Status,
            string.IsNullOrEmpty(query.Search) ? null : query.Search,
            query.Page, query.PageSize, ct);

        return new PagedResult<KnowledgeDocumentDto>
        {
            Items = items.Adapt<List<KnowledgeDocumentDto>>(),
            Total = total,
            Page = query.Page,
            PageSize = query.PageSize
        };
    }
}
