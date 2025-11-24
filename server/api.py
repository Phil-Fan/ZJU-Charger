"""FastAPI 主服务"""
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, RedirectResponse, FileResponse
from datetime import datetime, timezone, timedelta
import sys
import logging
from pathlib import Path

# 配置日志（如果还没有配置）
if not logging.getLogger().handlers:
    from server.logging_config import setup_logging
    setup_logging(level=logging.INFO)
logger = logging.getLogger(__name__)

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from fetcher.fetch import Fetcher
from server.config import Config
from server.storage import (
    load_latest, save_latest, 
    load_watchlist, get_watchlist_devids, get_watchlist_devdescripts,
    add_to_watchlist, remove_from_watchlist, is_in_watchlist
)
from server.station_loader import refresh_stations
from ding.webhook import router as ding_router

app = FastAPI(title="ZJU Charger API", version="1.0.0")

logger.info("初始化 FastAPI 应用")

@app.on_event("startup")
async def startup_event():
    """服务器启动时执行的操作"""
    logger.info("服务器启动事件：开始刷新站点信息...")
    try:
        success = await refresh_stations()
        if success:
            logger.info("站点信息刷新成功")
        else:
            logger.warning("站点信息刷新失败，将使用已存在的缓存文件（如果存在）")
    except Exception as e:
        logger.error(f"启动时刷新站点信息失败: {str(e)}", exc_info=True)
        logger.warning("服务器将继续启动，但站点信息可能不是最新的")

# 添加 CORS 支持（必须在路由之前）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info("CORS 中间件已配置")

# 注册钉钉路由
app.include_router(ding_router)
logger.info("钉钉路由已注册")

# 静态文件服务（前端页面）- 必须在 API 路由之后
web_dir = Path(__file__).parent.parent / "web"
if web_dir.exists():
    app.mount("/web", StaticFiles(directory=str(web_dir), html=True), name="web")
    logger.info(f"静态文件服务已挂载: /web -> {web_dir}")
else:
    logger.warning(f"web 目录不存在: {web_dir}")

# 数据文件服务（GitHub Pages 使用）
data_dir = Path(__file__).parent.parent / "data"
if data_dir.exists():
    app.mount("/data", StaticFiles(directory=str(data_dir)), name="data")
    logger.info(f"数据文件服务已挂载: /data -> {data_dir}")
else:
    logger.warning(f"data 目录不存在: {data_dir}")

def _get_timestamp():
    """获取当前时间戳（UTC+8）"""
    tz_utc_8 = timezone(timedelta(hours=8))
    return datetime.now(tz_utc_8).isoformat()

@app.get("/")
async def root():
    """根路径 - 重定向到前端页面"""
    logger.info("访问根路径，重定向到 /web/")
    return RedirectResponse(url="/web/")

@app.get("/api")
async def api_info():
    """API 信息"""
    return {
        "message": "ZJU Charger API",
        "version": "1.0.0",
        "endpoints": {
            "GET /api/status": "实时查询所有站点",
            "POST /api/fetch-and-save": "抓取并保存数据（GitHub Action 使用）",
            "GET /api/cache": "返回缓存数据",
            "GET /api/watchlist": "返回关注列表站点状态",
            "GET /api/watchlist/list": "返回关注列表 devid 和 devdescript 列表",
            "POST /api/watchlist": "添加到关注列表（请求体：{\"devids\": [devid1, ...], \"devdescripts\": [\"站点名1\", ...]}，两者可同时提供或只提供其中一个）",
            "DELETE /api/watchlist": "从关注列表移除（请求体：{\"devids\": [devid1, ...], \"devdescripts\": [\"站点名1\", ...]}，两者可同时提供或只提供其中一个）"
        }
    }

@app.get("/api/status")
async def get_status():
    """实时查询所有站点状态"""
    logger.info("收到 /api/status 请求")
    openid = Config.get_openid()
    if not openid:
        logger.error("OPENID 环境变量未设置")
        raise HTTPException(
            status_code=500, 
            detail="OPENID 环境变量未设置"
        )
    
    try:
        logger.info("开始抓取数据...")
        async with Fetcher(openid) as fetcher:
            result = await fetcher.fetch_and_format()
            if result is None:
                logger.error("数据抓取失败：返回 None")
                raise HTTPException(
                    status_code=500,
                    detail="数据抓取失败"
                )
            station_count = len(result.get("stations", []))
            logger.info(f"数据抓取成功，共 {station_count} 个站点")
            return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"查询失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"查询失败: {str(e)}"
        )

@app.post("/api/fetch-and-save")
async def fetch_and_save():
    """抓取数据并保存到缓存（GitHub Action 调用）"""
    logger.info("收到 /api/fetch-and-save 请求（GitHub Action）")
    openid = Config.get_openid()
    if not openid:
        logger.error("OPENID 环境变量未设置")
        raise HTTPException(
            status_code=500,
            detail="OPENID 环境变量未设置"
        )
    
    try:
        logger.info("开始抓取并保存数据...")
        async with Fetcher(openid) as fetcher:
            result = await fetcher.fetch_and_format()
            if result is None:
                logger.error("数据抓取失败：返回 None")
                raise HTTPException(
                    status_code=500,
                    detail="数据抓取失败"
                )
            
            # 保存到 latest.json
            if save_latest(result):
                station_count = len(result.get("stations", []))
                logger.info(f"数据已成功保存，共 {station_count} 个站点")
                return {
                    "success": True,
                    "message": "数据已保存",
                    "data": result
                }
            else:
                logger.error("保存数据到 latest.json 失败")
                raise HTTPException(
                    status_code=500,
                    detail="保存数据失败"
                )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"操作失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"操作失败: {str(e)}"
        )

@app.get("/api/cache")
async def get_cache():
    """返回缓存数据（从 latest.json 读取）"""
    logger.info("收到 /api/cache 请求")
    data = load_latest()
    if data is None:
        logger.warning("缓存数据不存在")
        raise HTTPException(
            status_code=404,
            detail="缓存数据不存在"
        )
    station_count = len(data.get("stations", []))
    logger.info(f"返回缓存数据，共 {station_count} 个站点")
    return data

@app.get("/api/watchlist")
async def get_watchlist_status():
    """返回关注列表站点状态"""
    logger.info("收到 /api/watchlist 请求")
    openid = Config.get_openid()
    if not openid:
        logger.error("OPENID 环境变量未设置")
        raise HTTPException(
            status_code=500,
            detail="OPENID 环境变量未设置"
        )
    
    watchlist_devids = get_watchlist_devids()
    watchlist_devdescripts = get_watchlist_devdescripts()
    logger.info(f"关注列表 devids: {watchlist_devids}, devdescripts: {watchlist_devdescripts}")
    
    if not watchlist_devids and not watchlist_devdescripts:
        logger.info("关注列表为空")
        return {
            "updated_at": _get_timestamp(),
            "stations": [],
            "message": "关注列表为空"
        }
    
    try:
        logger.info("开始抓取关注列表数据...")
        async with Fetcher(openid) as fetcher:
            result = await fetcher.fetch_and_format()
            if result is None:
                logger.error("数据抓取失败：返回 None")
                raise HTTPException(
                    status_code=500,
                    detail="数据抓取失败"
                )
            
            # 将列表转换为集合以便快速查找
            watchlist_devids_set = set(watchlist_devids)
            watchlist_devdescripts_set = set(watchlist_devdescripts)
            
            # 过滤出关注列表中的站点（检查 devid 或 devdescript）
            filtered_stations = [
                station for station in result["stations"]
                if is_in_watchlist(
                    devids=station.get("devids"),
                    devdescript=station.get("name")
                )
            ]
            
            logger.info(f"返回 {len(filtered_stations)} 个关注站点")
            return {
                "updated_at": result["updated_at"],
                "stations": filtered_stations
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"查询失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"查询失败: {str(e)}"
        )

@app.get("/api/watchlist/list")
async def get_watchlist_list():
    """返回关注列表中的 devid 和 devdescript 列表"""
    logger.info("收到 /api/watchlist/list 请求")
    watchlist = load_watchlist()
    return {
        "devids": watchlist.get("devids", []),
        "devdescripts": watchlist.get("devdescripts", []),
        "updated_at": watchlist.get("updated_at", "")
    }

@app.post("/api/watchlist")
async def add_watchlist(request: Request):
    """添加 devid 或 devdescript 到关注列表
    
    请求体可以包含：
    - devids: devid 列表
    - devdescripts: devdescript（站点名称）列表
    两者可以同时提供，也可以只提供其中一个
    """
    try:
        body = await request.json()
        devids = body.get("devids")
        devdescripts = body.get("devdescripts")
        
        if not devids and not devdescripts:
            raise HTTPException(status_code=400, detail="缺少 devids 或 devdescripts 参数")
        
        logger.info(f"收到添加关注请求: devids={devids}, devdescripts={devdescripts}")
        
        # 验证数据是否存在（通过获取所有站点来验证）
        openid = Config.get_openid()
        if not openid:
            raise HTTPException(status_code=500, detail="OPENID 环境变量未设置")
        
        async with Fetcher(openid) as fetcher:
            result = await fetcher.fetch_and_format()
            if result is None:
                raise HTTPException(status_code=500, detail="无法验证数据，数据抓取失败")
            
            stations = result.get("stations", [])
            
            # 验证 devids
            if devids:
                if not isinstance(devids, list):
                    devids = [devids]
                
                # 收集所有有效的 devid
                all_devids = set()
                for station in stations:
                    station_devids = station.get("devids", [])
                    all_devids.update(station_devids)
                
                # 检查请求的 devid 是否都存在
                invalid_devids = [d for d in devids if int(d) not in all_devids]
                if invalid_devids:
                    raise HTTPException(
                        status_code=404,
                        detail=f"以下 devid 不存在: {invalid_devids}"
                    )
            
            # 验证 devdescripts
            if devdescripts:
                if not isinstance(devdescripts, list):
                    devdescripts = [devdescripts]
                
                # 收集所有有效的站点名称
                all_names = {s["name"] for s in stations}
                
                # 检查请求的站点名称是否都存在
                invalid_names = [n for n in devdescripts if n not in all_names]
                if invalid_names:
                    raise HTTPException(
                        status_code=404,
                        detail=f"以下站点名称不存在: {invalid_names}"
                    )
            
            # 添加到关注列表
            success = add_to_watchlist(devids=devids, devdescripts=devdescripts)
            if success:
                logger.info(f"成功添加关注: devids={devids}, devdescripts={devdescripts}")
                return {
                    "success": True,
                    "message": f"已添加到关注列表: devids={devids}, devdescripts={devdescripts}"
                }
            else:
                logger.info(f"已在关注列表中: devids={devids}, devdescripts={devdescripts}")
                return {
                    "success": False,
                    "message": f"已在关注列表中: devids={devids}, devdescripts={devdescripts}"
                }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"添加关注失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"操作失败: {str(e)}")

@app.delete("/api/watchlist")
async def remove_watchlist(request: Request):
    """从关注列表移除 devid 或 devdescript
    
    请求体可以包含：
    - devids: devid 列表
    - devdescripts: devdescript（站点名称）列表
    两者可以同时提供，也可以只提供其中一个
    """
    try:
        body = await request.json()
        devids = body.get("devids")
        devdescripts = body.get("devdescripts")
        
        if not devids and not devdescripts:
            raise HTTPException(status_code=400, detail="缺少 devids 或 devdescripts 参数")
        
        logger.info(f"收到移除关注请求: devids={devids}, devdescripts={devdescripts}")
        
        success = remove_from_watchlist(devids=devids, devdescripts=devdescripts)
        if success:
            logger.info(f"成功移除关注: devids={devids}, devdescripts={devdescripts}")
            return {
                "success": True,
                "message": f"已从关注列表移除: devids={devids}, devdescripts={devdescripts}"
            }
        else:
            logger.info(f"不在关注列表中: devids={devids}, devdescripts={devdescripts}")
            return {
                "success": False,
                "message": f"不在关注列表中: devids={devids}, devdescripts={devdescripts}"
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"移除关注失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"操作失败: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    logger.info(f"启动服务器: {Config.API_HOST}:{Config.API_PORT}")
    uvicorn.run(
        app, 
        host=Config.API_HOST, 
        port=Config.API_PORT,
        log_config=None  # 使用我们自己的日志配置
    )
