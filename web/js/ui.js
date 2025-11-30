// UI 交互和主入口

// 检查是否在夜间时段（0:10-5:50）
function isNightTime() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTimeMinutes = hours * 60 + minutes;
    
    // 夜间时段：0:10 (10分钟) 到 5:50 (350分钟)
    const nightStartMinutes = 0 * 60 + 10; // 0:10
    const nightEndMinutes = 5 * 60 + 50;   // 5:50
    
    return currentTimeMinutes >= nightStartMinutes && currentTimeMinutes <= nightEndMinutes;
}

// 更新夜间消息显示状态
function updateNightMessage() {
    const nightMessageEl = document.getElementById('night-message');
    if (nightMessageEl) {
        if (isNightTime()) {
            nightMessageEl.classList.remove('hidden');
        } else {
            nightMessageEl.classList.add('hidden');
        }
    }
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
    // 同时更新夜间消息显示状态
    updateNightMessage();
}

// 暗色模式相关函数
function getTheme() {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'light';
}

function setTheme(theme) {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function toggleTheme() {
    const currentTheme = getTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    console.log(`切换主题: ${currentTheme} -> ${newTheme}`);
    setTheme(newTheme);
}

function initTheme() {
    const theme = getTheme();
    setTheme(theme);
}

// 计算两点之间的距离（使用 Haversine 公式，单位：公里）
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球半径（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 显示当前位置在地图上
function showCurrentLocation() {
    // 检查浏览器是否支持地理位置 API
    if (!navigator.geolocation) {
        alert('您的浏览器不支持地理位置服务');
        return;
    }

    // 检查是否在 HTTPS 环境下（localhost 除外）
    const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!isSecureContext) {
        alert('地理位置功能需要 HTTPS 环境才能使用');
        return;
    }

    // 移除旧的当前位置标记
    if (currentLocationMarker) {
        map.removeLayer(currentLocationMarker);
        currentLocationMarker = null;
    }

    // 显示加载状态
    const locationBtn = document.getElementById('location-btn');
    if (locationBtn) {
        locationBtn.disabled = true;
        locationBtn.innerHTML = `
            <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
        `;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;
            
            console.log(`当前位置: ${userLat}, ${userLon}`);
            
            // 坐标转换：用户位置通常是 WGS84，需要转换为地图使用的坐标系
            let markerLat = userLat;
            let markerLon = userLon;
            
            // 如果地图使用的是 GCJ02 或 BD09，需要从 WGS84 转换
            const targetCoord = MAP_CONFIG.webCoordSystem;
            if (targetCoord === 'GCJ02') {
                // WGS84 -> GCJ02
                if (typeof wgs84ToGcj02 === 'function') {
                    const converted = wgs84ToGcj02(userLon, userLat);
                    markerLon = converted[0];
                    markerLat = converted[1];
                } else {
                    console.warn('wgs84ToGcj02 函数不可用，使用原始坐标');
                }
            } else if (targetCoord === 'BD09') {
                // WGS84 -> BD09
                if (typeof wgs84ToBd09 === 'function') {
                    const converted = wgs84ToBd09(userLon, userLat);
                    markerLon = converted[0];
                    markerLat = converted[1];
                } else {
                    console.warn('wgs84ToBd09 函数不可用，使用原始坐标');
                }
            }
            // 如果目标坐标系是 WGS84，不需要转换
            
            // 创建当前位置图标（蓝色圆点，带外圈）
            const locationIconHtml = `
                <div style="
                    width: 20px;
                    height: 20px;
                    background-color: #3b82f6;
                    border: 3px solid white;
                    border-radius: 50%;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    position: relative;
                ">
                    <div style="
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 8px;
                        height: 8px;
                        background-color: white;
                        border-radius: 50%;
                    "></div>
                </div>
            `;
            
            const locationIcon = L.divIcon({
                html: locationIconHtml,
                className: '',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            
            // 创建标记
            currentLocationMarker = L.marker([markerLat, markerLon], {
                icon: locationIcon,
                zIndexOffset: 1000 // 确保在充电桩标记之上
            }).addTo(map);
            
            // 添加弹出窗口
            currentLocationMarker.bindPopup(`
                <div style="text-align: center; width: fit-content;">
                    <strong style="font-size: 14px;">📍 当前位置</strong>
                </div>
            `).openPopup();
            
            // 定位到当前位置（带缩放）
            map.setView([markerLat, markerLon], 16);
            
            // 恢复按钮状态
            if (locationBtn) {
                locationBtn.disabled = false;
                locationBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                `;
            }
        },
        (error) => {
            let errorMessage = '获取位置失败';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = '您拒绝了位置权限请求，请在浏览器设置中允许位置访问';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = '位置信息不可用';
                    break;
                case error.TIMEOUT:
                    errorMessage = '获取位置超时，请重试';
                    break;
                default:
                    errorMessage = error.message || '未知错误';
                    break;
            }
            alert(errorMessage);
            console.error('获取位置失败:', errorMessage, error);
            
            // 恢复按钮状态
            if (locationBtn) {
                locationBtn.disabled = false;
                locationBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                `;
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0 // 不使用缓存，每次都获取最新位置
        }
    );
}

// 获取用户位置并找到最近的校区
function detectNearestCampus() {
    return new Promise((resolve, reject) => {
        // 检查浏览器是否支持地理位置 API
        if (!navigator.geolocation) {
            reject(new Error('浏览器不支持地理位置服务'));
            return;
        }

        // 检查是否在 HTTPS 环境下（localhost 除外）
        const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        if (!isSecureContext) {
            console.warn('地理位置 API 需要 HTTPS 环境才能使用');
            reject(new Error('地理位置功能需要 HTTPS 环境，当前为 HTTP'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLon = position.coords.longitude;
                
                console.log(`用户位置: ${userLat}, ${userLon}`);
                
                // 计算到各个校区的距离
                let nearestCampus = null;
                let minDistance = Infinity;
                
                for (const [campusId, campusInfo] of Object.entries(CAMPUS_CONFIG)) {
                    const [campusLon, campusLat] = campusInfo.center;
                    const distance = calculateDistance(userLat, userLon, campusLat, campusLon);
                    
                    console.log(`${campusInfo.name} 距离: ${distance.toFixed(2)} 公里`);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestCampus = {
                            id: campusId,
                            name: campusInfo.name,
                            distance: distance
                        };
                    }
                }
                
                if (nearestCampus) {
                    console.log(`最近的校区: ${nearestCampus.name} (${nearestCampus.distance.toFixed(2)} 公里)`);
                    resolve(nearestCampus);
                } else {
                    reject(new Error('无法找到最近的校区'));
                }
            },
            (error) => {
                let errorMessage = '获取位置失败';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = '用户拒绝了位置权限请求';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = '位置信息不可用';
                        break;
                    case error.TIMEOUT:
                        errorMessage = '获取位置超时';
                        break;
                    default:
                        errorMessage = error.message || '未知错误';
                        break;
                }
                console.warn('获取位置失败:', errorMessage, error);
                reject(new Error(errorMessage));
            },
            {
                enableHighAccuracy: false,
                timeout: 10000, // 增加到10秒
                maximumAge: 60000 // 缓存1分钟
            }
        );
    });
}

// 显示位置提醒通知
function showLocationNotification(campusName, distance, isSwitched = false) {
    // 移除已存在的通知
    const existingNotification = document.getElementById('location-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // 创建通知元素
    const notification = document.createElement('div');
    notification.id = 'location-notification';
    notification.className = 'fixed top-4 right-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg shadow-lg p-4 max-w-sm z-[9999] animate-slide-in';
    notification.style.zIndex = '9999'; // 确保在最上层
    const distanceText = distance !== undefined ? ` (距离您约 ${distance.toFixed(1)} 公里)` : '';
    const titleText = isSwitched ? '已自动切换到最近校区' : '检测到您的位置';
    notification.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="flex-shrink-0">
                <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
            </div>
            <div class="flex-1">
                <p class="text-sm font-medium text-blue-900 dark:text-blue-200">${titleText}</p>
                <p class="text-xs text-blue-700 dark:text-blue-300 mt-1">${campusName}${distanceText}</p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="flex-shrink-0 text-blue-400 dark:text-blue-500 hover:text-blue-600 dark:hover:text-blue-400">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    `;
    
    // 添加样式（如果还没有）
    if (!document.getElementById('location-notification-style')) {
        const style = document.createElement('style');
        style.id = 'location-notification-style';
        style.textContent = `
            @keyframes slide-in {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            .animate-slide-in {
                animation: slide-in 0.3s ease-out;
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // 5秒后自动消失
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.transition = 'opacity 0.3s ease-out';
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
}

// 切换到指定校区
function switchToCampus(campusId) {
    const campusInfo = CAMPUS_CONFIG[campusId];
    if (!campusInfo) {
        console.error(`未知的校区 ID: ${campusId}`);
        return;
    }
    
    // 更新当前校区
    currentCampus = campusId;
    
    // 更新按钮样式
    const campusButtons = document.querySelectorAll('[data-campus]');
    campusButtons.forEach(btn => {
        if (btn.dataset.campus === campusId) {
            btn.className = 'px-3 lg:px-4 py-2 rounded-md text-xs lg:text-sm font-medium transition-all duration-200 bg-blue-600 dark:bg-blue-500 text-white border border-blue-600 dark:border-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600';
        } else {
            btn.className = 'px-3 lg:px-4 py-2 rounded-md text-xs lg:text-sm font-medium transition-all duration-200 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-600 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400';
        }
    });
    
    // 重新渲染地图和列表
    // 切换校区时允许调整视野（true），因为用户主动切换了校区
    if (window.currentStations) {
        const allStationsForMap = [...(window.currentStations || [])];
        if (window.allStationsDef && window.allStationsDef.length > 0) {
            const fetchedIds = new Set((window.currentStations || []).map(s => (s.hash_id || s.id || s.name || '').toString()));
            window.allStationsDef.forEach(def => {
                const devdescript = def.devdescript || def.name;
                const defKey = (def.hash_id || def.id || devdescript || '').toString();
                if (!fetchedIds.has(defKey)) {
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
                        hash_id: defKey,
                        isFetched: false
                    });
                }
            });
        }
        renderMap(allStationsForMap, true); // 切换校区时允许调整视野
        renderList(window.currentStations, window.allStationsDef);
    }
}

// 校区切换事件
function setupCampusSelector() {
    const campusButtons = document.querySelectorAll('[data-campus]');
    campusButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // 更新所有按钮样式
            campusButtons.forEach(b => {
                if (b === btn) {
                    // 激活状态：蓝色背景
                    b.className = 'px-3 lg:px-4 py-2 rounded-md text-xs lg:text-sm font-medium transition-all duration-200 bg-blue-600 dark:bg-blue-500 text-white border border-blue-600 dark:border-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600';
                } else {
                    // 非激活状态：灰色背景
                    b.className = 'px-3 lg:px-4 py-2 rounded-md text-xs lg:text-sm font-medium transition-all duration-200 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-600 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400';
                }
            });
            // 更新当前校区
            currentCampus = btn.dataset.campus || "";
            // 重新渲染（使用已加载的数据）
            // 校区切换时允许调整地图视野（传入 true）
            if (window.currentStations) {
                // 合并所有站点用于地图显示（包括未抓取的）
                const allStationsForMap = [...(window.currentStations || [])];
                if (window.allStationsDef && window.allStationsDef.length > 0) {
                    const fetchedIds = new Set((window.currentStations || []).map(s => (s.hash_id || s.id || s.name || '').toString()));
                    window.allStationsDef.forEach(def => {
                        const devdescript = def.devdescript || def.name;
                        const defKey = (def.hash_id || def.id || devdescript || '').toString();
                        if (!fetchedIds.has(defKey)) {
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
                                hash_id: defKey,
                                isFetched: false
                            });
                        }
                    });
                }
                renderMap(allStationsForMap, true); // 校区切换时允许调整视野
                renderList(window.currentStations, window.allStationsDef || []);
            }
        });
    });
}

// 服务商切换事件
function setupProviderSelector() {
    const providerSelector = document.getElementById('provider-selector');
    if (providerSelector) {
        providerSelector.addEventListener('change', (e) => {
            currentProvider = e.target.value || "";
            // 如果选择了服务商，需要重新获取数据
            if (currentProvider) {
                fetchStatus();
            } else {
                // 如果选择"全部"，使用已加载的数据重新渲染
                // 切换服务商时保持当前位置（false），因为用户可能已经定位到某个位置
                if (window.currentStations) {
                    // 合并所有站点用于地图显示（包括未抓取的）
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
                    renderMap(allStationsForMap, false); // 切换服务商时保持当前位置
                    renderList(window.currentStations, window.allStationsDef);
                }
            }
        });
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 初始化暗色模式
    initTheme();
    
    // 设置暗色模式切换按钮事件
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('主题切换按钮被点击');
            toggleTheme();
        });
        console.log('暗色模式切换按钮已绑定事件');
    } else {
        console.error('未找到主题切换按钮');
    }
    
    // 默认显示全部校区
    currentCampus = "";
    
    initMap();
    setupCampusSelector();
    setupProviderSelector();
    
    // 设置默认校区为玉泉校区按钮样式
    const yuquanButton = document.getElementById('campus-yuquan');
    const allButton = document.getElementById('campus-all');
    const zjgButton = document.getElementById('campus-zjg');
    if (allButton) {
        allButton.className = 'px-3 lg:px-4 py-2 rounded-md text-xs lg:text-sm font-medium transition-all duration-200 bg-blue-600 dark:bg-blue-500 text-white border border-blue-600 dark:border-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600';
    }
    if (yuquanButton) {
        yuquanButton.className = 'px-3 lg:px-4 py-2 rounded-md text-xs lg:text-sm font-medium transition-all duration-200 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-600 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400';
    }
    if (zjgButton) {
        zjgButton.className = 'px-3 lg:px-4 py-2 rounded-md text-xs lg:text-sm font-medium transition-all duration-200 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-600 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400';
    }
    
    // 尝试自动检测最近的校区
    try {
        const nearestCampus = await detectNearestCampus();
        if (nearestCampus) {
            console.log(`检测到最近校区: ${nearestCampus.name}, 当前校区: ${currentCampus}`);
            const targetId = nearestCampus.id ? nearestCampus.id.toString() : '';
            const isSwitched = targetId && targetId !== currentCampus;
            if (isSwitched) {
                // 切换到最近的校区
                console.log(`切换到最近校区: ${nearestCampus.name}`);
                switchToCampus(targetId);
            }
            // 无论是否切换，都显示通知（让用户知道检测到了位置）
            console.log(`显示通知: ${nearestCampus.name}, 距离: ${nearestCampus.distance.toFixed(2)} 公里, 已切换: ${isSwitched}`);
            showLocationNotification(nearestCampus.name, nearestCampus.distance, isSwitched);
        } else {
            console.warn('未找到最近校区');
        }
    } catch (error) {
        console.log('自动检测校区失败，使用默认校区:', error.message);
        console.log('错误详情:', error);
        
        // 如果是 HTTPS 相关错误，显示友好提示
        if (error.message && error.message.includes('HTTPS')) {
            console.warn('提示: 地理位置功能需要 HTTPS 环境。当前网站使用 HTTP，无法获取位置信息。');
        } else if (error.message && error.message.includes('权限')) {
            console.warn('提示: 用户拒绝了位置权限，无法自动检测最近校区。');
        }
        // 为了不打扰用户，这里不显示错误通知，静默使用默认校区
    }
    
    // 加载配置
    await loadConfig();
    // 先加载服务商列表
    await loadProviders();
    // 先加载关注列表（从 localStorage），再获取站点状态
    fetchWatchlist();
    // 确保在 fetchStatus 执行时 currentCampus 仍然是正确的值
    await fetchStatus();
    
    // 初始化夜间消息显示状态
    updateNightMessage();
    
    // 设置定时检查夜间消息（每分钟检查一次）
    setInterval(() => {
        updateNightMessage();
    }, 60 * 1000); // 60秒 = 1分钟
    
    // 设置定位按钮事件
    const locationBtn = document.getElementById('location-btn');
    if (locationBtn) {
        locationBtn.addEventListener('click', function() {
            showCurrentLocation();
        });
    }
    
    // 设置下载按钮事件
    const downloadBtn = document.getElementById('download-map-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            manualPrint();
        });
    }
    
    // 刷新按钮事件
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            fetchStatus();
        });
    }
    
    // 使用配置的间隔自动刷新
    setInterval(() => {
        fetchWatchlist(); // 从 localStorage 读取，不需要 await
        fetchStatus();
    }, fetchInterval * 1000); // 转换为毫秒
});
