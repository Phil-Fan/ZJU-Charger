export interface AMapMarkerOptions {
  position: [number, number];
  bubble?: boolean;
}

export interface AMapMarker {
  setMap?: (map: unknown) => void;
}

export interface AMapMap {
  setZoom: (zoom: number) => void;
  setCenter: (center: [number, number]) => void;
  add: (marker: AMapMarker) => void;
  remove: (marker: AMapMarker) => void;
}

export interface AMapNamespace {
  Marker: new (options: AMapMarkerOptions) => AMapMarker;
}

declare global {
  interface Window {
    AMap?: AMapNamespace;
  }
}

let loadPromise: Promise<AMapNamespace> | null = null;

export function loadAmap(key?: string, version = '2.0'): Promise<AMapNamespace> {
  if (window.AMap) {
    return Promise.resolve(window.AMap);
  }
  if (loadPromise) {
    return loadPromise;
  }
  if (!key) {
    return Promise.reject(new Error('Missing VITE_AMAP_KEY env.'));
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'amap-sdk';
    script.type = 'text/javascript';
    script.async = true;
    script.src = `https://webapi.amap.com/maps?v=${version}&key=${key}`;
    script.onload = () => {
      if (window.AMap) {
        resolve(window.AMap);
      } else {
        reject(new Error('AMap failed to initialize.'));
      }
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return loadPromise;
}
