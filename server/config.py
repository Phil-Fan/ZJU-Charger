"""环境变量配置管理"""
import os
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv()

class Config:
    """配置类，从环境变量读取配置"""
    # TODO: 增加 openid pool 配置，并实现轮询使用
    # 微信 openId
    OPENID = os.getenv("OPENID", "")
    
    # 钉钉机器人配置
    DINGTALK_WEBHOOK = os.getenv("DINGTALK_WEBHOOK", "")
    DINGTALK_SECRET = os.getenv("DINGTALK_SECRET", "")
    
    # API 服务器配置
    API_HOST = os.getenv("API_HOST", "0.0.0.0")
    API_PORT = int(os.getenv("API_PORT", "8000"))
    
    @classmethod
    def validate(cls):
        """验证必需的配置项"""
        errors = []
        if not cls.OPENID:
            errors.append("OPENID 环境变量未设置")
        return errors
    
    @classmethod
    def get_openid(cls):
        """获取 openId，如果未设置则返回 None"""
        return cls.OPENID if cls.OPENID else None
