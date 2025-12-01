import type { SummaryItem } from '@/hooks/useStations';
import type { CampusId } from '@/types/station';
import { clsx } from 'clsx';

interface SummaryGridProps {
  summary: SummaryItem[];
  selectedCampusId: CampusId;
  onSelectCampus: (campusId: CampusId) => void;
}

const shortName = (name: string) => name.slice(0, 2);

export function SummaryGrid({ summary, selectedCampusId, onSelectCampus }: SummaryGridProps) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 min-w-full sm:grid sm:grid-cols-4">
        {summary.map((item) => (
          <button
            key={item.campusId || item.campusName}
            type="button"
            className={clsx(
              'rounded-lg p-3 text-left transition border shadow-sm min-w-[140px] flex-shrink-0',
              selectedCampusId === item.campusId
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200'
            )}
            onClick={() => onSelectCampus(item.campusId)}
          >
            <p className="text-sm font-medium flex items-center justify-between">
              <span>
                <span className="sm:hidden">{shortName(item.campusName)}</span>
                <span className="hidden sm:inline">{item.campusName}</span>
              </span>
              {selectedCampusId === item.campusId && <span className="text-xs">已选</span>}
            </p>
            <p className="text-2xl font-bold mt-1">{item.free}</p>
            <p className="text-xs text-current/80">空闲/{item.total} 个站点</p>
          </button>
        ))}
      </div>
    </div>
  );
}
