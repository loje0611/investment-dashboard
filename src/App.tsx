import { useEffect } from 'react'
import { DashboardLayout } from './components/dashboard/DashboardLayout'
import { LoginPage } from './components/LoginPage'
import { useAuthStore } from './store/authStore'

function App() {
  const init = useAuthStore((s) => s.init)
  const ready = useAuthStore((s) => s.ready)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    init()
  }, [init])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return <DashboardLayout />
}

export default App
