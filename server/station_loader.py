"""站点信息加载模块：从 API 获取站点列表并保存"""
import aiohttp
import json
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from server.config import Config

logger = logging.getLogger(__name__)

# 数据目录
DATA_DIR = Path(__file__).parent.parent / "data"
STATIONS_FILE = DATA_DIR / "stations.json"

# 确保 data 目录存在
DATA_DIR.mkdir(exist_ok=True)

def _get_timestamp():
    """获取当前时间戳（UTC+8）"""
    tz_utc_8 = timezone(timedelta(hours=8))
    return datetime.now(tz_utc_8).isoformat()

async def fetch_stations_from_api(openid, center_lat=30.27, center_lon=120.12):
    """从 API 获取站点列表
    
    Args:
        openid: 微信 openId
        center_lat: 中心点纬度（默认玉泉校区）
        center_lon: 中心点经度（默认玉泉校区）
    
    Returns:
        站点列表，如果失败返回 None
    """
    api_address = "http://www.szlzxn.cn/wxn/getStationList"
    headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.60(0x18003c2f) NetType/WIFI Language/zh_CN",
        "Host": "www.szlzxn.cn",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    }
    
    params = {
        "openId": openid,
        "latitude": center_lat,
        "longitude": center_lon,
        "areaid": 6,  # 玉泉校区 areaid
        "devtype": 0
    }
    
    timeout = aiohttp.ClientTimeout(total=10)
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                api_address,
                headers=headers,
                data=params,
                timeout=timeout
            ) as response:
                if response.status != 200:
                    logger.error(f"API 返回状态码: {response.status}")
                    return None
                
                data = await response.json()
                
                if not data.get("success"):
                    logger.error(f"API 返回错误: {data.get('msg', '未知错误')}")
                    return None
                
                stations = data.get("obj", [])
                logger.info(f"成功获取 {len(stations)} 个站点")
                return stations
                
    except Exception as e:
        logger.error(f"获取站点列表失败: {str(e)}", exc_info=True)
        return None

def extract_station_info(stations):
    """提取站点关键信息
    
    Args:
        stations: API 返回的站点列表
    
    Returns:
        提取后的站点信息列表
    """
    extracted = []
    
    for station in stations:
        info = {
            "devid": station.get("devid"),
            "devaddress": station.get("devaddress"),
            "areaid": station.get("areaid"),
            "devdescript": station.get("devdescript", ""),
            "longitude": station.get("longitude"),
            "latitude": station.get("latitude"),
            "simDevaddress": station.get("simDevaddress", "")
        }
        
        # 验证必需字段
        if all([info["devid"], info["devaddress"], info["longitude"], info["latitude"]]):
            extracted.append(info)
        else:
            logger.warning(f"跳过无效站点: {info}")
    
    return extracted

def save_stations(stations_data):
    """保存站点信息到文件
    
    Args:
        stations_data: 站点数据列表
    
    Returns:
        是否保存成功
    """
    try:
        data = {
            "updated_at": _get_timestamp(),
            "stations": stations_data
        }
        
        with open(STATIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"站点信息已保存到 {STATIONS_FILE}，共 {len(stations_data)} 个站点")
        return True
    except Exception as e:
        logger.error(f"保存站点信息失败: {str(e)}", exc_info=True)
        return False

def load_stations():
    """从文件加载站点信息
    
    Returns:
        站点数据，如果文件不存在或读取失败返回 None
    """
    if not STATIONS_FILE.exists():
        logger.warning(f"站点文件不存在: {STATIONS_FILE}")
        return None
    
    try:
        with open(STATIONS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        logger.info(f"从文件加载站点信息，共 {len(data.get('stations', []))} 个站点")
        return data
    except Exception as e:
        logger.error(f"加载站点信息失败: {str(e)}", exc_info=True)
        return None

async def refresh_stations():
    """刷新站点信息（从 API 获取并保存）
    
    Returns:
        是否成功
    """
    openid = Config.get_openid()
    if not openid:
        logger.error("OPENID 未设置，无法获取站点信息")
        return False
    
    logger.info("开始从 API 获取站点信息...")
    stations = await fetch_stations_from_api(openid)
    
    if stations is None:
        logger.error("获取站点信息失败")
        return False
    
    # 提取关键信息
    extracted = extract_station_info(stations)
    
    if not extracted:
        logger.error("没有提取到有效的站点信息")
        return False
    
    # 保存到文件
    if save_stations(extracted):
        logger.info(f"站点信息刷新成功，共 {len(extracted)} 个站点")
        return True
    else:
        logger.error("保存站点信息失败")
        return False
