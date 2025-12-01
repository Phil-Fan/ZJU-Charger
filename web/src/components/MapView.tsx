import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts';
import 'echarts-extension-amap';
import type { EChartsOption } from 'echarts';
import type { CampusId, StationRecord } from '@/types/station';
import { CAMPUS_MAP, AMAP_DEFAULT_CENTER } from '@/config';
import { loadAmap } from '@/lib/amap';
import type { AMapMap, AMapMarker } from '@/lib/amap';
import { wgs84ToGcj02 } from '@/lib/geo';
import type { ScatterSeriesOption, TooltipComponentOption } from 'echarts';
import type { CallbackDataParams, TopLevelFormatterParams } from 'echarts/types/dist/shared';

interface MapViewProps {
  stations: StationRecord[];
  campusId: CampusId;
  theme: 'light' | 'dark';
  focusStation?: StationRecord | null;
}

function getStationColor(station: StationRecord): string {
  if (station.error > 0) return '#f87171';
  if (station.free === 0) return '#fb923c';
  return '#34d399';
}

type MapDataPoint = {
  name: string;
  value: [number, number, number, number];
  station: StationRecord;
};

type TooltipParams = {
  data?: MapDataPoint | null;
  name?: string;
};

const buildAmapNavUrl = (station: StationRecord) =>
  `https://uri.amap.com/navigation?to=${station.longitude},${station.latitude},${encodeURIComponent(station.name)}&mode=car&src=zju-charger`;

const buildSystemNavUrl = (station: StationRecord) =>
  `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}&travelmode=driving`;

export function MapView({ stations, campusId, theme, focusStation }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chart, setChart] = useState<echarts.ECharts | null>(null);
  const [amapReady, setAmapReady] = useState<boolean>(Boolean(window.AMap));
  const amapKey = import.meta.env.VITE_AMAP_KEY as string | undefined;
  const [navTarget, setNavTarget] = useState<StationRecord | null>(null);

  const dataPoints = useMemo<MapDataPoint[]>(
    () =>
      stations
        .filter((station) => station.longitude !== null && station.latitude !== null)
        .map((station) => ({
          name: station.name,
          value: [station.longitude as number, station.latitude as number, station.free, station.total],
          station,
        })),
    [stations]
  );

  useEffect(() => {
    if (!amapKey) return;
    let disposed = false;
    let instance: echarts.ECharts | null = null;
    let resizeHandler: (() => void) | null = null;

    loadAmap(amapKey)
      .then(() => {
        if (!containerRef.current || disposed) return;
        instance = echarts.init(containerRef.current);
        setChart(instance);
        setAmapReady(true);
        resizeHandler = () => instance?.resize();
        window.addEventListener('resize', resizeHandler);
      })
      .catch((error) => {
        console.error('AMap 初始化失败', error);
      });

    return () => {
      disposed = true;
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
      instance?.dispose();
    };
  }, [amapKey]);

  useEffect(() => {
    if (!chart || !amapReady) return;
    const campus = campusId ? CAMPUS_MAP[campusId] : null;
    const center = campus?.center ?? AMAP_DEFAULT_CENTER;
    let zoom = campusId ? 15 : 13;
    if (campusId === '2') {
      zoom = 14;
    }

    const tooltipOption: TooltipComponentOption = {
      trigger: 'item',
      formatter: (params: TopLevelFormatterParams) => {
        const payload = params as TooltipParams;
        const station = payload.data?.station ?? undefined;
        const name = (params as { name?: string }).name;
        if (!station) return name ?? '';
        const amapLink = buildAmapNavUrl(station);
        const sysLink = buildSystemNavUrl(station);
        return `
          <div style="min-width: 180px">
            <strong>${station.name}</strong><br/>
            校区：${station.campusName || '未分配'}<br/>
            服务商：${station.provider}<br/>
            空闲：${station.free} / 总数：${station.total}<br/>
            故障：${station.error}<br/>
            <div style="margin-top:6px;font-size:12px;">
              导航：<a href="${amapLink}" target="_blank" rel="noopener">高德</a>
              &nbsp;|&nbsp;
              <a href="${sysLink}" target="_blank" rel="noopener">系统地图</a>
            </div>
          </div>
        `;
      },
    };

    const scatterSeries: ScatterSeriesOption = {
      name: '站点',
      type: 'scatter',
      coordinateSystem: 'amap',
      data: dataPoints,
      symbolSize: (rawParams: CallbackDataParams) => {
        const params = rawParams as TooltipParams;
        const free = params.data?.station?.free ?? 0;
        if (free > 8) return 30;
        if (free > 4) return 26;
        return 22;
      },
      itemStyle: {
        color: (rawParams: CallbackDataParams) => {
          const params = rawParams as TooltipParams;
          const station = params.data?.station ?? undefined;
          return station ? getStationColor(station) : '#60a5fa';
        },
        borderColor: '#ffffff',
        borderWidth: 2,
      },
      label: {
        show: true,
        formatter: (rawParams: CallbackDataParams) => {
          const params = rawParams as TooltipParams;
          return `${params.data?.station?.free ?? 0}`;
        },
        position: 'inside',
        color: '#ffffff',
        fontWeight: 'bold',
      },
    };

    const option: EChartsOption = {
      amap: {
        viewMode: '2D',
        zoom,
        resizeEnable: true,
        center,
        mapStyle: theme === 'dark' ? 'amap://styles/dark' : 'amap://styles/normal',
        features: ['bg', 'road', 'building', 'point'],
      },
      tooltip: tooltipOption,
      series: [scatterSeries],
    };

    chart.setOption(option, true);
  }, [chart, dataPoints, campusId, amapReady, theme]);

  const getAmap = useCallback((): AMapMap | null => {
    if (!chart) return null;
    const model = (chart as unknown as { getModel: () => { getComponent: (name: string) => { getAMap?: () => AMapMap | null } | null } }).getModel();
    const component = model.getComponent('amap');
    return component?.getAMap?.() ?? null;
  }, [chart]);

  const handleLocate = useCallback(() => {
    const amap = getAmap();
    if (!amap || !navigator.geolocation || !window.AMap?.Marker) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        const [lng, lat] = wgs84ToGcj02(longitude, latitude);
        amap.setZoom(17);
        amap.setCenter([lng, lat]);
        const MarkerCtor = window.AMap?.Marker;
        if (!MarkerCtor) return;
        const marker: AMapMarker = new MarkerCtor({ position: [lng, lat], bubble: true });
        amap.add(marker);
        setTimeout(() => {
          amap.remove(marker);
        }, 10000);
      },
      (error) => console.warn('定位失败', error),
      { enableHighAccuracy: true }
    );
  }, [getAmap]);

  useEffect(() => {
    const amap = getAmap();
    if (!amap) return;

    if (focusStation && focusStation.longitude !== null && focusStation.latitude !== null) {
      amap.setZoom(17);
      amap.setCenter([focusStation.longitude, focusStation.latitude]);
      return;
    }

    const filtered = stations.filter((station) => station.longitude !== null && station.latitude !== null);
    if (filtered.length === 0) return;

    const campusFiltered = campusId
      ? filtered.filter((station) => station.campusId === campusId)
      : filtered;
    const dataset = campusFiltered.length > 0 ? campusFiltered : filtered;

    const bounds = dataset.reduce(
      (acc, station) => {
        const lng = station.longitude as number;
        const lat = station.latitude as number;
        acc.sw[0] = Math.min(acc.sw[0], lng);
        acc.sw[1] = Math.min(acc.sw[1], lat);
        acc.ne[0] = Math.max(acc.ne[0], lng);
        acc.ne[1] = Math.max(acc.ne[1], lat);
        return acc;
      },
      { sw: [Infinity, Infinity] as [number, number], ne: [-Infinity, -Infinity] as [number, number] }
    );

    if (!Number.isFinite(bounds.sw[0]) || !Number.isFinite(bounds.ne[0])) return;

    const centerLng = (bounds.sw[0] + bounds.ne[0]) / 2;
    const centerLat = (bounds.sw[1] + bounds.ne[1]) / 2;
    const radiusLng = bounds.ne[0] - bounds.sw[0];
    const radiusLat = bounds.ne[1] - bounds.sw[1];
    const span = Math.max(radiusLng, radiusLat);
    const zoom = span > 0.3 ? 12 : span > 0.15 ? 13 : span > 0.08 ? 15 : 16;

    amap.setZoom(zoom);
    amap.setCenter([centerLng, centerLat]);
  }, [focusStation, stations, campusId, getAmap]);

  useEffect(() => {
    if (!chart) return;
    const handler = (params: CallbackDataParams) => {
      const point = params as TooltipParams;
      if (point.data?.station) {
        setNavTarget(point.data.station);
      }
    };
    chart.on('dblclick', handler);
    return () => {
      chart.off('dblclick', handler);
    };
  }, [chart]);

  if (!amapKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-sm text-gray-500 dark:text-gray-400 p-6">
        <p>缺少 AMap Key（设置 VITE_AMAP_KEY 环境变量）</p>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-[50vh] lg:min-h-0">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          className="px-3 py-2 rounded-md bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 shadow"
          onClick={handleLocate}
        >
          定位
        </button>
      </div>
      {navTarget && (
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 w-64">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">导航到 {navTarget.name}</p>
            <button className="text-xs text-gray-500 hover:text-gray-800" onClick={() => setNavTarget(null)}>
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <button
              className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => window.open(buildAmapNavUrl(navTarget), '_blank')}
            >
              高德地图导航
            </button>
            <button
              className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={() => window.open(buildSystemNavUrl(navTarget), '_blank')}
            >
              系统/Google 地图
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
