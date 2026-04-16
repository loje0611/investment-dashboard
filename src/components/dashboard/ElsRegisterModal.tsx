import { useCallback, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import {
  ELS_REGISTER_BROKERAGES,
  registerElsProduct,
  type ElsRegisterBrokerage,
} from '../../api/registerEls'
import { BottomSheet } from '../ui/BottomSheet'

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

function parsePositiveInt(s: string): number | null {
  const d = digitsOnly(s)
  if (!d) return null
  const n = parseInt(d, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parsePositiveAmount(s: string): number | null {
  const d = digitsOnly(s)
  if (!d) return null
  const n = parseInt(d, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

interface ElsRegisterModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

const inputClass =
  'w-full rounded-xl border border-stroke-strong bg-surface-elevated px-3.5 py-3 text-sm text-content-primary tabular-nums placeholder:text-content-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60'

export function ElsRegisterModal({ open, onClose, onSuccess }: ElsRegisterModalProps) {
  const [brokerage, setBrokerage] = useState<ElsRegisterBrokerage>(ELS_REGISTER_BROKERAGES[0])
  const [productRound, setProductRound] = useState('')
  const [amount, setAmount] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setBrokerage(ELS_REGISTER_BROKERAGES[0])
    setProductRound(''); setAmount(''); setIssueDate(''); setError(null)
  }, [])

  const handleClose = useCallback(() => {
    if (loading) return
    resetForm(); onClose()
  }, [loading, onClose, resetForm])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError(null)
    const roundNum = parsePositiveInt(productRound)
    const amountNum = parsePositiveAmount(amount)
    if (roundNum == null) { setError('상품회차를 숫자로 입력해 주세요.'); return }
    if (amountNum == null) { setError('가입금액을 숫자로 입력해 주세요.'); return }
    if (!issueDate.trim()) { setError('발행일을 선택해 주세요.'); return }
    setLoading(true)
    try {
      await registerElsProduct({ action: 'create', brokerage, productRound: roundNum, amount: amountNum, issueDate: issueDate.trim() })
      resetForm(); onClose(); onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally { setLoading(false) }
  }

  if (!open) return null

  const amountFormatted = digitsOnly(amount) === '' ? '' : new Intl.NumberFormat('ko-KR').format(parseInt(digitsOnly(amount), 10))

  return (
    <BottomSheet open={open} onClose={handleClose} title="ELS 등록" titleId="els-register-title">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-4">
        <div>
          <label htmlFor="els-brokerage" className="mb-1.5 block text-sm font-medium text-content-secondary">증권사</label>
          <select id="els-brokerage" value={brokerage} onChange={(ev) => setBrokerage(ev.target.value as ElsRegisterBrokerage)} disabled={loading} className={inputClass}>
            {ELS_REGISTER_BROKERAGES.map((b) => (<option key={b} value={b}>{b}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor="els-round" className="mb-1.5 block text-sm font-medium text-content-secondary">상품회차</label>
          <input id="els-round" type="text" inputMode="numeric" autoComplete="off" placeholder="예: 30868" value={productRound} onChange={(ev) => setProductRound(digitsOnly(ev.target.value))} disabled={loading} className={inputClass} />
        </div>
        <div>
          <label htmlFor="els-amount" className="mb-1.5 block text-sm font-medium text-content-secondary">가입금액 (원)</label>
          <input id="els-amount" type="text" inputMode="numeric" autoComplete="off" placeholder="숫자만 입력" value={amount} onChange={(ev) => setAmount(digitsOnly(ev.target.value))} disabled={loading} className={inputClass} />
          {amountFormatted !== '' && <p className="mt-1.5 text-sm font-medium tabular-nums text-accent">₩{amountFormatted}</p>}
        </div>
        <div>
          <label htmlFor="els-issue-date" className="mb-1.5 block text-sm font-medium text-content-secondary">발행일</label>
          <input id="els-issue-date" type="date" value={issueDate} onChange={(ev) => setIssueDate(ev.target.value)} disabled={loading} className={inputClass} />
        </div>
        {error && <p className="rounded-xl bg-loss-bg px-3 py-2.5 text-sm text-loss" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-white shadow-sm hover:bg-accent-hover disabled:opacity-60">
          {loading ? (<><Loader2 className="h-5 w-5 animate-spin" aria-hidden />등록 중…</>) : '등록하기'}
        </button>
      </form>
    </BottomSheet>
  )
}
