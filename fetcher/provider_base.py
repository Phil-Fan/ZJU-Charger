"""服务商抽象基类：定义所有充电桩服务商必须实现的接口"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class ProviderBase(ABC):
    """充电桩服务商抽象基类
    
    所有服务商适配器必须继承此类并实现抽象方法
    """
    
    @property
    @abstractmethod
    def provider_id(self) -> str:
        """服务商标识（如 'neptune'）"""
        pass
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """服务商显示名称（如 '尼普顿'）"""
        pass
    
    @abstractmethod
    async def fetch_stations(self, **kwargs) -> Optional[List[Dict[str, Any]]]:
        """获取站点列表
        
        Returns:
            站点列表，如果失败返回 None
        """
        pass
    
    @abstractmethod
    async def fetch_status(self, **kwargs) -> Optional[Dict[str, Any]]:
        """获取站点状态数据
        
        Returns:
            站点状态数据，如果失败返回 None
        """
        pass
    
    @abstractmethod
    def normalize_station(self, raw_station: Dict[str, Any]) -> Dict[str, Any]:
        """将服务商特定格式转换为统一格式
        
        Args:
            raw_station: 服务商原始数据格式
            
        Returns:
            统一格式的站点数据，必须包含以下字段：
            - provider_id: 服务商标识
            - provider_name: 服务商显示名称
            - id: 站点唯一ID
            - name: 站点名称
            - campus: 校区ID（原 areaid）
            - lat: 纬度
            - lon: 经度
            - free: 可用数量
            - total: 总数
            - used: 已用数量
            - error: 故障数量
            - devids: 设备ID列表（可选）
        """
        pass

