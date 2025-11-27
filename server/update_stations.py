#!/usr/bin/env python3
"""
更新站点信息脚本

从 API 获取站点列表并保存到 data/stations.json

用法:
    python server/update_stations.py
    或
    cd server && python update_stations.py
"""
import asyncio
import logging
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from server.config import Config
from server.logging_config import setup_logging
from server.station_loader import refresh_stations

async def main():
    """主函数"""
    # 配置日志
    setup_logging(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    logger.info("=" * 60)
    logger.info("开始更新站点信息")
    logger.info("=" * 60)
    
    # 检查 OPENID 是否配置
    openid = Config.get_openid()
    if not openid:
        logger.error("OPENID 环境变量未设置，无法更新站点信息")
        logger.error("请设置 OPENID 环境变量或创建 .env 文件")
        sys.exit(1)
    
    # 刷新站点信息
    success = await refresh_stations()
    
    if success:
        logger.info("=" * 60)
        logger.info("站点信息更新成功！")
        logger.info("=" * 60)
        sys.exit(0)
    else:
        logger.error("=" * 60)
        logger.error("站点信息更新失败！")
        logger.error("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())

