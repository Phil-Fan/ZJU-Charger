// 地图和标记
let map = null;
let markers = [];

// 当前选中的校区 areaid（空字符串表示全部）
let currentAreaId = "";

// 关注列表（devid 和 devdescript 集合）
let watchlistDevids = new Set();
let watchlistDevdescripts = new Set();

// 校区配置
const CAMPUS_CONFIG = {
    2143: { name: "玉泉校区", center: [30.27, 120.12] },
    1774: { name: "紫金港校区", center: [30.299196, 120.089946] }
};

// 默认中心点：玉泉校区（BD-09 坐标，会自动转换为 WGS-84）
const DEFAULT_CENTER = [30.27, 120.12];
const DEFAULT_ZOOM = 15;

// 地图配置
const MAP_CONFIG = {
    useGcj02: false,      // 是否使用 GCJ-02 坐标系（false = 使用 WGS-84，OpenStreetMap）
    useGaodeMap: false,   // 是否使用高德地图（需要 API key）
    dataCoordSystem: 'BD09' // 数据源坐标系：'WGS84'、'GCJ02' 或 'BD09'
    // 数据源坐标是 BD-09 格式（百度坐标系），会自动转换为 WGS-84（OpenStreetMap 使用）
};

// 坐标转换辅助函数
function convertCoord(lat, lon) {
    const coordSystem = MAP_CONFIG.dataCoordSystem;
    const useGcj02 = MAP_CONFIG.useGcj02;
    
    // BD-09 转 GCJ-02（地图使用 GCJ-02）
    if (useGcj02 && coordSystem === 'BD09' && typeof bd09ToGcj02 === 'function') {
        const gcj02 = bd09ToGcj02(lon, lat);
        return [gcj02[1], gcj02[0]]; // 返回 [lat, lng]
    }
    
    // BD-09 转 WGS-84（地图使用 WGS-84）
    if (!useGcj02 && coordSystem === 'BD09' && typeof bd09ToWgs84 === 'function') {
        const wgs84 = bd09ToWgs84(lon, lat);
        return [wgs84[1], wgs84[0]]; // 返回 [lat, lng]
    }
    
    // GCJ-02 转 WGS-84（地图使用 WGS-84）
    if (!useGcj02 && coordSystem === 'GCJ02' && typeof gcj02ToWgs84 === 'function') {
        const wgs84 = gcj02ToWgs84(lon, lat);
        return [wgs84[1], wgs84[0]]; // 返回 [lat, lng]
    }
    
    // WGS-84 转 GCJ-02（地图使用 GCJ-02）
    if (useGcj02 && coordSystem === 'WGS84' && typeof wgs84ToGcj02 === 'function') {
        const gcj02 = wgs84ToGcj02(lon, lat);
        return [gcj02[1], gcj02[0]]; // 返回 [lat, lng]
    }
    
    // 无需转换
    return [lat, lon];
}

// 初始化地图
function initMap() {
    // 转换中心点坐标
    const center = convertCoord(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
    
    // 创建地图实例
    if (MAP_CONFIG.useGcj02 && MAP_CONFIG.useGaodeMap && L.CRS.GCJ02) {
        // 使用 GCJ-02 坐标系 + 高德地图
        map = L.map('map', {
            crs: L.CRS.GCJ02,
            center: center,
            zoom: DEFAULT_ZOOM
        });
        
        // 添加高德地图图层（需要 API key）
        L.tileLayer.gaode('https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}', {
            subdomains: ['1', '2', '3', '4'],
            attribution: '© 高德地图',
            maxZoom: 18
        }).addTo(map);
    } else {
        // 使用标准 WGS-84 坐标系（OpenStreetMap）- 默认选项
        map = L.map('map').setView(center, DEFAULT_ZOOM);
        
        // 添加 OpenStreetMap 图层
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);
    }
}

// 获取关注列表
async function fetchWatchlist() {
    try {
        const response = await fetch('/api/watchlist/list');
        if (response.ok) {
            const data = await response.json();
            // 将 devid 列表转换为 Set（确保类型一致，使用数字）
            watchlistDevids = new Set((data.devids || []).map(d => parseInt(d)));
            // 将 devdescript 列表转换为 Set
            watchlistDevdescripts = new Set(data.devdescripts || []);
            return true;
        }
    } catch (error) {
        console.error('获取关注列表失败:', error);
    }
    return false;
}

// 检查是否已关注
function isWatched(devids, devdescript) {
    // 检查 devid
    if (devids && devids.length > 0) {
        const hasDevid = devids.some(devid => watchlistDevids.has(parseInt(devid)));
        if (hasDevid) return true;
    }
    // 检查 devdescript
    if (devdescript && watchlistDevdescripts.has(devdescript)) {
        return true;
    }
    return false;
}

// 切换关注状态
async function toggleWatchlist(devids, devdescript) {
    const currentlyWatched = isWatched(devids, devdescript);
    
    try {
        let response;
        const requestBody = {};
        if (devids && devids.length > 0) {
            requestBody.devids = Array.isArray(devids) ? devids : [devids];
        }
        if (devdescript) {
            requestBody.devdescripts = [devdescript];
        }
        
        if (currentlyWatched) {
            // 移除关注
            response = await fetch('/api/watchlist', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
        } else {
            // 添加关注
            response = await fetch('/api/watchlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
        }
        
        if (response.ok) {
            const result = await response.json();
            if (result.success !== false) {
                // 更新本地关注列表
                if (currentlyWatched) {
                    // 移除
                    if (devids && devids.length > 0) {
                        devids.forEach(devid => watchlistDevids.delete(parseInt(devid)));
                    }
                    if (devdescript) {
                        watchlistDevdescripts.delete(devdescript);
                    }
                } else {
                    // 添加
                    if (devids && devids.length > 0) {
                        devids.forEach(devid => watchlistDevids.add(parseInt(devid)));
                    }
                    if (devdescript) {
                        watchlistDevdescripts.add(devdescript);
                    }
                }
                // 重新渲染列表以更新小红心状态
                if (window.currentStations) {
                    renderList(window.currentStations);
                }
                return true;
            } else {
                console.warn('操作失败:', result.message);
                return false;
            }
        } else {
            const error = await response.json();
            console.error('操作失败:', error.detail || '未知错误');
            alert(`操作失败: ${error.detail || '未知错误'}`);
            return false;
        }
    } catch (error) {
        console.error('切换关注状态失败:', error);
        alert(`操作失败: ${error.message}`);
        return false;
    }
}

// 获取站点状态
async function fetchStatus() {
    const loadingEl = document.getElementById('loading');
    const listEl = document.getElementById('station-list');
    
    loadingEl.style.display = 'block';
    listEl.innerHTML = '';
    
    try {
        // 先尝试调用 API
        let data;
        try {
            const response = await fetch('/api/status');
            if (response.ok) {
                data = await response.json();
            } else {
                throw new Error('API 调用失败');
            }
        } catch (error) {
            // Fallback 到静态文件
            console.log('API 调用失败，尝试加载缓存数据...', error);
            const response = await fetch('/data/latest.json');
            if (response.ok) {
                data = await response.json();
            } else {
                throw new Error('无法加载数据');
            }
        }
        
        if (data && data.stations) {
            if (data.stations.length === 0) {
                // 数据为空，显示提示
                const listEl = document.getElementById('station-list');
                listEl.innerHTML = `
                    <div class="error-message">
                        <p>暂无站点数据</p>
                        <p style="font-size: 12px; margin-top: 8px;">请确保已配置 OPENID 并成功抓取数据</p>
                        <p style="font-size: 12px; margin-top: 4px;">如果服务器正在运行，请检查控制台错误信息</p>
                    </div>
                `;
                updateTime(data.updated_at || '未知');
            } else {
                // 保存当前数据供校区切换使用
                window.currentStations = data.stations;
                renderMap(data.stations);
                renderList(data.stations);
                updateTime(data.updated_at);
            }
        } else {
            throw new Error('数据格式错误：缺少 stations 字段');
        }
    } catch (error) {
        console.error('获取数据失败:', error);
        listEl.innerHTML = `
            <div class="error-message">
                <p>加载数据失败</p>
                <p style="font-size: 12px; margin-top: 8px;">${error.message}</p>
                <p style="font-size: 12px; margin-top: 8px; color: #666;">
                    请检查：<br>
                    1. 服务器是否正在运行<br>
                    2. OPENID 环境变量是否已配置<br>
                    3. 网络连接是否正常<br>
                    4. 查看浏览器控制台获取详细错误信息
                </p>
            </div>
        `;
    } finally {
        loadingEl.style.display = 'none';
    }
}

// 过滤站点（按校区）
function filterStationsByCampus(stations) {
    if (!currentAreaId) {
        return stations;  // 显示全部
    }
    return stations.filter(s => s.areaid && s.areaid.toString() === currentAreaId);
}

// 渲染地图
function renderMap(stations) {
    // 清除现有标记
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // 按校区过滤
    const filteredStations = filterStationsByCampus(stations);
    
    // 只显示有空闲的站点
    const availableStations = filteredStations.filter(s => s.free > 0);
    
    availableStations.forEach(station => {
        const { name, lat, lon, free, total } = station;
        
        // 坐标转换
        const [markerLat, markerLon] = convertCoord(lat, lon);
        
        // 根据空闲数量选择颜色
        let color = '#52c41a'; // 绿色：有空闲
        if (free <= 2) {
            color = '#faad14'; // 橙色：少量空闲
        }
        
        // 创建标记
        const marker = L.circleMarker([markerLat, markerLon], {
            radius: 8,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);
        
        // 添加弹出窗口
        marker.bindPopup(`
            <div style="text-align: center;">
                <strong>${name}</strong><br>
                可用: <span style="color: #52c41a; font-weight: bold;">${free}</span> / ${total}
            </div>
        `);
        
        markers.push(marker);
    });
    
    // 如果有标记，调整地图视野
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    } else if (currentAreaId && CAMPUS_CONFIG[currentAreaId]) {
        // 如果没有标记但选择了校区，定位到校区中心
        const campus = CAMPUS_CONFIG[currentAreaId];
        const center = convertCoord(campus.center[0], campus.center[1]);
        map.setView(center, DEFAULT_ZOOM);
    }
}

// 渲染列表
function renderList(stations) {
    const listEl = document.getElementById('station-list');
    
    // 按校区过滤
    const filteredStations = filterStationsByCampus(stations);
    
    // 按空闲数量排序
    const sortedStations = [...filteredStations].sort((a, b) => b.free - a.free);
    
    if (sortedStations.length === 0) {
        listEl.innerHTML = '<div class="error-message">暂无站点数据</div>';
        return;
    }
    
    listEl.innerHTML = sortedStations.map(station => {
        const { name, free, total, used, error, devids } = station;
        
        // 确定状态样式
        let statusClass = 'none';
        let statusText = '无空闲';
        if (free > 0) {
            if (free <= 2) {
                statusClass = 'low';
                statusText = `仅${free}个`;
            } else {
                statusClass = 'free';
                statusText = `${free}个可用`;
            }
        }
        
        const itemClass = free === 0 ? 'station-item no-free' : 'station-item';
        
        // 检查是否已关注（检查 devid 或 devdescript）
        const stationDevids = devids || [];
        const watched = isWatched(stationDevids, name);
        const heartClass = watched ? 'heart-icon watched' : 'heart-icon';
        const heartSymbol = watched ? '❤️' : '🤍';
        
        // 将 devids 转换为 JSON 字符串以便在 data 属性中使用
        const devidsJson = JSON.stringify(stationDevids);
        
        return `
            <div class="${itemClass}" data-name="${name}">
                <div class="station-header">
                    <span class="station-name">${name}</span>
                    <span class="station-status ${statusClass}">${statusText}</span>
                    <span class="${heartClass}" data-devids='${devidsJson}' data-devdescript="${name}" title="${watched ? '取消关注' : '添加关注'}">${heartSymbol}</span>
                </div>
                <div class="station-info">
                    <span>可用: <strong>${free}</strong></span>
                    <span>已用: <strong>${used}</strong></span>
                    <span>总数: <strong>${total}</strong></span>
                    ${error > 0 ? `<span style="color: #ff4d4f;">故障: <strong>${error}</strong></span>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // 添加点击事件
    listEl.querySelectorAll('.station-item').forEach(item => {
        const stationName = item.dataset.name;
        
        // 小红心点击事件（阻止冒泡，避免触发地图定位）
        const heartIcon = item.querySelector('.heart-icon');
        if (heartIcon) {
            heartIcon.addEventListener('click', async (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                // 从 data 属性获取 devid 列表和 devdescript
                const devidsJson = heartIcon.getAttribute('data-devids');
                const devdescript = heartIcon.getAttribute('data-devdescript');
                
                let devids = null;
                if (devidsJson) {
                    try {
                        devids = JSON.parse(devidsJson);
                    } catch (error) {
                        console.error('解析 devids 失败:', error);
                    }
                }
                
                await toggleWatchlist(devids, devdescript);
            });
        }
        
        // 列表项点击事件，定位到地图
        item.addEventListener('click', (e) => {
            // 如果点击的是小红心，不触发地图定位
            if (e.target.classList.contains('heart-icon')) {
                return;
            }
            
            const station = filteredStations.find(s => s.name === stationName);
            if (station) {
                // 坐标转换
                const [viewLat, viewLon] = convertCoord(station.lat, station.lon);
                map.setView([viewLat, viewLon], 17);
                // 打开对应的弹出窗口
                const marker = markers.find(m => {
                    const popup = m.getPopup();
                    return popup && popup.getContent().includes(stationName);
                });
                if (marker) {
                    marker.openPopup();
                }
            }
        });
    });
}

// 更新时间显示
function updateTime(timestamp) {
    const timeEl = document.getElementById('update-time');
    if (timestamp) {
        const date = new Date(timestamp);
        const timeStr = date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        timeEl.textContent = `更新时间: ${timeStr}`;
    } else {
        timeEl.textContent = '更新时间: 未知';
    }
}

// 校区切换事件
function setupCampusSelector() {
    const campusButtons = document.querySelectorAll('.campus-btn');
    campusButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // 移除所有 active 类
            campusButtons.forEach(b => b.classList.remove('active'));
            // 添加 active 类到当前按钮
            btn.classList.add('active');
            // 更新当前校区
            currentAreaId = btn.dataset.areaid || "";
            // 重新渲染（使用已加载的数据）
            if (window.currentStations) {
                renderMap(window.currentStations);
                renderList(window.currentStations);
            }
        });
    });
}

// 刷新按钮事件
document.getElementById('refresh-btn').addEventListener('click', () => {
    fetchStatus();
});

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    setupCampusSelector();
    // 先加载关注列表，再获取站点状态
    await fetchWatchlist();
    fetchStatus();
    
    // 每60秒自动刷新
    setInterval(async () => {
        await fetchWatchlist();
        fetchStatus();
    }, 60000);
});
