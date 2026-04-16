import { useState } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { ALLOWED_GOOGLE_EMAIL } from '../config/auth'
import { useAuthStore } from '../store/authStore'

export function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        if (!res.ok) {
          setError('Google 계정 정보를 가져오지 못했습니다.')
          return
        }
        const profile = (await res.json()) as {
          email?: string
          name?: string
          picture?: string
        }
        const email = profile.email?.trim().toLowerCase()
        if (!email) {
          setError('이메일 정보를 확인할 수 없습니다.')
          return
        }
        if (email !== ALLOWED_GOOGLE_EMAIL.toLowerCase()) {
          setError(`허용된 계정(${ALLOWED_GOOGLE_EMAIL})만 이용할 수 있습니다.`)
          return
        }
        login({
          email: ALLOWED_GOOGLE_EMAIL,
          name: profile.name,
          picture: profile.picture,
        })
      } catch {
        setError('로그인 처리 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    },
    onError: () => {
      setError('Google 로그인이 취소되었거나 실패했습니다.')
    },
    scope: 'openid email profile',
  })

  return (
    <div className="flex min-h-screen flex-col bg-surface-primary">
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center px-6 py-12">
        <div className="rounded-2xl border border-stroke bg-surface-card p-8 shadow-glass">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-accent">
            Investment Dashboard
          </p>
          <h1 className="mt-2 text-center text-2xl font-bold text-content-primary">로그인</h1>
          <p className="mt-2 text-center text-sm text-content-secondary">
            Google 계정으로 로그인하세요.
          </p>

          {!clientId && (
            <div className="mt-6 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
              <p className="font-medium">설정 필요</p>
              <p className="mt-1 text-xs leading-relaxed text-yellow-300/80">
                Google Cloud Console에서 OAuth 2.0 클라이언트 ID(웹)를 만들고, 프로젝트 루트{' '}
                <code className="rounded bg-yellow-500/20 px-1">.env</code>에{' '}
                <code className="rounded bg-yellow-500/20 px-1">VITE_GOOGLE_CLIENT_ID</code>를
                추가하세요. 자바스크립트 출처에 <code className="text-[11px]">http://localhost:5173</code>{' '}
                등을 등록해야 합니다.
              </p>
            </div>
          )}

          {error && (
            <div
              className="mt-6 rounded-xl border border-loss/20 bg-loss-bg px-4 py-3 text-sm text-loss"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={!clientId || loading}
            onClick={() => googleLogin()}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl border border-stroke-strong bg-surface-elevated py-3.5 text-sm font-semibold text-content-primary shadow-sm transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {loading ? '처리 중…' : 'Google로 로그인'}
          </button>

          <p className="mt-6 text-center text-xs text-content-tertiary">
            회원가입은 제공하지 않습니다. 허용된 Google 계정만 접속할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}
