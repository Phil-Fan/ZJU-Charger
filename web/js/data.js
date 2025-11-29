// 数据管理功能

// 当前选中的校区 campus（空字符串表示全部），默认选择玉泉校区
let currentCampus = "2143";

// 当前选中的服务商（空字符串表示全部）
let currentProvider = "";

// 可用服务商列表
let availableProviders = [];

// 关注列表（devid 和 devdescript 集合）
// 数据结构：{ devids: [{devid: number, provider: string}], devdescripts: [string] }
let watchlistDevids = new Set();
let watchlistDevdescripts = new Set();

// 获取前端配置
let fetchInterval = 60; // 默认60秒

// 显示限流弹窗提醒
function showRateLimitAlert() {
    // 检查是否已经存在弹窗
    let alertEl = document.getElementById('rate-limit-alert');
    if (alertEl) {
        // 如果已存在，先移除
        alertEl.remove();
    }
    
    // 创建弹窗元素
    alertEl = document.createElement('div');
    alertEl.id = 'rate-limit-alert';
    alertEl.className = 'fixed top-4 right-4 z-50 max-w-sm w-full';
    alertEl.innerHTML = `
        <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 p-4 rounded-lg shadow-lg">
            <div class="flex items-start gap-3">
                <svg class="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <div class="flex-1">
                    <p class="font-medium">请求过于频繁</p>
                    <p class="text-sm mt-1">请稍后再试，避免频繁刷新页面</p>
                </div>
                <button onclick="this.closest('#rate-limit-alert').remove()" class="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        </div>
    `;
    
    // 添加到页面
    document.body.appendChild(alertEl);
    
    // 3秒后自动消失
    setTimeout(() => {
        if (alertEl && alertEl.parentNode) {
            alertEl.style.transition = 'opacity 0.3s ease-out';
            alertEl.style.opacity = '0';
            setTimeout(() => {
                if (alertEl && alertEl.parentNode) {
                    alertEl.remove();
                }
            }, 300);
        }
    }, 3000);
}

// 过滤站点（按校区）
function filterStationsByCampus(stations) {
    if (!currentCampus) {
        return stations;  // 显示全部
    }
    const filtered = stations.filter(s => s.campus && s.campus.toString() === currentCampus);
    console.log(`[filterStationsByCampus] currentCampus=${currentCampus}, total=${stations.length}, filtered=${filtered.length}`);
    return filtered;
}

// 过滤站点（按服务商）
function filterStationsByProvider(stations) {
    if (!currentProvider) {
        return stations;  // 显示全部
    }
    return stations.filter(s => s.provider_id === currentProvider);
}

// 从 localStorage 加载关注列表
function loadWatchlistFromStorage() {
    try {
        const stored = localStorage.getItem(WATCHLIST_STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            // 将 devid 列表转换为 Set（使用字符串键 "devid:provider" 来唯一标识）
            watchlistDevids.clear();
            if (data.devids && Array.isArray(data.devids)) {
                data.devids.forEach(item => {
                    if (item.devid && item.provider) {
                        watchlistDevids.add(`${item.devid}:${item.provider}`);
                    }
                });
            }
            // 将 devdescript 列表转换为 Set
            watchlistDevdescripts = new Set(data.devdescripts || []);
            return true;
        }
    } catch (error) {
        console.error('加载关注列表失败:', error);
    }
    // 如果加载失败或不存在，初始化为空
    watchlistDevids.clear();
    watchlistDevdescripts.clear();
    return false;
}

// 保存关注列表到 localStorage
function saveWatchlistToStorage() {
    try {
        // 将 Set 转换为数组格式
        const devidsArray = [];
        watchlistDevids.forEach(key => {
            const [devid, provider] = key.split(':');
            if (devid && provider) {
                devidsArray.push({ devid: parseInt(devid), provider: provider });
            }
        });
        
        const data = {
            devids: devidsArray,
            devdescripts: Array.from(watchlistDevdescripts),
            updated_at: new Date().toISOString()
        };
        localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('保存关注列表失败:', error);
        return false;
    }
}

// 获取关注列表（从 localStorage 读取）
function fetchWatchlist() {
    return loadWatchlistFromStorage();
}

// 检查是否已关注
function isWatched(devids, devdescript, providerId) {
    // 检查 devid（需要同时匹配 devid 和 provider）
    if (devids && devids.length > 0 && providerId) {
        const hasDevid = devids.some(devid => {
            const key = `${parseInt(devid)}:${providerId}`;
            return watchlistDevids.has(key);
        });
        if (hasDevid) return true;
    }
    // 检查 devdescript
    if (devdescript && watchlistDevdescripts.has(devdescript)) {
        return true;
    }
    return false;
}

// 切换关注状态（直接操作 localStorage）
async function toggleWatchlist(devids, devdescript, providerId) {
    // 如果没有 devids 和 devdescript，无法操作
    if ((!devids || devids.length === 0) && !devdescript) {
        console.error('切换关注状态失败: 缺少 devids 或 devdescript');
        alert('操作失败: 缺少站点信息');
        return false;
    }
    
    // 如果有 devids 但没有 providerId，尝试从当前站点数据中查找
    if (devids && devids.length > 0 && !providerId) {
        // 尝试从当前站点数据中查找 providerId
        if (window.currentStations && devdescript) {
            const station = window.currentStations.find(s => s.name === devdescript);
            if (station && station.provider_id) {
                providerId = station.provider_id;
            }
        }
        
        // 如果仍然没有找到 providerId，只使用 devdescript
        if (!providerId) {
            console.warn('无法获取 providerId，将只使用 devdescript 进行关注');
            // 继续执行，只使用 devdescript
        }
    }
    
    const currentlyWatched = isWatched(devids, devdescript, providerId);
    
    try {
        if (currentlyWatched) {
            // 移除关注
            if (devids && devids.length > 0 && providerId) {
                devids.forEach(devid => {
                    const key = `${parseInt(devid)}:${providerId}`;
                    watchlistDevids.delete(key);
                });
            }
            if (devdescript) {
                watchlistDevdescripts.delete(devdescript);
            }
        } else {
            // 添加关注
            if (devids && devids.length > 0 && providerId) {
                devids.forEach(devid => {
                    const key = `${parseInt(devid)}:${providerId}`;
                    watchlistDevids.add(key);
                });
            }
            if (devdescript) {
                watchlistDevdescripts.add(devdescript);
            }
        }
        
        // 保存到 localStorage
        saveWatchlistToStorage();
        
        // 重新渲染列表以更新收藏状态
        if (window.currentStations) {
            renderList(window.currentStations, window.allStationsDef);
        }
        return true;
    } catch (error) {
        console.error('切换关注状态失败:', error);
        alert(`操作失败: ${error.message || '未知错误'}`);
        return false;
    }
}

// 获取关注列表站点状态（通过 devid+provider 查询 API）
async function fetchWatchlistStatus() {
    try {
        // 从 localStorage 读取 watchlist
        loadWatchlistFromStorage();
        
        // 按 provider 分组 devid
        const providerDevidsMap = new Map();
        watchlistDevids.forEach(key => {
            const [devid, provider] = key.split(':');
            if (devid && provider) {
                if (!providerDevidsMap.has(provider)) {
                    providerDevidsMap.set(provider, []);
                }
                providerDevidsMap.get(provider).push(parseInt(devid));
            }
        });
        
        // 如果没有 devid，返回空结果
        if (providerDevidsMap.size === 0 && watchlistDevdescripts.size === 0) {
            return {
                updated_at: new Date().toISOString(),
                stations: []
            };
        }
        
        // 对每个 provider，调用 API 获取关注站点状态
        const allStations = [];
        const promises = [];
        
        for (const [provider, devids] of providerDevidsMap.entries()) {
            // 构建 API URL
            let apiUrl = `/api/status?provider=${encodeURIComponent(provider)}`;
            devids.forEach(devid => {
                apiUrl += `&devid=${devid}`;
            });
            
            // 发起请求
            promises.push(
                fetch(apiUrl)
                    .then(response => {
                        if (response.ok) {
                            return response.json();
                        }
                        throw new Error(`API 返回错误: ${response.status}`);
                    })
                    .then(data => {
                        if (data && data.stations) {
                            allStations.push(...data.stations);
                        }
                    })
                    .catch(error => {
                        console.error(`获取 ${provider} 的关注站点状态失败:`, error);
                    })
            );
        }
        
        // 等待所有请求完成
        await Promise.all(promises);
        
        // 如果还有 devdescript，需要从所有站点中过滤
        if (watchlistDevdescripts.size > 0) {
            // 获取所有站点数据
            try {
                const allStationsResponse = await fetch('/api/status');
                if (allStationsResponse.ok) {
                    const allData = await allStationsResponse.json();
                    if (allData && allData.stations) {
                        // 过滤出匹配的站点
                        const matchedStations = allData.stations.filter(station => {
                            return watchlistDevdescripts.has(station.name);
                        });
                        // 合并到结果中（去重）
                        const existingNames = new Set(allStations.map(s => s.name));
                        matchedStations.forEach(station => {
                            if (!existingNames.has(station.name)) {
                                allStations.push(station);
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('获取所有站点数据失败:', error);
            }
        }
        
        return {
            updated_at: new Date().toISOString(),
            stations: allStations
        };
    } catch (error) {
        console.error('获取关注列表状态失败:', error);
        return {
            updated_at: new Date().toISOString(),
            stations: []
        };
    }
}

// 加载可用服务商列表
async function loadProviders() {
    try {
        const response = await fetch('/api/providers');
        if (response.status === 429) {
            // 限流错误
            showRateLimitAlert();
            return false;
        }
        if (response.ok) {
            const providers = await response.json();
            availableProviders = providers;
            
            // 更新服务商选择器
            const selector = document.getElementById('provider-selector');
            if (selector) {
                // 保留"全部服务商"选项
                const allOption = selector.querySelector('option[value=""]');
                selector.innerHTML = '';
                if (allOption) {
                    selector.appendChild(allOption);
                }
                
                // 添加服务商选项
                providers.forEach(provider => {
                    const option = document.createElement('option');
                    option.value = provider.id;
                    option.textContent = provider.name;
                    selector.appendChild(option);
                });
            }
            return true;
        }
    } catch (error) {
        console.error('获取服务商列表失败:', error);
    }
    return false;
}

// 获取站点状态
async function fetchStatus() {
    const loadingEl = document.getElementById('loading');
    const listEl = document.getElementById('station-list');
    
    loadingEl.style.display = 'block';
    listEl.innerHTML = '';
    
    try {
        // 构建 API URL，支持 provider 参数
        let apiUrl = '/api/status';
        if (currentProvider) {
            apiUrl += `?provider=${encodeURIComponent(currentProvider)}`;
        }
        
        // 先尝试调用 API
        let data;
        try {
            const response = await fetch(apiUrl);
            if (response.status === 429) {
                // 限流错误
                showRateLimitAlert();
                throw new Error('请求过于频繁，请稍后再试');
            }
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
                // 如果选择了服务商，需要过滤数据
                if (currentProvider && data.stations) {
                    data.stations = data.stations.filter(s => s.provider_id === currentProvider);
                }
            } else {
                throw new Error('无法加载数据');
            }
        }
        
        // 加载所有站点定义（stations.json）
        let allStationsDef = [];
        try {
            const stationsResponse = await fetch('/data/stations.json');
            if (stationsResponse.ok) {
                const stationsData = await stationsResponse.json();
                allStationsDef = stationsData.stations || [];
            }
        } catch (error) {
            console.log('无法加载 stations.json，将只显示已抓取的站点', error);
        }
        
        if (data && data.stations) {
            if (data.stations.length === 0 && allStationsDef.length === 0) {
                // 数据为空，显示提示
                const listEl = document.getElementById('station-list');
                listEl.innerHTML = `
                    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 p-4 rounded-lg text-center">
                        <p class="font-medium">暂无站点数据</p>
                        <p class="text-sm mt-2">请确保服务器已成功抓取数据</p>
                        <p class="text-sm mt-1 text-red-600 dark:text-red-400">如果服务器正在运行，请检查控制台错误信息</p>
                    </div>
                `;
                updateTime(data.updated_at || '未知');
            } else {
                // 保存当前数据供校区切换使用
                window.currentStations = data.stations;
                window.allStationsDef = allStationsDef;
                
                // 合并所有站点用于地图显示
                const allStationsForMap = [...data.stations];
                if (allStationsDef && allStationsDef.length > 0) {
                    const fetchedNames = new Set(data.stations.map(s => s.name));
                    allStationsDef.forEach(def => {
                        const devdescript = def.devdescript || def.name;
                        if (!fetchedNames.has(devdescript)) {
                            // 不再按服务商过滤地图显示（由图层控制器控制）
                            allStationsForMap.push({
                                name: devdescript,
                                free: 0,
                                total: 0,
                                used: 0,
                                error: 0,
                                devids: def.devid ? [def.devid] : [],
                                provider_id: def.provider_id || 'unknown',
                                provider_name: def.provider_name || '未知',
                                campus: def.areaid,
                                lat: def.latitude,
                                lon: def.longitude,
                                isFetched: false
                            });
                        }
                    });
                }
                
                // 刷新数据时，只更新标记和列表，不重置地图视图
                // 传入 false 表示不允许自动调整地图视野，保持用户当前位置
                renderMap(allStationsForMap, false);
                renderList(data.stations, allStationsDef);
                updateTime(data.updated_at);
                
                // 标记首次加载完成
                if (isFirstLoad) {
                    isFirstLoad = false;
                }
            }
        } else {
            throw new Error('数据格式错误：缺少 stations 字段');
        }
    } catch (error) {
        console.error('获取数据失败:', error);
        listEl.innerHTML = `
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 p-4 rounded-lg text-center">
                <p class="font-medium">加载数据失败</p>
                <p class="text-sm mt-2">${error.message}</p>
                <p class="text-sm mt-2 text-red-600 dark:text-red-400">
                    请检查：<br>
                    1. 服务器是否正在运行<br>
                    2. 网络连接是否正常<br>
                    3. 查看浏览器控制台获取详细错误信息
                </p>
            </div>
        `;
    } finally {
        loadingEl.style.display = 'none';
    }
}

async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        if (response.status === 429) {
            // 限流错误
            showRateLimitAlert();
            return false;
        }
        if (response.ok) {
            const config = await response.json();
            fetchInterval = config.fetch_interval || 60;
            console.log(`已加载配置：自动刷新间隔 = ${fetchInterval}秒`);
            return true;
        }
    } catch (error) {
        console.warn('获取配置失败，使用默认值:', error);
    }
    return false;
}

// 渲染列表
function renderList(stations, allStationsDef = []) {
    const listEl = document.getElementById('station-list');
    
    // 创建已抓取站点的映射（使用 name 作为键）
    const fetchedStationsMap = new Map();
    stations.forEach(s => {
        fetchedStationsMap.set(s.name, s);
    });
    
    // 合并所有站点：已抓取的和未抓取的
    const allStations = [];
    
    // 添加已抓取的站点
    stations.forEach(s => {
        allStations.push({ ...s, isFetched: true });
    });
    
    // 添加未抓取的站点（从 stations.json）
    if (allStationsDef && allStationsDef.length > 0) {
        allStationsDef.forEach(def => {
            const devdescript = def.devdescript || def.name;
            // 如果这个站点没有被抓取到，添加为未抓取状态
            if (!fetchedStationsMap.has(devdescript)) {
                // 检查是否匹配当前过滤条件
                const matchesProvider = !currentProvider || def.provider_id === currentProvider;
                const matchesCampus = !currentCampus || (def.areaid && def.areaid.toString() === currentCampus);
                
                if (matchesProvider && matchesCampus) {
                    allStations.push({
                        name: devdescript,
                        free: 0,
                        total: 0,
                        used: 0,
                        error: 0,
                        devids: def.devid ? [def.devid] : [],
                        provider_id: def.provider_id || 'unknown',
                        provider_name: def.provider_name || '未知',
                        campus: def.areaid,
                        lat: def.latitude,
                        lon: def.longitude,
                        isFetched: false
                    });
                }
            }
        });
    }
    
    // 按校区和服务商过滤
    let filteredStations = filterStationsByCampus(allStations);
    filteredStations = filterStationsByProvider(filteredStations);
    
    // 排序逻辑：关注列表优先，然后按可用数量排序
    const sortedStations = [...filteredStations].sort((a, b) => {
        // 检查是否已关注
        const aWatched = isWatched(a.devids || [], a.name, a.provider_id);
        const bWatched = isWatched(b.devids || [], b.name, b.provider_id);
        
        // 如果一个是关注的，另一个不是，关注的排在前面
        if (aWatched !== bWatched) {
            return aWatched ? -1 : 1;
        }
        
        // 如果都是关注的或都不是关注的，继续其他排序规则
        // 已抓取的排在前面
        if (a.isFetched !== b.isFetched) {
            return a.isFetched ? -1 : 1;
        }
        
        // 按可用数量排序（从多到少）
        return b.free - a.free;
    });
    
    if (sortedStations.length === 0) {
        listEl.innerHTML = '<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 p-4 rounded-lg text-center">暂无站点数据</div>';
        return;
    }
    
    listEl.innerHTML = sortedStations.map(station => {
        const { name, free, total, used, error, devids, provider_id, provider_name, campus, isFetched } = station;
        
        // 计算使用率
        const usagePercent = total > 0 ? (used / total) * 100 : 0;
        const freePercent = total > 0 ? (free / total) * 100 : 0;
        const errorPercent = total > 0 ? (error / total) * 100 : 0;
        
        // 可用部分统一使用绿色
        const barColor = '#10b981'; // 绿色：可用部分统一颜色
        
        // 检查是否没有可用充电桩
        const isUnavailable = free === 0;
        
        // 检查是否未抓取到
        const isNotFetched = isFetched === false;
        
        // 优化背景和边框配色（支持暗色模式）
        const itemBgClass = isNotFetched ? 'bg-gray-100 dark:bg-gray-700/50' : 'bg-white dark:bg-gray-800';
        const itemBorderClass = isNotFetched ? 'border-gray-300 dark:border-gray-600' : 'border-gray-200 dark:border-gray-700';
        const itemHoverBorderClass = isNotFetched ? '' : 'hover:border-blue-400 dark:hover:border-blue-500';
        const itemHoverBgClass = isNotFetched ? '' : 'hover:bg-blue-50 dark:hover:bg-blue-900/30';
        const cursorClass = isNotFetched ? 'cursor-not-allowed' : 'cursor-pointer';
        const grayscaleClass = isNotFetched ? 'grayscale opacity-60' : '';
        
        // 检查是否已关注
        const stationDevids = devids || [];
        const watched = isWatched(stationDevids, name, provider_id);
        
        // Heroicons 风格的星形图标（实心/空心）- 表示收藏/关注
        const starIcon = watched 
            ? `<svg class="w-5 h-5 text-yellow-500 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
            </svg>`
            : `<svg class="w-5 h-5 text-gray-400 dark:text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
            </svg>`;
        
        // 将 devids 转换为 JSON 字符串以便在 data 属性中使用
        const devidsJson = JSON.stringify(stationDevids);
        
        // 获取校区名称
        const campusName = campus && CAMPUS_CONFIG[campus] ? CAMPUS_CONFIG[campus].name : '未知校区';
        
        // 服务商形状图标
        const providerShapesForBadge = {
            'neptune': '●',  // 圆形
            // 'provider2': '▲',  // 三角形
            // 'provider3': '■',  // 正方形
        };
        const shapeIcon = providerShapesForBadge[provider_id] || '●';
        
        // 站点名称截断（最多显示20个字符）
        const displayName = name.length > 20 ? name.substring(0, 20) + '...' : name;
        
        const titleText = isNotFetched ? '未抓取到数据' : name;
        
        return `
            <div class="p-4 border ${itemBorderClass} rounded-lg ${itemBgClass} transition-all duration-200 ${cursorClass} ${itemHoverBorderClass} ${itemHoverBgClass} ${grayscaleClass}" data-name="${name}" data-available="${!isNotFetched}" data-provider-id="${provider_id || ''}" title="${titleText}">
                <!-- 站点名称和关注按钮 -->
                <div class="flex justify-between items-start mb-3 gap-2">
                    <span class="font-semibold text-base ${isNotFetched ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'} truncate flex-1" title="${name}">${displayName}</span>
                    <span class="cursor-pointer select-none transition-transform duration-200 hover:scale-110 active:scale-95 flex-shrink-0 p-1 -mr-1 focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:focus:ring-yellow-400 rounded" data-devids='${devidsJson}' data-devdescript="${name}" title="${watched ? '取消收藏' : '添加收藏'}">${starIcon}</span>
                </div>
                
                <!-- 颜色条：显示使用情况（可用部分在最左侧） -->
                <div class="mb-3">
                    ${isNotFetched ? `
                        <div class="h-3 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                        <div class="flex justify-between items-center mt-1 text-xs text-gray-400 dark:text-gray-500">
                            <span>未抓取到数据</span>
                        </div>
                    ` : `
                        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
                            ${free > 0 ? `<div style="background-color: ${barColor}; width: ${freePercent}%"></div>` : ''}
                            ${used > 0 ? `<div class="bg-gray-400 dark:bg-gray-600" style="width: ${usagePercent}%"></div>` : ''}
                            ${error > 0 ? `<div class="bg-red-500 dark:bg-red-600" style="width: ${errorPercent}%"></div>` : ''}
                        </div>
                        <div class="flex justify-between items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <span>可用: ${free}</span>
                            <span>已用: ${used}</span>
                            <span>共计: ${total}</span>
                            ${error > 0 ? `<span class="text-red-600 dark:text-red-400">故障: ${error}</span>` : ''}
                        </div>
                    `}
                </div>
                
                <!-- 标签：校区和供应商 -->
                <div class="flex flex-wrap gap-2">
                    <span class="px-2 py-1 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">${campusName}</span>
                    ${provider_name ? `<span class="px-2 py-1 rounded-md text-xs font-medium bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1"><span class="text-[10px]">${shapeIcon}</span>${provider_name}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // 添加点击事件
    listEl.querySelectorAll('[data-name]').forEach(item => {
        const stationName = item.dataset.name;
        
        // 收藏图标点击事件（阻止冒泡，避免触发地图定位）
        const starIcon = item.querySelector('[data-devids]');
        if (starIcon) {
            starIcon.addEventListener('click', async (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                e.preventDefault(); // 防止默认行为
                // 从 data 属性获取 devid 列表、devdescript 和 provider_id
                const devidsJson = starIcon.getAttribute('data-devids');
                const devdescript = starIcon.getAttribute('data-devdescript');
                
                // 优先从 data-provider-id 属性获取
                let providerId = item.getAttribute('data-provider-id');
                
                // 如果 data-provider-id 为空，尝试从当前站点数据中查找
                if (!providerId && window.currentStations) {
                    const station = window.currentStations.find(s => s.name === stationName);
                    if (station && station.provider_id) {
                        providerId = station.provider_id;
                    }
                }
                
                // 如果还是没有，尝试从 allStationsDef 中查找
                if (!providerId && window.allStationsDef) {
                    const stationDef = window.allStationsDef.find(def => {
                        const defName = def.devdescript || def.name;
                        return defName === stationName;
                    });
                    if (stationDef && stationDef.provider_id) {
                        providerId = stationDef.provider_id;
                    }
                }
                
                let devids = null;
                if (devidsJson && devidsJson !== 'null' && devidsJson !== '[]') {
                    try {
                        devids = JSON.parse(devidsJson);
                        // 确保 devids 是数组且不为空
                        if (!Array.isArray(devids) || devids.length === 0) {
                            devids = null;
                        }
                    } catch (error) {
                        console.error('解析 devids 失败:', error);
                        devids = null;
                    }
                }
                
                await toggleWatchlist(devids, devdescript, providerId);
            });
        }
        
        // 列表项点击事件，定位到地图（仅当已抓取到数据时）
        item.addEventListener('click', (e) => {
            // 如果点击的是关注图标或其子元素，不触发地图定位
            if (e.target.closest('[data-devids]')) {
                return;
            }
            
            // 如果未抓取到数据，不执行定位
            const isAvailable = item.getAttribute('data-available') === 'true';
            if (!isAvailable) {
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

