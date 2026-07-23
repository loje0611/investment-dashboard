import { useStore } from '../../store/useStore';
import { Database, FileText } from 'lucide-react';

export function DataSourceToggle() {
  const dataSourceMode = useStore((s) => s.dataSourceMode);
  const setDataSourceMode = useStore((s) => s.setDataSourceMode);

  const isLocal = dataSourceMode === 'local';

  return (
    <button
      type="button"
      onClick={() => setDataSourceMode(isLocal ? 'gas' : 'local')}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
        isLocal
          ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30'
          : 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/30'
      }`}
      title={isLocal ? '로컬 CSV 모드 사용 중 (클릭 시 구글 시트로 전환)' : '구글 시트 모드 사용 중 (클릭 시 로컬 CSV로 전환)'}
    >
      {isLocal ? (
        <>
          <FileText className="h-3.5 w-3.5" />
          <span>로컬 CSV</span>
        </>
      ) : (
        <>
          <Database className="h-3.5 w-3.5" />
          <span>구글 시트</span>
        </>
      )}
    </button>
  );
}
