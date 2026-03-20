import { LogOut } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export function LogoutButton({ className = '' }: { className?: string }) {
  const logout = useAuthStore((s) => s.logout)

  return (
    <button
      type="button"
      onClick={() => logout()}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 ${className}`}
      aria-label="로그아웃"
    >
      <LogOut className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      로그아웃
    </button>
  )
}
