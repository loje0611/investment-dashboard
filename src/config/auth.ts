/** Google 로그인 후 허용되는 계정 (소문자 비교) */
export const ALLOWED_GOOGLE_EMAIL = 'loje0611@gmail.com'

/**
 * 로컬 개발 전용 인증 우회.
 * `.env`에 `VITE_AUTH_BYPASS=true` 설정 시에만 동작하며, 프로덕션 빌드에서는 무시됩니다.
 */
export const isAuthBypassEnabled =
  import.meta.env.DEV && import.meta.env.VITE_AUTH_BYPASS === 'true'
