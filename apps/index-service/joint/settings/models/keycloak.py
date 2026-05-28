from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings


class KeycloakSettings(BaseSettings):
    """Legacy Keycloak settings — kept for backward compat.

    The chatbot-service no longer uses Keycloak. JWT verification now goes
    through the .NET ``system-service`` using HS256 with ``JWT_SECRET``
    (see ``api/helpers/dependencies/shared_auth.py``).

    All fields are optional defaults so the app boots without KEYCLOAK__ env
    vars. The class is still referenced by ``joint/settings/settings.py``;
    delete that reference too in a follow-up cleanup PR.
    """

    base_url: str = Field('', description='Unused — legacy Keycloak base URL.')
    realm: str = Field('', description='Unused — legacy Keycloak realm.')
    client_id: str = Field('', description='Unused — legacy Keycloak client id.')
    client_secret: str = Field('', description='Unused — legacy Keycloak client secret.')

    class Config:
        env_prefix = 'KEYCLOAK__'
