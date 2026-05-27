"""Chatbot CRUD + public widget config endpoints.

Owners (authenticated users) manage their chatbots via /v1/chatbots.
Embedded widgets fetch their rendering config via /v1/public/chatbots/{public_id}.
"""
from __future__ import annotations

import os
import uuid
from typing import Any
from typing import Dict
from typing import List
from typing import Optional

from api.helpers.dependencies.database import get_db_session
from api.helpers.dependencies.shared_auth import CurrentUser
from api.helpers.dependencies.shared_auth import get_manager_user
from api.helpers.exception_handler import ExceptionHandler
from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status
from joint.logging import get_logger
from joint.postgres.database import Chatbot as ChatbotSchema
from joint.postgres.database import ChatbotController
from joint.postgres.database import ChatbotForm
from joint.postgres.database import ChatbotPurpose
from pydantic import BaseModel
from pydantic import Field
from pydantic import field_validator
from sqlalchemy.orm import Session

logger = get_logger(__name__)

router = APIRouter()
public_router = APIRouter()

_controller = ChatbotController()


# ────────────────────────────────────────────────────────────────────
# Request / response models
# ────────────────────────────────────────────────────────────────────

class FAQ(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    answer: str = Field(..., min_length=1, max_length=4000)


class CollectionBinding(BaseModel):
    collection_id: uuid.UUID
    collection_name: str = Field(..., min_length=1, max_length=255)


class ChatbotMutate(BaseModel):
    """Shared payload for create/update."""
    name: str = Field(..., min_length=1, max_length=255)
    purpose: str = Field(default=ChatbotPurpose.CUSTOMER_CARE.value)
    form: str = Field(default=ChatbotForm.CHAT.value)
    description: Optional[str] = Field(default=None, max_length=2000)
    system_prompt: Optional[str] = Field(default=None, max_length=8000)
    faqs: Optional[List[FAQ]] = None
    collections: List[CollectionBinding] = Field(default_factory=list)
    llm_provider: Optional[str] = None
    embedding_provider: Optional[str] = None
    welcome_message: Optional[str] = Field(default=None, max_length=500)
    widget_theme: Optional[Dict[str, Any]] = None
    is_active: bool = True

    @field_validator('purpose')
    @classmethod
    def _validate_purpose(cls, v: str) -> str:
        try:
            ChatbotPurpose(v)
        except ValueError:
            raise ValueError(
                f'purpose must be one of: {[p.value for p in ChatbotPurpose]}',
            )
        return v

    @field_validator('form')
    @classmethod
    def _validate_form(cls, v: str) -> str:
        try:
            ChatbotForm(v)
        except ValueError:
            raise ValueError(
                f'form must be one of: {[f.value for f in ChatbotForm]}',
            )
        return v


class ChatbotOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    purpose: str
    form: str
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    faqs: Optional[List[Dict[str, Any]]] = None
    collections: List[CollectionBinding] = Field(default_factory=list)
    llm_provider: Optional[str] = None
    embedding_provider: Optional[str] = None
    welcome_message: Optional[str] = None
    widget_theme: Optional[Dict[str, Any]] = None
    public_id: uuid.UUID
    is_active: bool
    is_widget_active: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ChatbotPublicOut(BaseModel):
    """Public-safe subset returned to the embed widget (no prompts/faqs/collections)."""
    public_id: uuid.UUID
    name: str
    form: str
    welcome_message: Optional[str] = None
    widget_theme: Optional[Dict[str, Any]] = None
    is_active: bool


class EmbedSnippetOut(BaseModel):
    public_id: uuid.UUID
    snippet: str


# ────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────

def _to_out(chatbot: ChatbotSchema, collections: List[CollectionBinding]) -> ChatbotOut:
    data = chatbot.model_dump()
    return ChatbotOut(
        id=chatbot.id,
        user_id=chatbot.user_id,
        name=chatbot.name,
        purpose=chatbot.purpose,
        form=chatbot.form,
        description=chatbot.description,
        system_prompt=chatbot.system_prompt,
        faqs=chatbot.faqs,
        collections=collections,
        llm_provider=chatbot.llm_provider,
        embedding_provider=chatbot.embedding_provider,
        welcome_message=chatbot.welcome_message,
        widget_theme=chatbot.widget_theme,
        public_id=chatbot.public_id,
        is_active=chatbot.is_active,
        is_widget_active=getattr(chatbot, 'is_widget_active', False),
        created_at=data.get('created_at'),
        updated_at=data.get('updated_at'),
    )


def _load_with_collections(
    db: Session, chatbot_id: uuid.UUID,
) -> tuple[ChatbotSchema, List[CollectionBinding]]:
    bot = _controller.get_by_id(db, chatbot_id)
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Chatbot not found',
        )
    rows = _controller.list_collections(db, chatbot_id)
    bindings = [
        CollectionBinding(collection_id=cid, collection_name=cname)
        for cid, cname in rows
    ]
    return bot, bindings


def _ensure_owner(bot: ChatbotSchema, current_user: CurrentUser) -> None:
    if bot.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='You do not own this chatbot',
        )


# ────────────────────────────────────────────────────────────────────
# Authenticated CRUD
# ────────────────────────────────────────────────────────────────────

@router.get('/chatbots', response_model=List[ChatbotOut])
def list_chatbots(
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """List all chatbots owned by the current user."""
    bots = _controller.list_for_user(db, current_user.user_id)
    out: List[ChatbotOut] = []
    for bot in bots:
        rows = _controller.list_collections(db, bot.id)
        bindings = [
            CollectionBinding(collection_id=cid, collection_name=cname)
            for cid, cname in rows
        ]
        out.append(_to_out(bot, bindings))
    return out


@router.post(
    '/chatbots',
    response_model=ChatbotOut,
    status_code=status.HTTP_201_CREATED,
)
def create_chatbot(
    payload: ChatbotMutate,
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """Create a new chatbot for the current user."""
    schema = ChatbotSchema(
        user_id=current_user.user_id,
        name=payload.name,
        purpose=payload.purpose,
        form=payload.form,
        description=payload.description,
        system_prompt=payload.system_prompt,
        faqs=[f.model_dump() for f in payload.faqs] if payload.faqs else None,
        llm_provider=payload.llm_provider,
        embedding_provider=payload.embedding_provider,
        welcome_message=payload.welcome_message,
        widget_theme=payload.widget_theme,
        is_active=payload.is_active,
    )
    saved = _controller.insert(db, schema)
    if payload.collections:
        _controller.replace_collections(
            db, saved.id,
            [(c.collection_id, c.collection_name) for c in payload.collections],
        )
    rows = _controller.list_collections(db, saved.id)
    bindings = [
        CollectionBinding(collection_id=cid, collection_name=cname)
        for cid, cname in rows
    ]
    return _to_out(saved, bindings)


@router.get('/chatbots/applied', response_model=Optional[ChatbotOut])
def get_applied_chatbot(
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """Return the chatbot currently marked as widget-active for this user.

    Used by the in-house FE_Native site to know which bot to render in the
    embedded widget. Returns ``null`` when the user hasn't applied any bot.
    """
    bot = _controller.get_widget_active(db, current_user.user_id)
    if not bot:
        return None
    rows = _controller.list_collections(db, bot.id)
    bindings = [
        CollectionBinding(collection_id=cid, collection_name=cname)
        for cid, cname in rows
    ]
    return _to_out(bot, bindings)


@router.post(
    '/chatbots/{chatbot_id}/apply',
    response_model=ChatbotOut,
)
def apply_chatbot(
    chatbot_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """Mark this chatbot as the widget-active one for the current user.

    Any previously-active chatbot of the same user is automatically
    deactivated in the same transaction (one-active-at-a-time).
    """
    bot = _controller.set_widget_active(db, current_user.user_id, chatbot_id)
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Chatbot not found or you do not own it',
        )
    rows = _controller.list_collections(db, bot.id)
    bindings = [
        CollectionBinding(collection_id=cid, collection_name=cname)
        for cid, cname in rows
    ]
    return _to_out(bot, bindings)


@router.get('/chatbots/{chatbot_id}', response_model=ChatbotOut)
def get_chatbot(
    chatbot_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    bot, bindings = _load_with_collections(db, chatbot_id)
    _ensure_owner(bot, current_user)
    return _to_out(bot, bindings)


@router.put('/chatbots/{chatbot_id}', response_model=ChatbotOut)
def update_chatbot(
    chatbot_id: uuid.UUID,
    payload: ChatbotMutate,
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    bot, _ = _load_with_collections(db, chatbot_id)
    _ensure_owner(bot, current_user)

    updated = ChatbotSchema(
        id=bot.id,
        user_id=bot.user_id,
        name=payload.name,
        purpose=payload.purpose,
        form=payload.form,
        description=payload.description,
        system_prompt=payload.system_prompt,
        faqs=[f.model_dump() for f in payload.faqs] if payload.faqs else None,
        llm_provider=payload.llm_provider,
        embedding_provider=payload.embedding_provider,
        welcome_message=payload.welcome_message,
        widget_theme=payload.widget_theme,
        public_id=bot.public_id,
        is_active=payload.is_active,
    )
    result = _controller.update(db, updated)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Chatbot disappeared during update',
        )
    _controller.replace_collections(
        db, chatbot_id,
        [(c.collection_id, c.collection_name) for c in payload.collections],
    )
    rows = _controller.list_collections(db, chatbot_id)
    bindings = [
        CollectionBinding(collection_id=cid, collection_name=cname)
        for cid, cname in rows
    ]
    return _to_out(result, bindings)


@router.delete(
    '/chatbots/{chatbot_id}',
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_chatbot(
    chatbot_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    bot, _ = _load_with_collections(db, chatbot_id)
    _ensure_owner(bot, current_user)
    _controller.delete(db, chatbot_id)
    return None


@router.post(
    '/chatbots/{chatbot_id}/rotate-public-id',
    response_model=ChatbotOut,
)
def rotate_public_id(
    chatbot_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """Generate a fresh public_id for embed (invalidates older embed snippets)."""
    bot, bindings = _load_with_collections(db, chatbot_id)
    _ensure_owner(bot, current_user)

    bot.public_id = uuid.uuid4()
    result = _controller.update(db, bot)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Failed to rotate public_id',
        )
    return _to_out(result, bindings)


@router.get(
    '/chatbots/{chatbot_id}/embed-snippet',
    response_model=EmbedSnippetOut,
)
def get_embed_snippet(
    chatbot_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_manager_user),
    db: Session = Depends(get_db_session),
):
    """Render the embeddable JS snippet for this chatbot.

    The snippet uses a relative URL so it works on whatever origin
    serves the SDK (FE nginx in our docker stack proxies /dist and /v1).
    """
    bot, _ = _load_with_collections(db, chatbot_id)
    _ensure_owner(bot, current_user)
    base_url = os.getenv('EMBED_BASE_URL', '').rstrip('/')
    if not base_url:
        # Fallback: relative URL — only works when embedding on the same origin
        # that serves the SDK. Set EMBED_BASE_URL to use absolute URLs.
        sdk_src = '/dist/sdk.js'
        init_args = f'{{ chatbotId: "{bot.public_id}" }}'
    else:
        sdk_src = f'{base_url}/dist/sdk.js'
        init_args = f'{{ chatbotId: "{bot.public_id}", apiUrl: "{base_url}" }}'

    # The SDK exposes ``window.FoxAI`` and auto-initialises with default
    # config when ``window.foxaiAsyncInit`` is NOT defined. To pin the
    # widget to this specific chatbot:
    #   1. Define ``foxaiAsyncInit`` BEFORE the SDK loads — that suppresses
    #      auto-init with defaults.
    #   2. Inside it, call ``FoxAI.init`` with the chatbot's ``chatbotId``.
    # Without step 1, the default "FoxAI Native" widget would render first.
    snippet = (
        f'<script>\n'
        f'  window.foxaiAsyncInit = function () {{\n'
        f'    window.FoxAI.init({init_args});\n'
        f'  }};\n'
        f'</script>\n'
        f'<script src="{sdk_src}" async></script>'
    )
    return EmbedSnippetOut(public_id=bot.public_id, snippet=snippet)


# ────────────────────────────────────────────────────────────────────
# Public (no auth) — used by the embedded widget
# ────────────────────────────────────────────────────────────────────

@public_router.get(
    '/chatbots/{public_id}',
    response_model=ChatbotPublicOut,
)
def get_public_chatbot(
    public_id: uuid.UUID,
    db: Session = Depends(get_db_session),
):
    """Public chatbot config — used by the embed widget to render itself."""
    bot = _controller.get_by_public_id(db, public_id)
    if not bot or not bot.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Chatbot not found or inactive',
        )
    return ChatbotPublicOut(
        public_id=bot.public_id,
        name=bot.name,
        form=bot.form,
        welcome_message=bot.welcome_message,
        widget_theme=bot.widget_theme,
        is_active=bot.is_active,
    )
