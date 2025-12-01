export type CampusId = '' | '1' | '2' | '3';

export interface ProviderInfo {
  id: string;
  name: string;
}

export interface RawStation {
  hash_id?: string;
  id?: string;
  name?: string;
  devdescript?: string;
  devid?: string;
  devids?: Array<string | number>;
  provider?: string;
  campus?: string | number;
  campus_id?: string | number;
  areaid?: string | number;
  areaId?: string | number;
  campus_name?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lon?: number;
  lng?: number;
  free?: number;
  used?: number;
  total?: number;
  error?: number;
  isFetched?: boolean;
}

export interface StationRecord {
  hashId: string;
  name: string;
  provider: string;
  campusId: CampusId;
  campusName?: string;
  latitude: number | null;
  longitude: number | null;
  free: number;
  used: number;
  total: number;
  error: number;
  devids: string[];
  isFetched: boolean;
}

export interface StatusResponse {
  updated_at: string;
  stations: RawStation[];
}

export interface StationsResponse {
  updated_at?: string;
  stations: RawStation[];
}

export interface ConfigResponse {
  fetch_interval?: number;
}
