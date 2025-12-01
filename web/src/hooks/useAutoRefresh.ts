import { useEffect } from 'react';

export function useAutoRefresh(callback: () => void | Promise<void>, intervalSeconds: number) {
  useEffect(() => {
    if (!intervalSeconds || intervalSeconds <= 0) return undefined;
    const id = window.setInterval(() => {
      callback();
    }, intervalSeconds * 1000);
    return () => window.clearInterval(id);
  }, [callback, intervalSeconds]);
}
