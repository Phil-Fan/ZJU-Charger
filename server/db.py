"""数据库操作模块：Supabase 数据库操作"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from server.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


def _get_timestamp():
    """获取当前时间戳（UTC+8）"""
    tz_utc_8 = timezone(timedelta(hours=8))
    return datetime.now(tz_utc_8).isoformat()


def upsert_station(station: Dict[str, Any]) -> bool:
    """插入或更新站点基础信息

    Args:
        station: 站点信息字典，包含：
            - id: 站点唯一标识
            - name: 站点名称
            - provider_id: 服务商标识
            - provider_name: 服务商显示名称
            - campus: 校区ID
            - lat: 纬度
            - lon: 经度

    Returns:
        是否成功
    """
    client = get_supabase_client()
    if client is None:
        return False

    try:
        station_id = station.get("id")
        if not station_id:
            logger.error("站点信息缺少 id 字段")
            return False

        # 准备要插入/更新的数据
        station_data = {
            "id": station_id,
            "name": station.get("name", ""),
            "provider_id": station.get("provider_id", ""),
            "provider_name": station.get("provider_name", ""),
            "campus": station.get("campus"),
            "lat": station.get("lat"),
            "lon": station.get("lon"),
            "updated_at": _get_timestamp(),
        }

        # 使用 upsert（如果存在则更新，不存在则插入）
        result = (
            client.table("stations").upsert(station_data, on_conflict="id").execute()
        )

        if result.data:
            logger.debug(f"站点 {station_id} 信息已更新")
            return True
        else:
            logger.warning(f"站点 {station_id} 更新失败：无返回数据")
            return False

    except Exception as e:
        error_msg = str(e)
        # 检查是否是 RLS 策略错误
        if "row-level security policy" in error_msg.lower():
            logger.error(
                "更新站点信息失败：违反 RLS 策略。"
                "请使用 Service Role Key（而非 anon key）或配置 RLS 策略。"
                "详见 docs/07-supabase-schema.md"
            )
        else:
            logger.error(f"更新站点信息失败: {error_msg}", exc_info=True)
        return False


def insert_usage(station_id: str, usage_data: Dict[str, Any]) -> bool:
    """插入单条使用情况记录

    Args:
        station_id: 站点唯一标识
        usage_data: 使用情况数据，包含：
            - free: 可用数量
            - used: 已用数量
            - total: 总数
            - error: 故障数量
            - snapshot_time: 抓取时间（可选，默认当前时间）

    Returns:
        是否成功
    """
    client = get_supabase_client()
    if client is None:
        return False

    try:
        usage_record = {
            "station_id": station_id,
            "snapshot_time": usage_data.get("snapshot_time", _get_timestamp()),
            "free": usage_data.get("free", 0),
            "used": usage_data.get("used", 0),
            "total": usage_data.get("total", 0),
            "error": usage_data.get("error", 0),
        }

        result = client.table("usage").insert(usage_record).execute()

        if result.data:
            return True
        else:
            logger.warning(f"插入使用情况记录失败：无返回数据")
            return False

    except Exception as e:
        logger.error(f"插入使用情况记录失败: {str(e)}", exc_info=True)
        return False


def batch_insert_usage(
    stations: List[Dict[str, Any]], snapshot_time: Optional[str] = None
) -> bool:
    """批量插入使用情况记录

    Args:
        stations: 站点列表，每个站点包含：
            - id: 站点唯一标识
            - free: 可用数量
            - used: 已用数量
            - total: 总数
            - error: 故障数量
        snapshot_time: 抓取时间（可选，默认当前时间）

    Returns:
        是否成功
    """
    client = get_supabase_client()
    if client is None:
        return False

    if not stations:
        logger.warning("站点列表为空，跳过批量插入")
        return True  # 空列表不算错误

    try:
        if snapshot_time is None:
            snapshot_time = _get_timestamp()

        # 准备批量插入的数据
        usage_records = []
        for station in stations:
            station_id = station.get("id")
            if not station_id:
                logger.warning(f"站点缺少 id 字段，跳过: {station.get('name', '未知')}")
                continue

            usage_record = {
                "station_id": station_id,
                "snapshot_time": snapshot_time,
                "free": station.get("free", 0),
                "used": station.get("used", 0),
                "total": station.get("total", 0),
                "error": station.get("error", 0),
            }
            usage_records.append(usage_record)

        if not usage_records:
            logger.warning("没有有效的使用情况记录可插入")
            return True

        # 批量插入
        result = client.table("usage").insert(usage_records).execute()

        if result.data:
            inserted_count = len(result.data)
            logger.info(f"成功批量插入 {inserted_count} 条使用情况记录")
            return True
        else:
            logger.warning("批量插入使用情况记录失败：无返回数据")
            return False

    except Exception as e:
        error_msg = str(e)
        # 检查是否是 RLS 策略错误
        if "row-level security policy" in error_msg.lower():
            logger.error(
                "批量插入使用情况记录失败：违反 RLS 策略。"
                "请使用 Service Role Key（而非 anon key）或配置 RLS 策略。"
                "详见 docs/07-supabase-schema.md"
            )
        else:
            logger.error(f"批量插入使用情况记录失败: {error_msg}", exc_info=True)
        return False
