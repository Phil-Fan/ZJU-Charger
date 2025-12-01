import { useCallback, useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS } from '@/config';
import type { StationRecord } from '@/types/station';

export interface WatchlistState {
  deviceKeys: Set<string>;
  names: Set<string>;
}

function parseWatchlist(): WatchlistState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.watchlist);
    if (!raw) {
      return { deviceKeys: new Set(), names: new Set() };
    }
    const payload = JSON.parse(raw) as {
      devids?: Array<{ devid: number | string; provider: string }>;
      devdescripts?: string[];
    };
    const deviceKeys = new Set<string>();
    payload.devids?.forEach((item) => {
      if (!item?.devid || !item.provider) return;
      deviceKeys.add(`${item.devid}:${item.provider}`);
    });
    return {
      deviceKeys,
      names: new Set(payload.devdescripts || []),
    };
  } catch (error) {
    console.warn('无法解析本地关注列表', error);
    return { deviceKeys: new Set(), names: new Set() };
  }
}

function persistWatchlist(state: WatchlistState) {
  const payload = {
    devids: Array.from(state.deviceKeys).map((key) => {
      const [devid, provider] = key.split(':');
      return { devid: Number.parseInt(devid, 10) || devid, provider };
    }),
    devdescripts: Array.from(state.names),
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEYS.watchlist, JSON.stringify(payload));
}

export function useWatchlist() {
  const [state, setState] = useState<WatchlistState>(() => parseWatchlist());

  useEffect(() => {
    persistWatchlist(state);
  }, [state]);

  const isWatched = useCallback(
    (station: StationRecord) => {
      const hasDevice = station.devids.some((id) => state.deviceKeys.has(`${id}:${station.provider}`));
      if (hasDevice) return true;
      if (station.name && state.names.has(station.name)) return true;
      return false;
    },
    [state]
  );

  const toggleWatch = useCallback(
    (station: StationRecord) => {
      setState((prev) => {
        const next: WatchlistState = {
          deviceKeys: new Set(prev.deviceKeys),
          names: new Set(prev.names),
        };
        const deviceKeys = station.devids.map((id) => `${id}:${station.provider}`);
        const matched = deviceKeys.some((key) => next.deviceKeys.has(key)) || next.names.has(station.name);
        if (matched) {
          deviceKeys.forEach((key) => next.deviceKeys.delete(key));
          next.names.delete(station.name);
        } else {
          if (deviceKeys.length > 0) {
            deviceKeys.forEach((key) => next.deviceKeys.add(key));
          } else if (station.name) {
            next.names.add(station.name);
          }
        }
        return next;
      });
    },
    []
  );

  const reload = useCallback(() => {
    setState(parseWatchlist());
  }, []);

  const counts = useMemo(() => ({
    deviceCount: state.deviceKeys.size,
    nameCount: state.names.size,
  }), [state]);

  return { watchlist: state, isWatched, toggleWatch, reload, counts };
}
