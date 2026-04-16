import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { X, Loader2 } from 'lucide-react'
import { redeemElsProduct } from '../../api/redeemEls'
import { useFocusTrap } from '../../utils/useFocusTrap'

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

function parsePositiveAmount(s: string): number | null {
  const d = digitsOnly(s)
  if (!d) return null
  const n = parseInt(d, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export interface ElsRedeemModalProps {
  open: boolean
  onClose: () => void
  rowIndex: number
  productName: string
  /** 가입금액(원) — 상환금액 입력 기본값 */
  defaultRedeemAmount?: number
  onSuccess: () => void
}

export function ElsRedeemModal({
  open,
  onClose,
  rowIndex,
  productName,
  defaultRedeemAmount,
  onSuccess,
}: ElsRedeemModalProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(open)
  const [redeemDate, setRedeemDate] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setRedeemDate('')
    setAmount('')
    setError(null)
  }, [])

  useEffect(() => {
    if (!open) return
    setError(null)
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    setRedeemDate(`${y}-${m}-${d}`)
    if (defaultRedeemAmount != null && defaultRedeemAmount > 0) {
      setAmount(String(Math.round(defaultRedeemAmount)))
    } else {
      setAmount('')
    }
  }, [open, defaultRedeemAmount])

  const handleClose = useCallback(() => {
    if (loading) return
    resetForm()
    onClose()
  }, [loading, onClose, resetForm])

  useEffect(() => {
    if (!open) return
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', onEsc)
    return () => document.removeEventListener('keydown', onEsc)
  }, [open, handleClose])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const amountNum = parsePositiveAmount(amount)
    if (!redeemDate.trim()) {
      setError('상환일을 선택해 주세요.')
      return
    }
    if (amountNum == null) {
      setError('상환금액을 숫자로 입력해 주세요.')
      return
    }
    setLoading(true)
    try {
      await redeemElsProduct({
        action: 'redeem',
        row_index: rowIndex,
        상환일: redeemDate.trim(),
        상환금액: amountNum,
      })
      resetForm()
      onClose()
      onSuccess()
      window.alert('상환 처리되었습니다.')
    } catch (err) {
      setError(err instanceof Error ? err.message : '상환에 실패했습니다.')
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
      ref={trapRef}
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="els-redeem-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-label="닫기"
        onClick={handleClose}
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-[480px] flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 id="els-redeem-title" className="text-lg font-bold text-slate-900">
            ELS 상환
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
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{productName}</span>
          </p>

          <div>
            <label htmlFor="els-redeem-date" className="mb-1 block text-sm font-medium text-slate-700">
              상환일
            </label>
            <input
              id="els-redeem-date"
              type="date"
              value={redeemDate}
              onChange={(ev) => setRedeemDate(ev.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="els-redeem-amount" className="mb-1 block text-sm font-medium text-slate-700">
              상환금액 (원)
            </label>
            <input
              id="els-redeem-amount"
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

          <p className="text-xs leading-relaxed text-slate-500">
            저장 시 시트에 상태「상환완료」, 상환일·상환금액이 반영되고, 가입일·가입금액 기준으로 투자기간·연수익률·수익이
            계산되어 입력됩니다. (시트에 해당 열 헤더가 있어야 합니다.)
          </p>

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
                처리 중…
              </>
            ) : (
              '상환 반영'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
