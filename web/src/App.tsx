import { useCallback, useMemo, useState } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { MapView } from '@/components/MapView';
import { StationList } from '@/components/StationList';
import { Footer } from '@/components/Footer';
import { NightNotice } from '@/components/NightNotice';
import { RateLimitToast } from '@/components/RateLimitToast';
import { useProviders } from '@/hooks/useProviders';
import { useTheme } from '@/hooks/useTheme';
import { useStations } from '@/hooks/useStations';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useConfig } from '@/hooks/useConfig';
import { SummaryGrid } from '@/components/SummaryGrid';
import type { CampusId, StationRecord } from '@/types/station';
import { formatTimestamp } from '@/lib/time';

export default function App() {
  const [campusId, setCampusId] = useState<CampusId>('');
  const [providerId, setProviderId] = useState('');
  const { theme, toggleTheme } = useTheme();
  const { providers } = useProviders();
  const { watchlist, isWatched, toggleWatch } = useWatchlist();
  const stationsState = useStations(providerId, campusId);
  const refreshInterval = useConfig();
  const [focusStation, setFocusStation] = useState<StationRecord | null>(null);

  const handleRefresh = useCallback(() => {
    void stationsState.refresh();
  }, [stationsState]);

  useAutoRefresh(handleRefresh, refreshInterval);

  const watchlistCount = useMemo(() => watchlist.deviceKeys.size + watchlist.names.size, [watchlist]);

  const handleCampusSelect = useCallback((id: CampusId) => {
    setCampusId(id);
    setFocusStation(null);
  }, []);

  const handleStationSelect = useCallback(
    (station: StationRecord) => {
      setFocusStation(station);
      if (station.campusId && station.campusId !== campusId) {
        setCampusId(station.campusId);
      }
    },
    [campusId]
  );

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-200">
      <RateLimitToast visible={stationsState.rateLimited} message={stationsState.error} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col gap-4 sm:gap-6 min-h-screen lg:h-screen lg:max-h-screen lg:overflow-hidden">
        <HeaderBar
          lastUpdated={stationsState.updatedAt}
          onRefresh={handleRefresh}
          onToggleTheme={toggleTheme}
          theme={theme}
        />

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <SummaryGrid
            summary={stationsState.summary}
            selectedCampusId={campusId}
            onSelectCampus={handleCampusSelect}
          />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 flex-1 lg:overflow-hidden">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col transition-colors duration-200 flex-1 min-h-[50vh] lg:min-h-0">
            <MapView
              stations={stationsState.mapStations}
              campusId={campusId}
              theme={theme}
              focusStation={focusStation}
            />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col transition-colors duration-200 flex-1 min-h-[40vh] lg:min-h-0">
            <div className="p-4 lg:p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200">站点列表</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">关注 {watchlistCount} 个站点</p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <label className="text-gray-600 dark:text-gray-400">服务商</label>
                <div className="relative">
                  <select
                    className="appearance-none px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 border border-blue-200 dark:border-blue-700 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={providerId}
                    onChange={(event) => setProviderId(event.target.value)}
                  >
                    <option value="">全部</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-blue-500">
                    ▼
                  </span>
                </div>
              </div>
            </div>
            <div className="px-4 lg:px-6 pt-4 pb-2 flex-shrink-0">
              <NightNotice />
            </div>
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 min-h-0">
              <StationList
                stations={stationsState.campusStations}
                loading={stationsState.loading}
                error={stationsState.error}
                isWatched={isWatched}
                onToggleWatch={toggleWatch}
                onSelectStation={handleStationSelect}
              />
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
