import { useEffect, useState } from 'react';
import { fetchConfig } from '@/services/api';
import { DEFAULT_FETCH_INTERVAL } from '@/config';

export function useConfig() {
  const [intervalSeconds, setIntervalSeconds] = useState(DEFAULT_FETCH_INTERVAL);

  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      try {
        const seconds = await fetchConfig();
        if (!cancelled && seconds > 0) {
          setIntervalSeconds(seconds);
        }
      } catch (error) {
        console.warn('加载配置失败，使用默认刷新频率', error);
      }
    }
    loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  return intervalSeconds;
}
