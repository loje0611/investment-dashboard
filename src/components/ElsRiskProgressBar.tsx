const MAX_LEVEL = 110;

export interface ElsRiskProgressBarProps {
  currentLevel: number;
  kiBarrier: number;
  redemptionBarrier: number;
  barHeight?: string;
}

function toBarPercent(value: number): number {
  return Math.max(0, Math.min(100, (value / MAX_LEVEL) * 100));
}

export function ElsRiskProgressBar({ currentLevel, kiBarrier, redemptionBarrier, barHeight = 'h-3' }: ElsRiskProgressBarProps) {
  const level = Math.max(0, Math.min(MAX_LEVEL, currentLevel));
  const ki = Math.max(0, Math.min(MAX_LEVEL, kiBarrier));
  const redemption = Math.max(0, Math.min(MAX_LEVEL, redemptionBarrier));

  const levelBar = toBarPercent(level);
  const kiBar = toBarPercent(ki);
  const redemptionBar = toBarPercent(redemption);

  const isBelowKi = level < ki;
  const isAtOrAboveRedemption = level >= redemption;

  const fillColor = isBelowKi
    ? '#F87171'
    : isAtOrAboveRedemption
      ? '#34D399'
      : '#FBBF24';

  return (
    <div className="w-full" role="img" aria-label={`현재 ${level.toFixed(1)}%, 낙인(KI) ${kiBarrier}%, 조기상환 ${redemptionBarrier}%`}>
      <div className={`relative w-full ${barHeight} overflow-visible rounded-full bg-[#1E293B]`}>
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
          style={{ width: `${levelBar}%`, backgroundColor: fillColor }}
        />
        <div
          className="absolute top-1/2 z-10 h-6 w-0.5 -translate-x-px -translate-y-1/2 bg-slate-400"
          style={{ left: `${kiBar}%` }}
          title={`낙인(KI) ${kiBarrier}%`}
          aria-hidden
        />
        <div
          className="absolute top-1/2 z-10 h-6 w-0.5 -translate-x-px -translate-y-1/2 bg-slate-300"
          style={{ left: `${redemptionBar}%` }}
          title={`조기상환 ${redemptionBarrier}%`}
          aria-hidden
        />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-300">
        <span>KI(낙인) <strong className="text-slate-100">{kiBarrier}%</strong></span>
        <span>조기상환 <strong className="text-slate-100">{redemptionBarrier}%</strong></span>
        <span className="ml-auto font-semibold tabular-nums text-slate-100">현재 {level.toFixed(1)}%</span>
      </div>
    </div>
  );
}
