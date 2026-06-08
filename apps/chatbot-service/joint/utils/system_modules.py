"""Mirror chatbots as permission *modules* in system-service.

When a chatbot is created / renamed / deleted, we create the matching permission
*module* under the ``CHATBOT_AI`` group in system-service so the bot shows up as
a row in the role-permission matrix. Calls go through the API gateway and
forward the acting user's bearer token (system-service enforces ``ROLE_CONFIG``).

Everything here is **best-effort**: any failure (network, or the creator lacking
ROLE_CONFIG permission) is logged and never breaks chatbot CRUD.
"""
from __future__ import annotations

import os
import uuid
from typing import Optional

import httpx
from joint.logging import get_logger

logger = get_logger(__name__)

# The modules REST API is only reachable through the gateway (system-service's
# direct port exposes gRPC). Override via env if the topology changes.
_GATEWAY_BASE = os.getenv('SYSTEM_API_BASE_URL', 'http://api-gateway:3001')
_GROUP_CODE = os.getenv('CHATBOT_MODULE_GROUP_CODE', 'CHATBOT_AI')
_TIMEOUT = 8.0


def module_code(chatbot_id: uuid.UUID | str) -> str:
    """Stable, unique module code derived from the chatbot id (immutable)."""
    raw = (
        chatbot_id.hex if isinstance(chatbot_id, uuid.UUID)
        else str(chatbot_id).replace('-', '')
    )
    return f'CHATBOT_{raw}'.upper()


def _headers(authorization: Optional[str]) -> dict:
    return {'Authorization': authorization} if authorization else {}


def _chatbot_group(client: httpx.Client, headers: dict) -> Optional[dict]:
    """Return the CHATBOT_AI module-group dict (includes its current modules)."""
    resp = client.get(f'{_GATEWAY_BASE}/api/module-groups', headers=headers)
    if resp.status_code != 200:
        logger.warning(f'module-groups lookup -> {resp.status_code}')
        return None
    for group in resp.json().get('items', []):
        if group.get('code') == _GROUP_CODE:
            return group
    logger.warning(f"module group '{_GROUP_CODE}' not found")
    return None


def _find_module_id(
    client: httpx.Client, headers: dict, code: str,
) -> Optional[str]:
    resp = client.get(f'{_GATEWAY_BASE}/api/modules', headers=headers)
    if resp.status_code != 200:
        return None
    for module in resp.json().get('items', []):
        if module.get('code') == code:
            return module.get('id')
    return None


def register_chatbot_module(
    chatbot_id: uuid.UUID | str, name: str, authorization: Optional[str],
) -> None:
    """Create the permission module for a chatbot (best-effort, idempotent)."""
    code = module_code(chatbot_id)
    headers = _headers(authorization)
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            group = _chatbot_group(client, headers)
            if not group:
                return
            # Append after the group's existing modules.
            sort_order = max(
                (m.get('sortOrder', 0) for m in group.get('modules', [])),
                default=0,
            ) + 1
            resp = client.post(
                f'{_GATEWAY_BASE}/api/modules',
                headers=headers,
                json={
                    'groupId': group.get('id'),
                    'code': code,
                    'name': name,
                    'sortOrder': sort_order,
                },
            )
            if resp.status_code in (200, 201):
                logger.info(f'Registered chatbot module {code}')
            elif resp.status_code == 409 or 'exist' in resp.text.lower():
                logger.info(f'Chatbot module {code} already exists')
            else:
                logger.warning(
                    f'Register module {code} -> {resp.status_code} '
                    f'{resp.text[:120]}',
                )
    except Exception as e:
        logger.warning(f'Register chatbot module failed (non-fatal): {e}')


def rename_chatbot_module(
    chatbot_id: uuid.UUID | str, name: str, authorization: Optional[str],
) -> None:
    """Update the module name when a chatbot is renamed (best-effort)."""
    code = module_code(chatbot_id)
    headers = _headers(authorization)
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            module_id = _find_module_id(client, headers, code)
            if not module_id:
                # Never registered (e.g. created by a non-privileged user) →
                # try to create it now.
                register_chatbot_module(chatbot_id, name, authorization)
                return
            resp = client.patch(
                f'{_GATEWAY_BASE}/api/modules/{module_id}',
                headers=headers,
                json={'name': name},
            )
            if resp.status_code != 200:
                logger.warning(f'Rename module {code} -> {resp.status_code}')
    except Exception as e:
        logger.warning(f'Rename chatbot module failed (non-fatal): {e}')


def delete_chatbot_module(
    chatbot_id: uuid.UUID | str, authorization: Optional[str],
) -> None:
    """Remove the permission module when a chatbot is deleted (best-effort)."""
    code = module_code(chatbot_id)
    headers = _headers(authorization)
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            module_id = _find_module_id(client, headers, code)
            if not module_id:
                return
            resp = client.delete(
                f'{_GATEWAY_BASE}/api/modules/{module_id}', headers=headers,
            )
            if resp.status_code not in (200, 204):
                logger.warning(f'Delete module {code} -> {resp.status_code}')
    except Exception as e:
        logger.warning(f'Delete chatbot module failed (non-fatal): {e}')
