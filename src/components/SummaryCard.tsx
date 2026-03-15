interface SummaryCardProps {
  /** 총 평가금액 */
  totalAmount: number;
  /** 전월 대비 증감률 (%) */
  monthChangeRate?: number;
  /** 전일 대비 증감률 (%) */
  dayChangeRate?: number;
}

function formatAmount(value: number): string {
  return value.toLocaleString('ko-KR');
}

function ChangeRate({ rate, label }: { rate: number; label: string }) {
  const isPositive = rate > 0;
  const isNegative = rate < 0;
  const textColorClass = isPositive
    ? 'text-red-600'
    : isNegative
      ? 'text-blue-600'
      : 'text-gray-600';

  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${textColorClass}`}>
        {isPositive && '+'}
        {rate.toFixed(2)}%
      </span>
    </div>
  );
}

export function SummaryCard({
  totalAmount,
  monthChangeRate = 0,
  dayChangeRate = 0,
}: SummaryCardProps) {
  return (
    <div className="glass-panel-sm p-6 transition-all hover:-translate-y-1 hover:shadow-glass-lg">
      <p className="mb-2 text-sm font-semibold tracking-wide text-slate-500">총 평가금액</p>
      <p className="mb-5 text-3xl font-extrabold tracking-tight tabular-nums text-slate-900">
        {formatAmount(totalAmount)}
        <span className="ml-1 text-lg font-medium text-slate-500">원</span>
      </p>
      <div className="flex flex-wrap gap-5">
        <ChangeRate rate={monthChangeRate} label="전월 대비" />
        <ChangeRate rate={dayChangeRate} label="전일 대비" />
      </div>
    </div>
  );
}
