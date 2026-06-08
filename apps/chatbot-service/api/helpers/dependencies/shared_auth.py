"""
Shared Security Dependencies - Chatbot service authentication

The monorepo issues JWT tokens from the .NET ``system-service`` using HS256
with a shared secret read from ``JWT_SECRET``. This module verifies those
tokens — no Keycloak / JWKS fetch / asymmetric keys involved.

Flow: API Dependency → HS256 JWT Verification → CurrentUser
"""
from __future__ import annotations

import os
import uuid
from typing import Any
from typing import Dict
from typing import List

from fastapi import Depends
from fastapi import HTTPException
from fastapi import status
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.security import HTTPBearer
from joint.logging import get_logger
from jose import jwt
from jose import JWTError
from pydantic import BaseModel

logger = get_logger(__name__)

# Security scheme for FastAPI - extracts Bearer token from Authorization header
security_bearer = HTTPBearer()

# JWT verification config — populated lazily so missing env at import time
# doesn't crash the whole app boot (only chat endpoints actually need auth).
_JWT_ISSUER_DEFAULT = 'foxai-system-service'
_JWT_AUDIENCE_DEFAULT = 'foxai-platform'


def _get_jwt_config() -> Dict[str, str]:
    """Return the symmetric JWT settings shared with system-service.

    ``JWT_SECRET`` MUST match the value system-service uses to sign tokens
    (config key ``Jwt:Secret`` in appsettings or env var ``JWT_SECRET``).
    """
    secret = os.environ.get('JWT_SECRET')
    if not secret:
        raise ValueError(
            'JWT_SECRET is not configured — cannot verify tokens issued '
            'by system-service.',
        )
    return {
        'secret': secret,
        'issuer': os.environ.get('JWT_ISSUER', _JWT_ISSUER_DEFAULT),
        'audience': os.environ.get('JWT_AUDIENCE', _JWT_AUDIENCE_DEFAULT),
    }


class CurrentUser(BaseModel):
    """Current authenticated user extracted from a verified system-service JWT.

    Token claims mapping (set by ``SystemService.Infrastructure.Security.JwtTokenService``):
        * ``sub``       → user_id (GUID)
        * ``email``     → email
        * ``name``      → username (display name)
        * ``roles[]``   → roles (custom claim, not ``realm_access.roles`` — that's Keycloak)
        * ``permissions[]`` → permissions
    """
    user_id: uuid.UUID
    username: str | None = None
    email: str | None = None
    roles: List[str] = []
    permissions: List[str] = []
    token: str


def _verify_token(token: str) -> Dict[str, Any]:
    """Verify HS256 JWT against the shared system-service secret."""
    cfg = _get_jwt_config()
    try:
        payload = jwt.decode(
            token,
            cfg['secret'],
            algorithms=['HS256'],
            audience=cfg['audience'],
            issuer=cfg['issuer'],
        )
        logger.debug('Token verified successfully')
        return payload
    except JWTError as e:
        logger.warning(f'JWT verification failed: {e}')
        raise ValueError(f'Invalid token: {e}')
    except Exception as e:
        logger.error(f'Token verification error: {e}')
        raise ValueError(f'Token verification failed: {e}')


def _coerce_str_list(value: Any) -> List[str]:
    """Normalize a claim that may be a single string, list, or missing."""
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v) for v in value]
    return [str(value)]


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_bearer),
) -> CurrentUser:
    """Verify a system-service HS256 JWT and return the authenticated user.

    Flow: HTTP Bearer → HS256 verify → claims → CurrentUser
    """
    token = credentials.credentials

    try:
        payload = _verify_token(token)

        # Extract user_id from 'sub' claim — system-service issues GUIDs.
        user_id_str = payload.get('sub')
        if not user_id_str:
            logger.warning("Token missing 'sub' claim")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='Invalid token: missing user_id',
            )
        try:
            user_id = uuid.UUID(user_id_str)
        except ValueError:
            logger.warning(f'Invalid user_id format: {user_id_str}')
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='Invalid token: malformed user_id',
            )

        # system-service puts display name in 'name' and email in 'email'.
        username = payload.get('name')
        email = payload.get('email')

        # Custom claims (always lists in our setup, but coerce defensively).
        roles = _coerce_str_list(payload.get('roles'))
        permissions = _coerce_str_list(payload.get('permissions'))

        return CurrentUser(
            user_id=user_id,
            username=username,
            email=email,
            roles=roles,
            permissions=permissions,
            token=token,
        )

    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f'Token verification failed: {e}')
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f'Token verification failed: {str(e)}',
        )
    except Exception as e:
        logger.error(f'Unexpected error in authentication: {str(e)}')
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Authentication failed',
        )


# system-service emits roles in UPPER_SNAKE_CASE (SUPER_ADMIN, ADMIN, MANAGER).
# The legacy Keycloak-era code checked lowercase ('admin'/'manager'). Normalise
# everything to lowercase + strip the SUPER_ prefix so both naming conventions
# work transparently.
_ADMIN_ROLES = {'admin', 'super_admin', 'superadmin'}
_MANAGER_ROLES = _ADMIN_ROLES | {'manager'}


def _has_any_role(user_roles: List[str], allowed: set[str]) -> bool:
    return any(r.lower() in allowed for r in user_roles)


# ── Fine-grained permission helpers (matrix-based authz) ──────────────────────
# system-service issues JWT permissions as ``<MODULE_CODE>.<ACTION_CODE>``
# (e.g. ``CHATBOT_CONFIG.CREATE`` or ``CHATBOT_<id>.READ``). Each chatbot is
# mirrored as module ``CHATBOT_<chatbot_uuid_hex>`` (see system_modules.py);
# the "Thiết lập bot hội thoại" management screen is module ``CHATBOT_CONFIG``.

#: Management module — guards create / list / edit / delete of chatbots.
CHATBOT_CONFIG_MODULE = 'CHATBOT_CONFIG'


def chatbot_module_code(chatbot_id) -> str:
    """Permission module code for a specific chatbot (matches system_modules)."""
    raw = (
        chatbot_id.hex if isinstance(chatbot_id, uuid.UUID)
        else str(chatbot_id).replace('-', '')
    )
    return f'CHATBOT_{raw}'.upper()


def is_admin(user: CurrentUser) -> bool:
    """ADMIN / SUPER_ADMIN bypass all permission checks."""
    return _has_any_role(user.roles, _ADMIN_ROLES)


def has_permission(user: CurrentUser, module_code: str, action: str) -> bool:
    """True if the user is admin, or holds the ``module.action`` permission."""
    if is_admin(user):
        return True
    return f'{module_code}.{action}' in (user.permissions or [])


async def get_admin_user(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """Require ADMIN or SUPER_ADMIN role."""
    if not _has_any_role(current_user.roles, _ADMIN_ROLES):
        logger.warning(
            f"Admin access denied for user: {current_user.username} "
            f"(roles={current_user.roles})",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Admin role required',
        )
    return current_user


async def get_manager_user(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """Require MANAGER, ADMIN, or SUPER_ADMIN role."""
    if not _has_any_role(current_user.roles, _MANAGER_ROLES):
        logger.warning(
            f"Manager/Admin access denied for user: {current_user.username} "
            f"(roles={current_user.roles})",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Admin or Manager role required',
        )
    return current_user
