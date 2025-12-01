import type { CampusId, ConfigResponse, ProviderInfo, RawStation, StationRecord, StationsResponse, StatusResponse } from '@/types/station';
import { CAMPUS_MAP } from '@/config';
import { ensureGcj02 } from '@/lib/geo';

export class RateLimitError extends Error {
  constructor(message = '请求过于频繁，请稍后再试') {
    super(message);
    this.name = 'RateLimitError';
  }
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 429) {
    throw new RateLimitError();
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || '请求失败');
  }

  return response.json() as Promise<T>;
}

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
function withBase(path: string) {
  if (!API_BASE) return path;
  return `${API_BASE}${path}`;
}

export async function fetchProviders() {
  return request<ProviderInfo[]>(withBase('/api/providers'));
}

export async function fetchConfig(): Promise<number> {
  const data = await request<ConfigResponse>(withBase('/api/config'));
  return data.fetch_interval ?? 60;
}

export async function fetchStatus(provider?: string): Promise<StatusResponse> {
  const url = provider ? withBase(`/api/status?provider=${encodeURIComponent(provider)}`) : withBase('/api/status');
  return request<StatusResponse>(url);
}

export async function fetchStationsMetadata(): Promise<StationsResponse> {
  return request<StationsResponse>(withBase('/api/stations'));
}

function pickNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function pickString(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

export function normalizeStation(raw: RawStation, options?: { fetched?: boolean }): StationRecord {
  const hashId = pickString(raw.hash_id);
  const name = pickString(raw.name);
  const provider = pickString(raw.provider || 'unknown');
  const campusCandidate = raw.campus_id;
  const campusIdValue = campusCandidate ? pickString(campusCandidate) : '';
  const campusConfig = CAMPUS_MAP[campusIdValue] ?? CAMPUS_MAP[''];
  const campusName = raw.campus_name || campusConfig?.name;

  const rawLat = pickNumber(raw.lat);
  const rawLng = pickNumber(raw.lon);
  const [longitude, latitude] = ensureGcj02(rawLng, rawLat);

  const devids = Array.isArray(raw.devids)
    ? raw.devids.map((d) => pickString(d))
    : raw.devid
      ? [pickString(raw.devid)]
      : [];

  const campusIdNormalized = (campusIdValue || '') as CampusId;

  const record: StationRecord = {
    hashId,
    name,
    provider,
    campusId: campusIdNormalized,
    campusName,
    latitude,
    longitude,
    free: pickNumber(raw.free) ?? 0,
    used: pickNumber(raw.used) ?? 0,
    total: pickNumber(raw.total) ?? 0,
    error: pickNumber(raw.error) ?? 0,
    devids,
    isFetched: options?.fetched ?? Boolean(raw.isFetched ?? true),
  };

  return record;
}

export function mergeStations(liveStations: RawStation[], metadataStations: RawStation[]): StationRecord[] {
  const merged: StationRecord[] = [];
  const seen = new Set<string>();

  liveStations.forEach((station) => {
    const normalized = normalizeStation(station, { fetched: true });
    if (!normalized.hashId) return;
    seen.add(normalized.hashId);
    merged.push(normalized);
  });

  metadataStations.forEach((station) => {
    const normalized = normalizeStation(
      { ...station, free: station.free ?? 0, total: station.total ?? 0 },
      { fetched: false }
    );
    if (!normalized.hashId || seen.has(normalized.hashId)) {
      return;
    }
    merged.push(normalized);
  });

  return merged;
}
