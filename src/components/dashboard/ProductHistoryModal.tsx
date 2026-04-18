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
import type { TooltipProps } from 'recharts'
import { fetchProductHistory, type ProductHistoryKind } from '../../api/api'

export interface ProductHistoryModalProps {
  open: boolean
  onClose: () => void
  productName: string
  productType: ProductHistoryKind
}

type ChartPoint = { date: string; rate: number }

const TOOLTIP_APPROX_W = 180
const TOOLTIP_OFFSET = 12

function HistoryTooltipContent({ active, payload, label, coordinate, viewBox }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const raw = payload[0].value
  const n = typeof raw === 'number' && !Number.isNaN(raw) ? raw : Number(raw)
  if (Number.isNaN(n)) return null

  const vb = viewBox as { x?: number; width?: number } | undefined
  const chartRight = (vb?.x ?? 0) + (vb?.width ?? Infinity)
  const flip = (coordinate?.x ?? 0) + TOOLTIP_APPROX_W + TOOLTIP_OFFSET * 2 > chartRight

  return (
    <div
      className="pointer-events-none min-w-[148px] rounded-xl border border-white/10 bg-slate-950/95 px-3.5 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md ring-1 ring-cyan-500/10"
      style={flip ? { transform: `translateX(calc(-100% - ${TOOLTIP_OFFSET * 2}px))` } : undefined}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">평가일</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums tracking-tight text-slate-50">{label ?? '—'}</p>
      <div className="mt-2.5 border-t border-white/10 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">수익률</p>
        <p className="mt-0.5 text-lg font-bold tabular-nums text-cyan-300">{n.toFixed(2)}%</p>
      </div>
    </div>
  )
}

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
                        animationDuration={180}
                        animationEasing="ease-out"
                        cursor={{
                          stroke: 'rgba(165, 243, 252, 0.45)',
                          strokeWidth: 1.25,
                          strokeLinecap: 'round',
                        }}
                        offset={TOOLTIP_OFFSET}
                        wrapperStyle={{ outline: 'none', transition: 'opacity 0.12s ease-out', zIndex: 20 }}
                        content={HistoryTooltipContent}
                      />
                      <Area
                        type="monotone"
                        dataKey="rate"
                        stroke="#22d3ee"
                        strokeWidth={2}
                        fill="url(#historyFill)"
                        dot={false}
                        activeDot={{
                          r: 6,
                          strokeWidth: 2,
                          stroke: '#f8fafc',
                          fill: '#06b6d4',
                          style: {
                            filter: 'drop-shadow(0 0 8px rgba(34,211,238,0.55))',
                            transition: 'r 0.2s ease-out, stroke-width 0.2s ease-out, opacity 0.2s ease-out',
                          },
                        }}
                        isAnimationActive
                        animationDuration={520}
                        animationEasing="ease-in-out"
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
