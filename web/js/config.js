// 配置和常量

// localStorage 键名
const WATCHLIST_STORAGE_KEY = 'zju_charger_watchlist';
const THEME_STORAGE_KEY = 'zju_charger_theme';

// 校区配置
// 注意：坐标格式为 [经度, 纬度] (lng, lat)
const CAMPUS_CONFIG = {
    1: { name: "玉泉校区", center: [120.129265, 30.269646] },
    2: { name: "紫金港校区", center: [120.07707846383452,30.30430871105789] },
    3: { name: "华家池校区", center: [120.20209784840182,30.275736891986803] }
};

// 默认中心点：玉泉校区教三（BD-09 坐标，会自动转换为 GCJ-02）
const DEFAULT_CENTER = [120.129265, 30.269646];
const DEFAULT_ZOOM = 17; // 放大级别，便于查看充电桩位置

// 地图配置
const MAP_CONFIG = {
    dataCoordSystem: 'BD09',  // 数据源坐标系：'WGS84'、'GCJ02' 或 'BD09'
    webCoordSystem: 'GCJ02',  // 当前地图使用的坐标系：'WGS84'、'GCJ02' 或 'BD09'
    useMap: 'gaode'           // 当前使用的地图后端：'osm'、'gaode' 或 'tencent'
};

// 地图图层配置（使用 Leaflet.ChineseTmsProviders）
// 每个地图服务可以包含多个图层（如普通地图、卫星图、地形图等）
const MAP_LAYERS_CONFIG = {
    osm: {
        name: 'OpenStreetMap',
        coordSystem: 'WGS84',
        layers: {
            'OSM': 'OSM.Normal.Map'
        }
    },
    gaode: {
        name: '高德地图',
        coordSystem: 'GCJ02',
        layers: {
            '高德': 'GaoDe.Normal.Map',
            '高德影像': ['GaoDe.Satellite.Map', 'GaoDe.Satellite.Annotion']
        }
    },
    tencent: {
        name: '腾讯地图',
        coordSystem: 'GCJ02',
        layers: {
            '腾讯': 'Tencent.Normal.Map',
            '腾讯影像': 'Tencent.Satellite.Map'
        }
    }
};
