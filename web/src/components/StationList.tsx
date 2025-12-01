import type { StationRecord } from '@/types/station';
import { clsx } from 'clsx';

interface StationListProps {
  stations: StationRecord[];
  loading: boolean;
  error?: string | null;
  onToggleWatch: (station: StationRecord) => void;
  isWatched: (station: StationRecord) => boolean;
  onSelectStation?: (station: StationRecord) => void;
}

function availabilityClass(station: StationRecord): string {
  if (station.free > 0) return 'text-green-600 dark:text-green-400';
  if (station.error > 0) return 'text-red-500 dark:text-red-400';
  return 'text-gray-500 dark:text-gray-400';
}

function progressWidth(station: StationRecord): string {
  if (!station.total) return '0%';
  const ratio = Math.min(1, Math.max(0, station.free / station.total));
  return `${Math.round(ratio * 100)}%`;
}

export function StationList({ stations, loading, error, onToggleWatch, isWatched, onSelectStation }: StationListProps) {
  if (loading) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">加载中...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 p-4 rounded-lg text-center">
        <p className="font-medium">加载数据失败</p>
        <p className="text-sm mt-2">{error}</p>
        <p className="text-xs mt-2 text-red-500">请检查服务器和网络连接</p>
      </div>
    );
  }

  if (stations.length === 0) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 p-4 rounded-lg text-center">
        <p className="font-medium">暂无站点数据</p>
        <p className="text-sm mt-2">尝试切换校区或刷新页面</p>
      </div>
    );
  }

  const sorted = [...stations].sort((a, b) => {
    const watchDelta = Number(isWatched(b)) - Number(isWatched(a));
    if (watchDelta !== 0) return watchDelta;
    const fetchedDelta = Number(b.isFetched) - Number(a.isFetched);
    if (fetchedDelta !== 0) return fetchedDelta;
    const freeDelta = b.free - a.free;
    if (freeDelta !== 0) return freeDelta;
    return a.name.localeCompare(b.name, 'zh-CN');
  });

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((station) => (
        <article
          key={station.hashId}
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white/90 dark:bg-gray-900/90 shadow-lg cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => onSelectStation?.(station)}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {station.name}
                {!station.isFetched && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">未抓取</span>
                )}
              </h3>
              <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200">{station.campusName || '未分配校区'}</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-200">{station.provider}</span>
              </div>
            </div>
            <button
              type="button"
              className={clsx('text-xl transition-colors', isWatched(station) ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400')}
              onClick={(event) => {
                event.stopPropagation();
                onToggleWatch(station);
              }}
              title={isWatched(station) ? '取消关注' : '关注该站点'}
            >
              ★
            </button>
          </div>
          <div className="flex items-center gap-4 mt-3 text-sm">
            <span className={availabilityClass(station)}>空闲 {station.free}</span>
            <span className="text-gray-500 dark:text-gray-400">占用 {station.used}</span>
            <span className="text-gray-500 dark:text-gray-400">故障 {station.error}</span>
            <span className="text-gray-500 dark:text-gray-400">总数 {station.total}</span>
          </div>
          <div className="mt-3 h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 dark:bg-green-400"
              style={{ width: progressWidth(station) }}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
