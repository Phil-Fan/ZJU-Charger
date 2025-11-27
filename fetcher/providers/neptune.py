"""尼普顿服务商适配器"""
import aiohttp
import asyncio
import json
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

from ..provider_base import ProviderBase

logger = logging.getLogger(__name__)


class NeptuneProvider(ProviderBase):
    """尼普顿充电桩服务商适配器"""
    
    @property
    def provider_id(self) -> str:
        return "neptune"
    
    @property
    def provider_name(self) -> str:
        return "尼普顿"
    
    def __init__(self, openid: str):
        """初始化尼普顿服务商
        
        Args:
            openid: 微信 openId
        """
        self.openid = openid
        self.api_address = "http://www.szlzxn.cn/wxn/getStationList"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.60(0x18003c2f) NetType/WIFI Language/zh_CN",
            "Host": "www.szlzxn.cn",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
        }
        self.session = None
        self.stations_file = Path(__file__).parent.parent.parent / "data" / "stations.json"
    
    async def __aenter__(self):
        """异步上下文管理器入口"""
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """异步上下文管理器出口"""
        if self.session:
            await self.session.close()
            self.session = None
    
    def _get_timestamp(self):
        """获取当前时间戳（UTC+8）"""
        tz_utc_8 = timezone(timedelta(hours=8))
        return datetime.now(tz_utc_8).isoformat()
    
    def _make_params(self, lat: float, lng: float) -> Dict[str, Any]:
        """构建请求参数"""
        return {
            "openId": self.openid,
            "latitude": lat,
            "longitude": lng,
            "areaid": 6,
            "devtype": 0
        }
    
    async def _fetch_with_session(self, params: Dict[str, Any], session: aiohttp.ClientSession):
        """使用指定 session 进行请求"""
        max_retries = 5
        timeout = aiohttp.ClientTimeout(total=3)
        
        for attempt in range(max_retries):
            try:
                async with session.post(
                    self.api_address,
                    headers=self.headers,
                    data=params,
                    timeout=timeout
                ) as response:
                    try:
                        json_data = await response.json()
                    except aiohttp.ContentTypeError:
                        if attempt == max_retries - 1:
                            return -2
                        continue
                    
                    if "success" not in json_data or json_data["success"] != True:
                        return -1
                    return json_data
                    
            except (asyncio.TimeoutError, aiohttp.ClientError):
                if attempt == max_retries - 1:
                    return -2
                continue
        
        return -2
    
    async def fetch_stations(self, **kwargs) -> Optional[List[Dict[str, Any]]]:
        """获取站点列表"""
        if not self.stations_file.exists():
            logger.error(f"站点文件不存在: {self.stations_file}")
            return None
        
        try:
            with open(self.stations_file, "r", encoding="utf-8") as f:
                stations_data = json.load(f)
            stations = stations_data.get("stations", [])
            logger.info(f"成功加载 {len(stations)} 个站点")
            return stations
        except Exception as e:
            logger.error(f"加载站点列表失败: {str(e)}", exc_info=True)
            return None
    
    async def _fetch_single_device(self, detail: Dict[str, Any], session: aiohttp.ClientSession, site_name: str):
        """异步获取单个设备的数据"""
        devaddress = detail["devaddress"]
        devid = detail.get("devid")
        latitude = detail["latitude"]
        longitude = detail["longitude"]
        params = self._make_params(latitude, longitude)
        result = await self._fetch_with_session(params, session)
        
        if result == -1:
            logger.warning(f"设备 {devaddress} 数据抓取失败")
            return None, -1
        elif result == -2:
            logger.warning(f"设备 {devaddress} 请求超时或无效响应")
            return None, -1
        
        # 解析结果
        for item in result.get("obj", []):
            if item.get("devaddress") == devaddress:
                portstatus = item.get("portstatus")
                if portstatus:
                    return {
                        "devid": devid,
                        "devaddress": devaddress,
                        "site_name": site_name,
                        "latitude": latitude,
                        "longitude": longitude,
                        "available": portstatus.count("0"),
                        "used": portstatus.count("1"),
                        "error": portstatus.count("3"),
                        "total": len(portstatus),
                        "areaid": detail.get("areaid")  # 保留 areaid 用于后续转换
                    }, 0
                else:
                    logger.warning(f"设备 {devaddress} 端口状态为空")
                    return None, 0
        
        logger.warning(f"未找到匹配的设备: {devaddress}")
        return None, 0
    
    async def fetch_status(self, **kwargs) -> Optional[Dict[str, Any]]:
        """获取站点状态数据"""
        # 加载站点列表
        stations = await self.fetch_stations()
        if not stations:
            return None
        
        # 确保有 session
        if self.session is None:
            self.session = aiohttp.ClientSession()
            should_close_session = True
        else:
            should_close_session = False
        
        try:
            # 组织站点数据（按 devdescript 分组）
            sites_data = {}
            for station in stations:
                site_name = station.get("devdescript", "未知站点")
                if site_name not in sites_data:
                    sites_data[site_name] = {
                        "group_sim_name": site_name,
                        "details": []
                    }
                sites_data[site_name]["details"].append(station)
            
            # 创建异步任务
            all_tasks = []
            device_details_list = []
            
            for site_name, site_data in sites_data.items():
                for detail in site_data.get("details", []):
                    task = self._fetch_single_device(detail, self.session, site_name)
                    all_tasks.append(task)
                    device_details_list.append((site_name, detail))
            
            # 并发执行
            logger.info(f"开始异步抓取 {len(all_tasks)} 个设备...")
            results = await asyncio.gather(*all_tasks, return_exceptions=True)
            
            # 处理结果，按站点分组统计
            site_stats = {}
            
            for idx, result in enumerate(results):
                site_name, detail = device_details_list[idx]
                
                if isinstance(result, Exception):
                    logger.error(f"设备 {detail.get('devaddress')} 发生异常: {result}")
                    continue
                
                device_data, status = result
                if status == -1 or device_data is None:
                    continue
                
                areaid = detail.get("areaid")
                
                if site_name not in site_stats:
                    site_stats[site_name] = {
                        "site_total": 0,
                        "site_available": 0,
                        "site_used": 0,
                        "site_error": 0,
                        "areaid": areaid,
                        "devices": []
                    }
                
                site_stats[site_name]["site_total"] += device_data["total"]
                site_stats[site_name]["site_available"] += device_data["available"]
                site_stats[site_name]["site_used"] += device_data["used"]
                site_stats[site_name]["site_error"] += device_data["error"]
                site_stats[site_name]["devices"].append(device_data)
            
            return {
                "site_stats": site_stats
            }
            
        finally:
            if should_close_session and self.session:
                await self.session.close()
                self.session = None
    
    def normalize_station(self, raw_station: Dict[str, Any]) -> Dict[str, Any]:
        """将服务商特定格式转换为统一格式
        
        Args:
            raw_station: 包含站点统计信息的字典，格式：
                {
                    "site_name": "站点名称",
                    "site_stats": {
                        "site_total": 10,
                        "site_available": 5,
                        "site_used": 4,
                        "site_error": 1,
                        "areaid": 2143,
                        "devices": [...]
                    }
                }
        
        Returns:
            统一格式的站点数据
        """
        site_name = raw_station["site_name"]
        stats = raw_station["site_stats"]
        
        # 收集 devids
        devids = []
        lat = 30.27  # 默认值
        lon = 120.12  # 默认值
        
        if stats.get("devices"):
            first_device = stats["devices"][0]
            lat = first_device["latitude"]
            lon = first_device["longitude"]
            for device in stats["devices"]:
                if device.get("devid") is not None:
                    devids.append(device["devid"])
        
        # 转换为统一格式，areaid 改为 campus
        return {
            "provider_id": self.provider_id,
            "provider_name": self.provider_name,
            "id": str(site_name),
            "name": site_name,
            "devids": devids,
            "lat": lat,
            "lon": lon,
            "free": stats["site_available"],
            "total": stats["site_total"],
            "used": stats["site_used"],
            "error": stats["site_error"],
            "campus": stats.get("areaid")  # areaid 转换为 campus
        }

