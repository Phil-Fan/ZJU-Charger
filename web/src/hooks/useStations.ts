import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CampusId, StationRecord } from '@/types/station';
import { fetchStationsMetadata, fetchStatus, mergeStations, RateLimitError } from '@/services/api';
import { CAMPUS_LIST } from '@/config';

export interface SummaryItem {
  campusId: CampusId;
  campusName: string;
  total: number;
  free: number;
  used: number;
  error: number;
}

export interface UseStationsResult {
  loading: boolean;
  error: string | null;
  rateLimited: boolean;
  updatedAt?: string;
  stations: StationRecord[];
  mapStations: StationRecord[];
  campusStations: StationRecord[];
  summary: SummaryItem[];
  refresh: () => Promise<void>;
}

export function useStations(providerId: string, campusId: CampusId): UseStationsResult {
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [status, metadata] = await Promise.all([
        fetchStatus(providerId || undefined),
        fetchStationsMetadata(),
      ]);
      const merged = mergeStations(status.stations || [], metadata.stations || []);
      setStations(merged);
      setUpdatedAt(status.updated_at || metadata.updated_at);
      setError(null);
      setRateLimited(false);
    } catch (err) {
      if (err instanceof RateLimitError) {
        setRateLimited(true);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : '加载数据失败');
      }
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const campusStations = useMemo(() => {
    if (!campusId) return stations;
    return stations.filter((station) => station.campusId === campusId);
  }, [stations, campusId]);

  const mapStations = useMemo(() => {
    if (!campusId) return stations;
    return stations.filter((station) => station.campusId === campusId);
  }, [stations, campusId]);

  const summary = useMemo(() => {
    const campusSummaries = CAMPUS_LIST.map((campus) => {
      const scoped = stations.filter((station) => station.campusId === campus.id);
      return {
        campusId: campus.id,
        campusName: campus.name,
        total: scoped.length,
        free: scoped.reduce((sum, station) => sum + station.free, 0),
        used: scoped.reduce((sum, station) => sum + station.used, 0),
        error: scoped.reduce((sum, station) => sum + station.error, 0),
      } satisfies SummaryItem;
    });

    const overall: SummaryItem = {
      campusId: '' as CampusId,
      campusName: '全部校区',
      total: stations.length,
      free: stations.reduce((sum, station) => sum + station.free, 0),
      used: stations.reduce((sum, station) => sum + station.used, 0),
      error: stations.reduce((sum, station) => sum + station.error, 0),
    };

    return [overall, ...campusSummaries];
  }, [stations]);

  return {
    loading,
    error,
    rateLimited,
    updatedAt,
    stations,
    mapStations,
    campusStations,
    summary,
    refresh,
  };
}
