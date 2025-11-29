"""Supabase 客户端管理"""

import logging
from typing import Optional
from supabase import create_client, Client
from server.config import Config

logger = logging.getLogger(__name__)

# 全局 Supabase 客户端实例（单例模式）
_supabase_client: Optional[Client] = None


def get_supabase_client() -> Optional[Client]:
    """获取 Supabase 客户端实例（单例模式）

    注意：应使用 Service Role Key（服务端密钥），而非 anon key。
    Service Role Key 会绕过 RLS 策略，适合服务端应用使用。
    在 Supabase Dashboard → Settings → API 中可以找到 Service Role Key。

    Returns:
        Supabase 客户端实例，如果配置未设置则返回 None
    """
    global _supabase_client

    # 如果客户端已初始化，直接返回
    if _supabase_client is not None:
        return _supabase_client

    # 检查配置
    if not Config.SUPABASE_URL or not Config.SUPABASE_KEY:
        logger.warning("Supabase 配置未设置，跳过数据库操作")
        return None

    try:
        # 创建 Supabase 客户端
        _supabase_client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
        logger.info("Supabase 客户端初始化成功")
        return _supabase_client
    except Exception as e:
        logger.error(f"Supabase 客户端初始化失败: {str(e)}", exc_info=True)
        return None


def reset_supabase_client():
    """重置 Supabase 客户端（用于测试或重新配置）"""
    global _supabase_client
    _supabase_client = None
    logger.info("Supabase 客户端已重置")
