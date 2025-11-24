# 地图坐标系配置说明

## 问题背景

Leaflet 默认使用 WGS-84 坐标系，而国内地图服务（高德、百度、腾讯等）使用 GCJ-02 坐标系（火星坐标系）。直接使用会导致地图位置偏移。

## 解决方案

本项目已集成 GCJ-02 坐标系支持，使用高德地图瓦片服务，并自动处理坐标转换。

## 配置说明

在 `script.js` 中的 `MAP_CONFIG` 对象可以配置：

```javascript
const MAP_CONFIG = {
    useGcj02: false,       // 是否使用 GCJ-02 坐标系（高德地图需要）
    useGaodeMap: false,    // 是否使用高德地图（需要 API key）
    dataCoordSystem: 'WGS84' // 数据源坐标系：'WGS84' 或 'GCJ02'
};
```

### 参数说明

- **useGcj02**:
  - `true`: 使用 GCJ-02 坐标系（需要配合高德地图）
  - `false`: 使用 WGS-84 坐标系，显示 OpenStreetMap（默认，无需 API）

- **useGaodeMap**:
  - `true`: 使用高德地图瓦片服务（需要 API key）
  - `false`: 使用 OpenStreetMap（默认，免费）

- **dataCoordSystem**:
  - `'WGS84'`: API 返回的坐标是 WGS-84 格式（默认，OpenStreetMap 使用）
  - `'GCJ02'`: API 返回的坐标是 GCJ-02 格式（会自动转换为 WGS-84）

## 使用场景

### 场景 1：使用 OpenStreetMap + WGS-84 坐标（默认配置，推荐）

```javascript
const MAP_CONFIG = {
    useGcj02: false,
    useGaodeMap: false,
    dataCoordSystem: 'WGS84'
};
```

适用于：大多数情况，无需 API key，免费使用。

### 场景 2：使用 OpenStreetMap + GCJ-02 坐标

```javascript
const MAP_CONFIG = {
    useGcj02: false,
    useGaodeMap: false,
    dataCoordSystem: 'GCJ02'
};
```

适用于：API 返回 GCJ-02 坐标，但想使用 OpenStreetMap（会自动转换）。

### 场景 3：使用高德地图 + GCJ-02 坐标（需要 API key）

```javascript
const MAP_CONFIG = {
    useGcj02: true,
    useGaodeMap: true,
    dataCoordSystem: 'GCJ02'
};
```

适用于：有高德地图 API key，需要国内地图服务。

## 技术实现

### 1. GCJ-02 坐标系定义

在 `leaflet-gcj02.js` 中定义了：
    - `L.CRS.GCJ02`: GCJ-02 坐标参考系统
    - `L.TileLayer.Gaode`: 高德地图瓦片图层

### 2. 坐标转换函数

- `wgs84ToGcj02(lng, lat)`: WGS-84 转 GCJ-02
- `gcj02ToWgs84(lng, lat)`: GCJ-02 转 WGS-84

### 3. 自动转换

`convertCoord(lat, lon)` 函数会根据配置自动处理坐标转换。

## 地图服务商

### 高德地图（当前使用）

- 瓦片 URL: `https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}`
- 坐标系: GCJ-02
- 优点: 国内访问速度快，中文标注完整
- 限制: 需要遵守高德地图使用条款

### OpenStreetMap（备用）

- 瓦片 URL: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- 坐标系: WGS-84
- 优点: 开源免费，全球通用
- 缺点: 国内访问可能较慢

## 验证方法

1. 打开浏览器开发者工具（F12）
2. 访问页面：`http://localhost:8000/web/`
3. 检查地图标记是否与真实位置对齐
4. 如果位置偏移，调整 `dataCoordSystem` 参数

## 常见问题

### Q: 地图标记位置不准确？

A: 检查 `dataCoordSystem` 设置是否正确。如果 API 返回的是 GCJ-02，设置为 `'GCJ02'`；如果是 WGS-84，设置为 `'WGS84'`。

### Q: 如何切换到其他地图服务？

A: 修改 `initMap()` 函数中的瓦片图层 URL，参考高德地图的实现方式。

### Q: 坐标转换精度如何？

A: 转换算法精度在 10-50 米范围内，对于城市级地图展示足够准确。

## 参考资料

- [Leaflet 官方文档](https://leafletjs.com/)
- [GCJ-02 坐标系说明](https://en.wikipedia.org/wiki/Restrictions_on_geographic_data_in_China)
- [高德地图开放平台](https://lbs.amap.com/)
