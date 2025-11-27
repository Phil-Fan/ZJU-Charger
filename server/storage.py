"""数据存储管理：latest.json 和 watchlist.json"""
import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

# 数据目录路径
DATA_DIR = Path(__file__).parent.parent / "data"
LATEST_FILE = DATA_DIR / "latest.json"
WATCHLIST_FILE = DATA_DIR / "watchlist.json"

# 确保 data 目录存在
DATA_DIR.mkdir(exist_ok=True)

def _get_timestamp():
    """获取当前时间戳（UTC+8）"""
    tz_utc_8 = timezone(timedelta(hours=8))
    return datetime.now(tz_utc_8).isoformat()

# ========== latest.json 管理 ==========

def load_latest():
    """从 data/latest.json 读取缓存数据
    
    Returns:
        包含 stations 数组的字典，格式：
        {
            "updated_at": "2025-01-01T00:00:00+08:00",
            "stations": [
                {
                    "provider_id": "neptune",
                    "provider_name": "尼普顿",
                    "id": "站点ID",
                    "name": "站点名称",
                    "campus": 2143,
                    ...
                },
                ...
            ]
        }
        如果文件不存在或读取失败返回 None
    """
    if not LATEST_FILE.exists():
        return None
    
    try:
        with open(LATEST_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # 验证数据格式
            if not isinstance(data, dict) or "stations" not in data:
                print("Warning: latest.json 格式不正确，缺少 stations 字段")
                return None
            return data
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error loading latest.json: {e}")
        return None

def save_latest(data):
    """保存最新数据到 data/latest.json
    
    数据格式：
    {
        "updated_at": "2025-01-01T00:00:00+08:00",
        "stations": [
            {
                "provider_id": "neptune",
                "provider_name": "尼普顿",
                "id": "站点ID",
                "name": "站点名称",
                "campus": 2143,
                ...
            },
            ...
        ]
    }
    
    Args:
        data: 包含 stations 数组的字典，每个站点包含 provider_id 和 provider_name
    """
    try:
        # 确保数据是字典格式
        if not isinstance(data, dict):
            raise ValueError("数据必须是字典格式")
        
        # 确保包含 updated_at
        if "updated_at" not in data:
            data["updated_at"] = _get_timestamp()
        
        # 确保包含 stations 数组
        if "stations" not in data:
            raise ValueError("数据必须包含 stations 字段")
        
        with open(LATEST_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except (IOError, ValueError) as e:
        print(f"Error saving latest.json: {e}")
        return False

# ========== watchlist.json 管理 ==========

def load_watchlist():
    """从 data/watchlist.json 读取关注列表"""
    if not WATCHLIST_FILE.exists():
        # 如果文件不存在，创建默认结构
        default_data = {
            "devids": [],
            "devdescripts": [],
            "updated_at": _get_timestamp()
        }
        save_watchlist(default_data)
        return default_data
    
    try:
        with open(WATCHLIST_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # 确保两个字段都存在
            if "devids" not in data:
                data["devids"] = []
            if "devdescripts" not in data:
                data["devdescripts"] = []
            return data
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error loading watchlist.json: {e}")
        return {"devids": [], "devdescripts": [], "updated_at": _get_timestamp()}

def save_watchlist(data):
    """保存关注列表到 data/watchlist.json"""
    try:
        if "updated_at" not in data:
            data["updated_at"] = _get_timestamp()
        
        with open(WATCHLIST_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except IOError as e:
        print(f"Error saving watchlist.json: {e}")
        return False

def add_to_watchlist(devids=None, devdescripts=None):
    """添加 devid 或 devdescript 到关注列表
    
    Args:
        devids: devid 列表（可以是单个 devid 或列表）
        devdescripts: devdescript（站点名称）列表（可以是单个名称或列表）
    
    Returns:
        bool: 是否成功添加（如果有新增的项返回 True）
    """
    watchlist = load_watchlist()
    watchlist_devids = set(watchlist.get("devids", []))
    watchlist_devdescripts = set(watchlist.get("devdescripts", []))
    
    changed = False
    
    # 处理 devids
    if devids is not None:
        if not isinstance(devids, list):
            devids = [devids]
        new_devids = {int(d) for d in devids if d is not None}
        before_count = len(watchlist_devids)
        watchlist_devids.update(new_devids)
        if len(watchlist_devids) > before_count:
            changed = True
    
    # 处理 devdescripts
    if devdescripts is not None:
        if not isinstance(devdescripts, list):
            devdescripts = [devdescripts]
        new_devdescripts = {str(d) for d in devdescripts if d}
        before_count = len(watchlist_devdescripts)
        watchlist_devdescripts.update(new_devdescripts)
        if len(watchlist_devdescripts) > before_count:
            changed = True
    
    if changed:
        watchlist["devids"] = sorted(list(watchlist_devids))
        watchlist["devdescripts"] = sorted(list(watchlist_devdescripts))
        watchlist["updated_at"] = _get_timestamp()
        save_watchlist(watchlist)
        return True
    return False

def remove_from_watchlist(devids=None, devdescripts=None):
    """从关注列表移除 devid 或 devdescript
    
    Args:
        devids: devid 列表（可以是单个 devid 或列表）
        devdescripts: devdescript（站点名称）列表（可以是单个名称或列表）
    
    Returns:
        bool: 是否成功移除（如果有移除的项返回 True）
    """
    watchlist = load_watchlist()
    watchlist_devids = set(watchlist.get("devids", []))
    watchlist_devdescripts = set(watchlist.get("devdescripts", []))
    
    changed = False
    
    # 处理 devids
    if devids is not None:
        if not isinstance(devids, list):
            devids = [devids]
        remove_devids = {int(d) for d in devids if d is not None}
        before_count = len(watchlist_devids)
        watchlist_devids -= remove_devids
        if len(watchlist_devids) < before_count:
            changed = True
    
    # 处理 devdescripts
    if devdescripts is not None:
        if not isinstance(devdescripts, list):
            devdescripts = [devdescripts]
        remove_devdescripts = {str(d) for d in devdescripts if d}
        before_count = len(watchlist_devdescripts)
        watchlist_devdescripts -= remove_devdescripts
        if len(watchlist_devdescripts) < before_count:
            changed = True
    
    if changed:
        watchlist["devids"] = sorted(list(watchlist_devids))
        watchlist["devdescripts"] = sorted(list(watchlist_devdescripts))
        watchlist["updated_at"] = _get_timestamp()
        save_watchlist(watchlist)
        return True
    return False

def get_watchlist_devids():
    """获取关注列表中的 devid 列表"""
    watchlist = load_watchlist()
    return watchlist.get("devids", [])

def get_watchlist_devdescripts():
    """获取关注列表中的 devdescript（站点名称）列表"""
    watchlist = load_watchlist()
    return watchlist.get("devdescripts", [])

def is_in_watchlist(devids=None, devdescript=None):
    """检查站点是否在关注列表中
    
    Args:
        devids: devid 列表（可以是单个 devid 或列表）
        devdescript: devdescript（站点名称）
    
    Returns:
        bool: 如果站点的任何 devid 或 devdescript 在关注列表中，返回 True
    """
    watchlist = load_watchlist()
    watchlist_devids = set(watchlist.get("devids", []))
    watchlist_devdescripts = set(watchlist.get("devdescripts", []))
    
    # 检查 devids
    if devids is not None:
        if not isinstance(devids, list):
            devids = [devids]
        devids_set = {int(d) for d in devids if d is not None}
        if devids_set & watchlist_devids:
            return True
    
    # 检查 devdescript
    if devdescript and devdescript in watchlist_devdescripts:
        return True
    
    return False
