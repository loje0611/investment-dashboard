const MAX_LEVEL = 110;

export interface ElsRiskProgressBarProps {
  /**
   * Worst Performer의 현재 위치 (%).
   * 100 = 기준가 대비 동일, 110까지 표시 가능.
   */
  currentLevel: number;
  /** 낙인(KI) 배리어 위치 (%) */
  kiBarrier: number;
  /** 상환 배리어 위치 (%) */
  redemptionBarrier: number;
  /** 막대 높이 Tailwind 클래스. 기본 h-3 */
  barHeight?: string;
}

/** 0~MAX_LEVEL 구간을 막대 너비 0~100%로 변환 */
function toBarPercent(value: number): number {
  return Math.max(0, Math.min(100, (value / MAX_LEVEL) * 100));
}

export function ElsRiskProgressBar({
  currentLevel,
  kiBarrier,
  redemptionBarrier,
  barHeight = 'h-3',
}: ElsRiskProgressBarProps) {
  const level = Math.max(0, Math.min(MAX_LEVEL, currentLevel));
  const ki = Math.max(0, Math.min(MAX_LEVEL, kiBarrier));
  const redemption = Math.max(0, Math.min(MAX_LEVEL, redemptionBarrier));

  const levelBar = toBarPercent(level);
  const kiBar = toBarPercent(ki);
  const redemptionBar = toBarPercent(redemption);

  const isBelowKi = level < ki;
  const isAtOrAboveRedemption = level >= redemption;

  const fillColorClass = isBelowKi
    ? 'bg-red-500'
    : isAtOrAboveRedemption
      ? 'bg-green-500'
      : 'bg-amber-500';

  return (
    <div className="w-full" role="img" aria-label={`현재 ${level.toFixed(1)}%, 낙인(KI) ${kiBarrier}%, 조기상환 ${redemptionBarrier}%`}>
      <div
        className={`relative w-full ${barHeight} overflow-visible rounded-full bg-gray-200`}
      >
        {/* 채움 막대: 0 ~ currentLevel (110%까지) */}
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ${fillColorClass}`}
          style={{ width: `${levelBar}%` }}
        />

        {/* 낙인(KI) 배리어 세로선 */}
        <div
          className="absolute top-1/2 z-10 h-6 w-0.5 -translate-x-px -translate-y-1/2 bg-gray-600"
          style={{ left: `${kiBar}%` }}
          title={`낙인(KI) ${kiBarrier}%`}
          aria-hidden
        />

        {/* 조기상환 배리어 세로선 */}
        <div
          className="absolute top-1/2 z-10 h-6 w-0.5 -translate-x-px -translate-y-1/2 bg-gray-700"
          style={{ left: `${redemptionBar}%` }}
          title={`조기상환 ${redemptionBarrier}%`}
          aria-hidden
        />
      </div>

      {/* 범례 */}
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span>KI(낙인) {kiBarrier}%</span>
        <span>조기상환 {redemptionBarrier}%</span>
        <span className="ml-auto tabular-nums">현재 {level.toFixed(1)}%</span>
      </div>
    </div>
  );
}
