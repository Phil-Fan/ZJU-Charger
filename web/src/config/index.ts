import type { CampusId } from '@/types/station';

export interface CampusConfig {
  id: CampusId;
  name: string;
  center: [number, number]; // [lng, lat]
}

export const AMAP_DEFAULT_CENTER: [number, number] = [120.129265, 30.269646];

export const CAMPUS_LIST: CampusConfig[] = [
  { id: '1', name: '玉泉校区', center: [120.129265, 30.269646] },
  { id: '2', name: '紫金港校区', center: [120.07707846383452, 30.30430871105789] },
  { id: '3', name: '华家池校区', center: [120.20209784840182, 30.275736891986803] },
];

type CampusLookup = Record<string, CampusConfig>;

export const CAMPUS_MAP: CampusLookup = CAMPUS_LIST.reduce<CampusLookup>(
  (acc, campus) => {
    acc[campus.id] = campus;
    return acc;
  },
  { '': { id: '' as CampusId, name: '全部校区', center: AMAP_DEFAULT_CENTER } }
);

export const DEFAULT_CAMPUS_ID: CampusId = '';
export const STORAGE_KEYS = {
  watchlist: 'zju_charger_watchlist',
  theme: 'zju_charger_theme',
} as const;

export const DEFAULT_FETCH_INTERVAL = 60;
export const NIGHT_WINDOW = { startMinutes: 10, endMinutes: 350 } as const;
