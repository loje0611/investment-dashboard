/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEB_APP_URL: string;
  /** Google OAuth 2.0 웹 클라이언트 ID */
  readonly VITE_GOOGLE_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
