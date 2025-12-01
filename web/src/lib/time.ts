import { NIGHT_WINDOW } from '@/config';

export function formatTimestamp(value?: string | null): string {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}:${ss}`;
}

export function isNightTime(date = new Date()): boolean {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= NIGHT_WINDOW.startMinutes && minutes <= NIGHT_WINDOW.endMinutes;
}

export function minutesBetween(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  const first = new Date(a).getTime();
  const second = new Date(b).getTime();
  if (Number.isNaN(first) || Number.isNaN(second)) return null;
  return Math.abs(first - second) / 1000 / 60;
}
