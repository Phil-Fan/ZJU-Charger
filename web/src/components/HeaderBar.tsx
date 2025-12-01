import { formatTimestamp } from '@/lib/time';

interface HeaderBarProps {
  lastUpdated?: string;
  onRefresh: () => void;
  onToggleTheme: () => void;
  theme: 'light' | 'dark';
}

export function HeaderBar({
  lastUpdated,
  onRefresh,
  onToggleTheme,
  theme,
}: HeaderBarProps) {
  return (
    <header className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 transition-colors duration-200 flex-shrink-0">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-end gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">ZJU Charger</h1>
          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">by PhilFan</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:gap-4">
          <span className="text-xs lg:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatTimestamp(lastUpdated)}</span>
          <button
            className="px-3 lg:px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md text-xs lg:text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600"
            onClick={onRefresh}
          >
            刷新
          </button>
          <button
            type="button"
            className="p-2 rounded-md text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onToggleTheme}
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
