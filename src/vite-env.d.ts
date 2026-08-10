/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth 2.0 웹 클라이언트 ID */
  readonly VITE_GOOGLE_CLIENT_ID: string;
  /** 로컬 개발 전용 인증 우회 (npm run dev에서만 적용) */
  readonly VITE_AUTH_BYPASS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
