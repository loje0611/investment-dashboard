import { useCallback, useState, type FormEvent } from 'react'
import { X, Loader2 } from 'lucide-react'
import {
  ELS_REGISTER_BROKERAGES,
  registerElsProduct,
  type ElsRegisterBrokerage,
} from '../../api/registerEls'

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
}

export function ElsRegisterModal({ open, onClose }: ElsRegisterModalProps) {
  const [brokerage, setBrokerage] = useState<ElsRegisterBrokerage>(ELS_REGISTER_BROKERAGES[0])
  const [productRound, setProductRound] = useState('')
  const [amount, setAmount] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setBrokerage(ELS_REGISTER_BROKERAGES[0])
    setProductRound('')
    setAmount('')
    setIssueDate('')
    setError(null)
  }, [])

  const handleClose = useCallback(() => {
    if (loading) return
    resetForm()
    onClose()
  }, [loading, onClose, resetForm])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const roundNum = parsePositiveInt(productRound)
    const amountNum = parsePositiveAmount(amount)
    if (roundNum == null) {
      setError('상품회차를 숫자로 입력해 주세요.')
      return
    }
    if (amountNum == null) {
      setError('가입금액을 숫자로 입력해 주세요.')
      return
    }
    if (!issueDate.trim()) {
      setError('발행일을 선택해 주세요.')
      return
    }
    setLoading(true)
    try {
      await registerElsProduct({
        action: 'create',
        brokerage,
        productRound: roundNum,
        amount: amountNum,
        issueDate: issueDate.trim(),
      })
      resetForm()
      onClose()
      window.alert('성공적으로 등록되었습니다')
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const amountFormatted =
    digitsOnly(amount) === ''
      ? ''
      : new Intl.NumberFormat('ko-KR').format(parseInt(digitsOnly(amount), 10))

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="els-register-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-label="닫기"
        onClick={handleClose}
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-[480px] flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 id="els-register-title" className="text-lg font-bold text-slate-900">
            ELS 등록
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
          <div>
            <label htmlFor="els-brokerage" className="mb-1 block text-sm font-medium text-slate-700">
              증권사
            </label>
            <select
              id="els-brokerage"
              value={brokerage}
              onChange={(ev) => setBrokerage(ev.target.value as ElsRegisterBrokerage)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
            >
              {ELS_REGISTER_BROKERAGES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="els-round" className="mb-1 block text-sm font-medium text-slate-700">
              상품회차
            </label>
            <input
              id="els-round"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="예: 30868"
              value={productRound}
              onChange={(ev) => setProductRound(digitsOnly(ev.target.value))}
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 tabular-nums placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="els-amount" className="mb-1 block text-sm font-medium text-slate-700">
              가입금액 (원)
            </label>
            <input
              id="els-amount"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="숫자만 입력"
              value={amount}
              onChange={(ev) => setAmount(digitsOnly(ev.target.value))}
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 tabular-nums placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
            />
            {amountFormatted !== '' && (
              <p className="mt-1.5 text-sm font-medium tabular-nums text-indigo-600">
                ₩{amountFormatted}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="els-issue-date" className="mb-1 block text-sm font-medium text-slate-700">
              발행일
            </label>
            <input
              id="els-issue-date"
              type="date"
              value={issueDate}
              onChange={(ev) => setIssueDate(ev.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                등록 중…
              </>
            ) : (
              '등록하기'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
