// 地图相关功能

// 地图和标记
let map = null;
let markers = [];
let currentLocationMarker = null; // 当前位置标记
let isFirstLoad = true; // 是否是首次加载数据

// 当前地图图层
let currentTileLayer = null;

// 所有底图图层
let baseLayers = {};

// 打印/下载插件实例
let printer = null;

// 服务商图层组
let providerLayerGroups = {}; // { providerId: L.layerGroup }
let layerControl = null; // Leaflet 图层控制器

// 坐标转换辅助函数
// 将数据源坐标系转换为地图使用的坐标系
function convertCoord(lat, lon) {
    const fromCoord = MAP_CONFIG.dataCoordSystem;
    const toCoord = MAP_CONFIG.webCoordSystem;
    
    // 如果坐标系相同，无需转换
    if (fromCoord === toCoord) {
        return [lat, lon];
    }
    
    // 定义转换函数映射表
    const convertFunctions = {
        'BD09->GCJ02': (lng, lat) => {
            if (typeof bd09ToGcj02 === 'function') {
                return bd09ToGcj02(lng, lat);
            }
            return [lng, lat];
        },
        'BD09->WGS84': (lng, lat) => {
            if (typeof bd09ToWgs84 === 'function') {
                return bd09ToWgs84(lng, lat);
            }
            return [lng, lat];
        },
        'GCJ02->BD09': (lng, lat) => {
            if (typeof gcj02ToBd09 === 'function') {
                return gcj02ToBd09(lng, lat);
            }
            return [lng, lat];
        },
        'GCJ02->WGS84': (lng, lat) => {
            if (typeof gcj02ToWgs84 === 'function') {
                return gcj02ToWgs84(lng, lat);
            }
            return [lng, lat];
        },
        'WGS84->BD09': (lng, lat) => {
            if (typeof wgs84ToBd09 === 'function') {
                return wgs84ToBd09(lng, lat);
            }
            return [lng, lat];
        },
        'WGS84->GCJ02': (lng, lat) => {
            if (typeof wgs84ToGcj02 === 'function') {
                return wgs84ToGcj02(lng, lat);
            }
            return [lng, lat];
        }
    };
    
    // 构建转换键
    const convertKey = `${fromCoord}->${toCoord}`;
    const convertFunc = convertFunctions[convertKey];
    
    if (convertFunc) {
        const result = convertFunc(lon, lat);
        return [result[1], result[0]]; // 返回 [lat, lng]
    }
    
    // 如果找不到转换函数，返回原坐标
    console.warn(`未找到坐标转换函数: ${convertKey}`);
    return [lat, lon];
}

// 更新图层控制器
function updateLayerControl() {
    // 构建图层组映射，用于图层控制器
    const overlayMaps = {};
    
    // 获取服务商名称映射
    const providerNameMap = {};
    if (availableProviders && availableProviders.length > 0) {
        availableProviders.forEach(provider => {
            providerNameMap[provider.id] = provider.name;
        });
    }
    
    // 为每个图层组创建显示名称
    Object.entries(providerLayerGroups).forEach(([providerId, layerGroup]) => {
        // 获取服务商名称，如果没有则使用 providerId
        const providerName = providerNameMap[providerId] || providerId || '未知服务商';
        overlayMaps[providerName] = layerGroup;
    });
    
    // 如果图层控制器已存在，先移除
    if (layerControl) {
        map.removeControl(layerControl);
    }
    
    // 创建新的图层控制器（包含底图和覆盖层）
    layerControl = L.control.layers(baseLayers, overlayMaps, {
        collapsed: true,
        position: 'topright'
    }).addTo(map);
}

// 初始化地图
function initMap() {
    // 如果地图已存在，先移除
    if (map) {
        map.remove();
    }
    
    // 根据当前选择的校区确定地图中心点
    let centerCoord = DEFAULT_CENTER;
    if (currentCampus && CAMPUS_CONFIG[currentCampus]) {
        centerCoord = CAMPUS_CONFIG[currentCampus].center;
    }
    
    // 转换中心点坐标
    const center = convertCoord(centerCoord[0], centerCoord[1]);
    
    // 获取默认地图配置
    const defaultMapConfig = MAP_LAYERS_CONFIG[MAP_CONFIG.useMap];
    
    // 创建地图实例
    const mapOptions = {
        center: center,
        zoom: DEFAULT_ZOOM
    };
    
    map = L.map('map', mapOptions);
    
    // 创建所有底图图层（使用 Leaflet.ChineseTmsProviders）
    baseLayers = {};
    
    Object.entries(MAP_LAYERS_CONFIG).forEach(([key, config]) => {
        Object.entries(config.layers).forEach(([layerName, layerConfig]) => {
            let layer;
            
            const layerOptions = {
                maxZoom: 18,
                minZoom: 5
            };
            
            // 如果 layerConfig 是数组，表示需要组合多个图层（如卫星图+标注）
            if (Array.isArray(layerConfig)) {
                const layerGroup = [];
                layerConfig.forEach(layerType => {
                    const tileLayer = L.tileLayer.chinaProvider(layerType, layerOptions);
                    layerGroup.push(tileLayer);
                });
                layer = L.layerGroup(layerGroup);
            } else {
                // 单个图层
                layer = L.tileLayer.chinaProvider(layerConfig, layerOptions);
            }
            
            // 直接使用图层名称（已包含服务商信息）
            baseLayers[layerName] = layer;
        });
    });
    
    // 添加默认地图图层
    const defaultLayerName = Object.keys(MAP_LAYERS_CONFIG[MAP_CONFIG.useMap].layers)[0];
    currentTileLayer = baseLayers[defaultLayerName];
    
    // 如果 currentTileLayer 是 L.layerGroup，需要获取第一个实际的 tileLayer 用于下载插件
    let actualTileLayer = currentTileLayer;
    if (currentTileLayer instanceof L.LayerGroup) {
        const layers = currentTileLayer.getLayers();
        if (layers.length > 0) {
            actualTileLayer = layers[0];
        }
    }
    
    currentTileLayer.addTo(map);
    
    // 初始化下载地图插件（隐藏默认控件，使用自定义按钮）
    if (typeof L.easyPrint !== 'undefined' && actualTileLayer) {
        printer = L.easyPrint({
            tileLayer: actualTileLayer,
            exportOnly: true,
            filename: 'ZJU-Charger-Map',
            sizeModes: ['Current'],
            hidden: true,  // 隐藏默认控件
            hideControlContainer: true
        }).addTo(map);
    }
    
    // 监听底图切换事件，更新 currentTileLayer 和下载插件
    function handleBaseLayerChange(e) {
        currentTileLayer = e.layer;
        
        // 从图层名称中查找对应的地图配置
        const layerName = e.name;
        let foundMapKey = null;
        
        for (const [key, config] of Object.entries(MAP_LAYERS_CONFIG)) {
            if (config.layers.hasOwnProperty(layerName)) {
                foundMapKey = key;
                break;
            }
        }
        
        if (foundMapKey) {
            MAP_CONFIG.useMap = foundMapKey;
            const provider = MAP_LAYERS_CONFIG[foundMapKey];
            MAP_CONFIG.webCoordSystem = provider.coordSystem;
        }
        
        // 获取实际的 tileLayer（用于下载插件）
        let actualTileLayer = currentTileLayer;
        if (currentTileLayer instanceof L.LayerGroup) {
            const layers = currentTileLayer.getLayers();
            if (layers.length > 0) {
                actualTileLayer = layers[0];
            }
        }
        
        // 如果当前位置标记存在，需要重新转换坐标
        if (currentLocationMarker) {
            map.removeLayer(currentLocationMarker);
            currentLocationMarker = null;
        }
        
        // 重新初始化下载地图插件
        if (printer) {
            map.removeControl(printer);
            printer = null;
        }
        if (typeof L.easyPrint !== 'undefined' && actualTileLayer) {
            printer = L.easyPrint({
                tileLayer: actualTileLayer,
                exportOnly: true,
                filename: 'ZJU-Charger-Map',
                sizeModes: ['Current'],
                hidden: true,
                hideControlContainer: true
            }).addTo(map);
        }
        
        // 重新渲染所有标记（因为坐标系改变了）
        if (window.currentStations && window.currentStations.length > 0) {
            const allStationsForMap = [...(window.currentStations || [])];
            if (window.allStationsDef && window.allStationsDef.length > 0) {
                const fetchedNames = new Set((window.currentStations || []).map(s => s.name));
                window.allStationsDef.forEach(def => {
                    const devdescript = def.devdescript || def.name;
                    if (!fetchedNames.has(devdescript)) {
                        const campusValue = def.campus_id ?? def.areaid ?? null;
                        allStationsForMap.push({
                            name: devdescript,
                            free: 0,
                            total: 0,
                            used: 0,
                            error: 0,
                            devids: def.devid ? [def.devid] : [],
                            provider: def.provider || 'unknown',
                            campus_id: campusValue != null ? campusValue.toString() : null,
                            lat: def.latitude,
                            lon: def.longitude,
                            isFetched: false
                        });
                    }
                });
            }
            renderMap(allStationsForMap, false);
        }
    }
    
    map.on('baselayerchange', handleBaseLayerChange);
    
    // 初始化图层控制器（即使还没有数据，也要显示底图选择）
    updateLayerControl();
}

function manualPrint() {
    if (!map) {
        console.error('地图未初始化');
        alert('地图未初始化，无法下载');
        return;
    }
    
    // 检查 printer 是否有效（是否仍然关联到当前地图）
    let needReinitPrinter = false;
    if (!printer) {
        needReinitPrinter = true;
    } else {
        // 检查 printer 是否仍然关联到当前地图
        try {
            // 尝试访问 printer 的内部地图对象
            if (!printer._map || printer._map !== map) {
                needReinitPrinter = true;
            }
        } catch (e) {
            // 如果访问失败，说明 printer 已无效
            needReinitPrinter = true;
        }
    }
    
    if (needReinitPrinter) {
        // 清除旧的 printer
        if (printer) {
            try {
                map.removeControl(printer);
            } catch (e) {
                // 忽略错误
            }
            printer = null;
        }
        
        // 获取实际的 tileLayer
        let actualTileLayer = currentTileLayer;
        if (currentTileLayer instanceof L.LayerGroup) {
            const layers = currentTileLayer.getLayers();
            if (layers.length > 0) {
                actualTileLayer = layers[0];
            }
        }
        
        // 尝试重新初始化打印机
        if (typeof L.easyPrint !== 'undefined' && actualTileLayer && map) {
            printer = L.easyPrint({
                tileLayer: actualTileLayer,
                exportOnly: true,
                filename: 'ZJU-Charger-Map',
                sizeModes: ['Current'],
                hidden: true,
                hideControlContainer: true
            }).addTo(map);
        } else {
            console.error('下载插件不可用');
            alert('下载功能不可用，请检查地图是否已加载');
            return;
        }
    }
    
    try {
        const filename = 'ZJU-Charger-Map-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        printer.printMap('CurrentSize', filename);
    } catch (error) {
        console.error('下载地图失败:', error);
        // 如果失败，尝试重新初始化 printer 并重试一次
        if (printer) {
            try {
                map.removeControl(printer);
            } catch (e) {
                // 忽略错误
            }
            printer = null;
            
            // 重新初始化并重试
            let actualTileLayer = currentTileLayer;
            if (currentTileLayer instanceof L.LayerGroup) {
                const layers = currentTileLayer.getLayers();
                if (layers.length > 0) {
                    actualTileLayer = layers[0];
                }
            }
            if (typeof L.easyPrint !== 'undefined' && actualTileLayer && map) {
                printer = L.easyPrint({
                    tileLayer: actualTileLayer,
                    exportOnly: true,
                    filename: 'ZJU-Charger-Map',
                    sizeModes: ['Current'],
                    hidden: true,
                    hideControlContainer: true
                }).addTo(map);
                printer.printMap('CurrentSize', filename);
            } else {
                alert('下载失败: ' + (error.message || '未知错误'));
            }
        } else {
            alert('下载失败: ' + (error.message || '未知错误'));
        }
    }
}

// 渲染地图
// allowFitBounds: 是否允许自动调整地图视野（true: 允许，false: 保持当前位置）
function renderMap(stations, allowFitBounds = false) {
    // 保存当前地图视图状态（中心点和缩放级别）
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    
    // 清除现有标记和图层组（只清除充电桩标记，保留当前位置标记）
    // 移除所有图层组
    Object.values(providerLayerGroups).forEach(layerGroup => {
        map.removeLayer(layerGroup);
        layerGroup.clearLayers();
    });
    providerLayerGroups = {};
    markers = [];
    
    // 按校区过滤（不再按服务商过滤，因为使用图层控制）
    let filteredStations = filterStationsByCampus(stations);
    
    // 服务商形状映射（用于区分不同服务商）
    const providerShapes = {
        'neptune': 'circle',  // 圆形
        // 可以添加更多服务商形状
        // 'provider2': 'triangle',  // 三角形
        // 'provider3': 'square',    // 正方形
    };
    
    // 创建不同形状的图标函数
    function createMarkerIcon(color, shape, number) {
        const size = 24;
        const borderWidth = 2;
        const borderColor = '#ffffff';
        const shadow = '0 2px 6px rgba(0,0,0,0.3)';
        
        let shapeStyle = '';
        
        switch(shape) {
            case 'triangle':
                // 三角形（使用clip-path）
                shapeStyle = `
                    width: ${size}px;
                    height: ${size}px;
                    background-color: ${color};
                    clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding-top: 2px;
                `;
                break;
            case 'square':
                // 正方形
                shapeStyle = `
                    width: ${size}px;
                    height: ${size}px;
                    background-color: ${color};
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;
                break;
            case 'circle':
            default:
                // 圆形（默认）
                shapeStyle = `
                    width: ${size}px;
                    height: ${size}px;
                    background-color: ${color};
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;
                break;
        }
        
        return `
            <div style="
                ${shapeStyle}
                border: ${borderWidth}px solid ${borderColor};
                color: white;
                font-weight: bold;
                font-size: 11px;
                box-shadow: ${shadow};
                position: relative;
            ">
                <span>${number}</span>
            </div>
        `;
    }
    
    // 按服务商分组站点
    const stationsByProvider = {};
    filteredStations.forEach(station => {
        const providerId = station.provider || 'unknown';
        const providerName = station.provider || '未知服务商';
        
        if (!stationsByProvider[providerId]) {
            stationsByProvider[providerId] = {
                providerId: providerId,
                providerName: providerName,
                stations: []
            };
        }
        stationsByProvider[providerId].stations.push(station);
    });
    
    // 为每个服务商创建图层组
    Object.values(stationsByProvider).forEach(providerData => {
        const { providerId, providerName, stations } = providerData;
        
        // 创建图层组
        const layerGroup = L.layerGroup();
        providerLayerGroups[providerId] = layerGroup;
        
        // 为每个站点创建标记并添加到图层组
        stations.forEach(station => {
            const { name, lat, lon, free, total, isFetched } = station;
            
            // 如果没有坐标，跳过
            if (!lat || !lon) {
                return;
            }
            
            // 坐标转换
            const [markerLat, markerLon] = convertCoord(lat, lon);
            
            // 根据空闲数量选择颜色（统一的颜色方案）
            let color = '#10b981'; // 绿色：有空闲（更柔和的绿色）
            if (isFetched === false) {
                color = '#9ca3af'; // 灰色：未抓取到
            } else if (free === 0) {
                color = '#ef4444'; // 红色：无空闲
            } else if (free <= 2) {
                color = '#f59e0b'; // 橙色：少量空闲
            }
            
            // 获取服务商对应的形状
            const shape = providerShapes[providerId] || 'circle';
            
            // 创建带数字的自定义图标（使用不同形状）
            const displayNumber = isFetched === false ? '?' : free;
            const iconHtml = createMarkerIcon(color, shape, displayNumber);
            
            const customIcon = L.divIcon({
                html: iconHtml,
                className: '',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            
            // 创建标记并添加到图层组
            const marker = L.marker([markerLat, markerLon], {
                icon: customIcon
            });
            
            // 添加弹出窗口（显示服务商信息）
            if (isFetched === false) {
                marker.bindPopup(`
                    <div style="text-align: center; min-width: 120px;">
                        <strong style="font-size: 14px;">${name}</strong><br>
                        <span style="font-size: 11px; color: #6b7280;">${providerName || providerId}</span><br>
                        <span style="font-size: 13px; margin-top: 4px; display: inline-block; color: #9ca3af;">
                            未抓取到数据
                        </span>
                    </div>
                `);
            } else {
                const freeColor = free === 0 ? '#ef4444' : '#10b981';
                marker.bindPopup(`
                    <div style="text-align: center; min-width: 120px;">
                        <strong style="font-size: 14px;">${name}</strong><br>
                        <span style="font-size: 11px; color: #6b7280;">${providerName || providerId}</span><br>
                        <span style="font-size: 13px; margin-top: 4px; display: inline-block;">
                            可用: <span style="color: ${freeColor}; font-weight: bold;">${free}</span> / ${total}
                        </span>
                    </div>
                `);
            }
            
            marker.addTo(layerGroup);
            markers.push(marker);
        });
        
        // 将图层组添加到地图（默认全部显示）
        layerGroup.addTo(map);
    });
    
    // 更新图层控制器
    updateLayerControl();
    
    // 根据 allowFitBounds 参数决定是否调整地图视野
    if (allowFitBounds || isFirstLoad) {
        // 允许调整视野：首次加载或主动切换校区/服务商时
        if (markers.length > 0) {
            const group = new L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.1));
        } else if (currentCampus && CAMPUS_CONFIG[currentCampus]) {
            // 如果没有标记但选择了校区，定位到校区中心
            const campus = CAMPUS_CONFIG[currentCampus];
            const center = convertCoord(campus.center[0], campus.center[1]);
            map.setView(center, DEFAULT_ZOOM);
        }
        if (isFirstLoad) {
            isFirstLoad = false;
        }
    } else {
        // 不允许调整视野：数据刷新时保持用户当前的地图位置和缩放级别
        map.setView(currentCenter, currentZoom);
    }
}
