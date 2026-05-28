/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_VERSION: string;
  readonly VITE_DEFAULT_PROVIDER_LLM: string;
  readonly VITE_DEFAULT_PROVIDER_STORAGE: string;
  readonly VITE_DEFAULT_PROVIDER_EMBEDDING: string;
  readonly VITE_DEFAULT_COLLECTION_NAME: string;
  readonly VITE_DEFAULT_BOT_NAME: string;
  readonly VITE_DEFAULT_BOT_AVATAR: string;
  readonly VITE_DEFAULT_GREETING: string;
  readonly VITE_DEFAULT_PRIMARY_COLOR: string;
  readonly VITE_DEBUG_MODE: string;
  readonly VITE_LOG_LEVEL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}