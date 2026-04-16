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

  const fillColorClass = isBelowKi
    ? 'bg-loss'
    : isAtOrAboveRedemption
      ? 'bg-profit'
      : 'bg-[var(--color-chart-3)]';

  return (
    <div className="w-full" role="img" aria-label={`현재 ${level.toFixed(1)}%, 낙인(KI) ${kiBarrier}%, 조기상환 ${redemptionBarrier}%`}>
      <div className={`relative w-full ${barHeight} overflow-visible rounded-full bg-surface-primary`}>
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ${fillColorClass}`}
          style={{ width: `${levelBar}%` }}
        />
        <div
          className="absolute top-1/2 z-10 h-6 w-0.5 -translate-x-px -translate-y-1/2 bg-content-tertiary"
          style={{ left: `${kiBar}%` }}
          title={`낙인(KI) ${kiBarrier}%`}
          aria-hidden
        />
        <div
          className="absolute top-1/2 z-10 h-6 w-0.5 -translate-x-px -translate-y-1/2 bg-content-secondary"
          style={{ left: `${redemptionBar}%` }}
          title={`조기상환 ${redemptionBarrier}%`}
          aria-hidden
        />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-content-tertiary">
        <span>KI(낙인) {kiBarrier}%</span>
        <span>조기상환 {redemptionBarrier}%</span>
        <span className="ml-auto tabular-nums">현재 {level.toFixed(1)}%</span>
      </div>
    </div>
  );
}
