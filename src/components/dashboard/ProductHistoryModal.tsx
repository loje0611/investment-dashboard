import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Loader2 } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchProductHistory, type ProductHistoryKind } from '../../api/api'

export interface ProductHistoryModalProps {
  open: boolean
  onClose: () => void
  productName: string
  productType: ProductHistoryKind
}

type ChartPoint = { date: string; rate: number }

export function ProductHistoryModal({
  open,
  onClose,
  productName,
  productType,
}: ProductHistoryModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [series, setSeries] = useState<ChartPoint[] | null>(null)

  const load = useCallback(async () => {
    if (!productName.trim()) return
    setLoading(true)
    setError(null)
    setSeries(null)
    try {
      const rows = await fetchProductHistory(productName, productType)
      setSeries(
        rows.map(([date, rate]) => ({
          date,
          rate: Number(rate),
        }))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [productName, productType])

  useEffect(() => {
    if (!open) {
      setSeries(null)
      setError(null)
      setLoading(false)
      return
    }
    void load()
  }, [open, load])

  const handleClose = () => {
    if (loading) return
    onClose()
  }

  const empty = !loading && !error && series !== null && series.length === 0

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-history-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-md transition-opacity"
            aria-label="배경 닫기"
            onClick={handleClose}
          />

          <motion.div
            className="relative z-10 flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[1.35rem] border border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-950/98 shadow-[0_24px_80px_-12px_rgba(15,23,42,0.65)] ring-1 ring-white/5 sm:rounded-[1.35rem]"
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400/90">
                  {productType === 'ETF' ? 'ETF' : '연금'} 수익률 추이
                </p>
                <h2
                  id="product-history-title"
                  className="mt-1 text-lg font-semibold leading-snug text-white"
                >
                  {productName}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-[320px] flex-1 px-4 pb-5 pt-2 sm:px-6">
              {loading ? (
                <div className="flex h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-6">
                  <Loader2 className="h-10 w-10 animate-spin text-cyan-400" aria-hidden />
                  <p className="text-sm font-medium text-slate-300">히스토리 불러오는 중…</p>
                </div>
              ) : error ? (
                <div
                  className="flex h-[300px] items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-950/30 px-6 text-center text-sm text-rose-100"
                  role="alert"
                >
                  {error}
                </div>
              ) : empty ? (
                <div className="flex h-[300px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-6 text-center text-sm font-medium text-slate-400">
                  기록된 데이터가 없습니다
                </div>
              ) : series && series.length > 0 ? (
                <div className="h-[300px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="historyFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,163,184,0.12)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
                        interval="preserveStartEnd"
                        minTickGap={28}
                      />
                      <YAxis
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={44}
                        tickFormatter={(v) => `${v}%`}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15,23,42,0.92)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '12px',
                          boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
                          backdropFilter: 'blur(12px)',
                        }}
                        labelStyle={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}
                        formatter={(value: number) => [`${value.toFixed(2)}%`, '수익률']}
                        labelFormatter={(label) => `평가일 ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="rate"
                        stroke="#22d3ee"
                        strokeWidth={2}
                        fill="url(#historyFill)"
                        dot={{ r: 3, fill: '#0891b2', stroke: '#cffafe', strokeWidth: 1 }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
