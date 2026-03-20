import { create } from 'zustand'
import { ALLOWED_GOOGLE_EMAIL } from '../config/auth'

const STORAGE_KEY = 'investment-dashboard-auth-v1'

export interface AuthUser {
  email: string
  name?: string
  picture?: string
}

interface AuthState {
  user: AuthUser | null
  /** localStorage 복원 완료 여부 */
  ready: boolean
  init: () => void
  login: (user: AuthUser) => void
  logout: () => void
}

function normalizeAllowedEmail(email: string): boolean {
  return email.trim().toLowerCase() === ALLOWED_GOOGLE_EMAIL.toLowerCase()
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,

  init: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        set({ ready: true })
        return
      }
      const parsed = JSON.parse(raw) as AuthUser
      const email = parsed?.email
      if (typeof email === 'string' && normalizeAllowedEmail(email)) {
        set({
          user: { ...parsed, email: ALLOWED_GOOGLE_EMAIL },
          ready: true,
        })
      } else {
        localStorage.removeItem(STORAGE_KEY)
        set({ user: null, ready: true })
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
      set({ user: null, ready: true })
    }
  },

  login: (user) => {
    if (!normalizeAllowedEmail(user.email)) return
    const normalized: AuthUser = {
      ...user,
      email: ALLOWED_GOOGLE_EMAIL,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    set({ user: normalized })
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ user: null })
  },
}))
