"""钉钉命令解析和执行"""
import re
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from server.storage import add_to_watchlist, get_watchlist_devids, get_watchlist_devdescripts
from server.config import Config
import httpx

async def parse_command(text):
    """解析用户命令
    
    Args:
        text: 用户输入的命令文本
    
    Returns:
        (command_type, args): 命令类型和参数
        command_type: "query" | "all" | "watch" | "unknown"
    """
    text = text.strip()
    
    if text == "查询":
        return ("query", None)
    elif text == "全部":
        return ("all", None)
    elif text.startswith("关注"):
        # 提取站点名
        match = re.match(r"关注\s+(.+)", text)
        if match:
            site_name = match.group(1).strip()
            return ("watch", site_name)
        return ("watch", None)
    else:
        return ("unknown", None)

async def execute_query_command():
    """执行查询命令（返回关注列表状态）"""
    try:
        # 调用 API 获取关注列表状态
        # 优先使用环境变量 API_URL，否则使用默认配置
        import os
        api_base = os.getenv("API_URL", f"http://{Config.API_HOST}:{Config.API_PORT}")
        api_url = f"{api_base}/api/watchlist"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(api_url)
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"API 返回错误: {response.status_code}"}
    except Exception as e:
        return {"error": f"查询失败: {str(e)}"}

async def execute_all_command():
    """执行全部命令（返回所有站点状态）"""
    try:
        # 调用 API 获取所有站点状态
        import os
        api_base = os.getenv("API_URL", f"http://{Config.API_HOST}:{Config.API_PORT}")
        api_url = f"{api_base}/api/status"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(api_url)
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"API 返回错误: {response.status_code}"}
    except Exception as e:
        return {"error": f"查询失败: {str(e)}"}

async def execute_watch_command(site_name):
    """执行关注命令（添加站点到关注列表，使用 devid）"""
    if not site_name:
        return {"error": "请提供站点名称，格式：关注 站点名"}
    
    # 先验证站点是否存在，并获取对应的 devid
    try:
        import os
        api_base = os.getenv("API_URL", f"http://{Config.API_HOST}:{Config.API_PORT}")
        api_url = f"{api_base}/api/status"
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(api_url)
            if response.status_code == 200:
                data = response.json()
                stations = data.get("stations", [])
                station_names = [s["name"] for s in stations]
                
                # 检查站点是否存在
                if site_name not in station_names:
                    return {
                        "error": f"站点 '{site_name}' 不存在",
                        "available_sites": station_names[:10]  # 返回前10个站点名作为提示
                    }
                
                # 找到站点对应的 devid 列表和 devdescript
                target_station = next(s for s in stations if s["name"] == site_name)
                devids = target_station.get("devids", [])
                devdescript = site_name
                
                # 添加到关注列表（同时使用 devid 和 devdescript）
                if add_to_watchlist(devids=devids if devids else None, devdescripts=devdescript):
                    return {
                        "success": True,
                        "message": f"已添加到关注列表: {site_name}"
                    }
                else:
                    return {
                        "success": False,
                        "message": f"站点 '{site_name}' 已在关注列表中"
                    }
            else:
                return {"error": f"无法验证站点，API 返回错误: {response.status_code}"}
    except Exception as e:
        return {"error": f"操作失败: {str(e)}"}
