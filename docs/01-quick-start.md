# 快速开始

本文档讲解用户侧如何使用 ZJU Charger 项目。

## Web 页面

### 访问方式

1. **在线访问**：部署后的 React SPA（如 `https://charger.philfan.cn/web/`）。
2. **本地开发**：在 `web/` 目录运行构建工具，即可通过 `http://localhost:5173` 预览前端；后端只需暴露 `/api/*` 接口（可运行 FastAPI 或任意兼容 API 服务）。

### 本地开发步骤

```bash
cd web
npm install
cp .env.example .env   # 写入 VITE_AMAP_KEY（高德地图 JS SDK Key）
npm run dev            # 启动 Vite 开发服务器
```

构建部署版本：

```bash
npm run build          # 输出 dist/
npm run preview        # 本地预览 dist/ 内容
```

构建后将 `dist/` 部署到任意静态托管（Pages、Cloudflare、Caddy 等），FastAPI 或其他 API 服务仅负责 `/api/*`。保持 `.env` 内的 `VITE_AMAP_KEY` 与可选 `VITE_API_BASE`，确保前端能访问正确的高德与 API。

### 主要功能

- **React 组件化界面**：Header、筛选器、站点列表和地图均为独立组件，逻辑更清晰。
- **AMap + Apache ECharts**：使用 `echarts-extension-amap` 渲染单一高德底图，不再需要在 OSM/腾讯之间手动切换。
- **站点列表与关注**：支持校区、服务商筛选，关注（收藏）状态与主题偏好存储在 `localStorage`，多标签页自动同步。
- **自动刷新**：按照 `/api/config` 返回的 `fetch_interval` 周期刷新（默认 60 秒）。
- **夜间提醒与摘要**：00:10–05:50 自动显示夜间提示，并在界面顶部展示各校区空闲数摘要。

### 使用技巧

- 点击地图标记可查看站点详情；右下角按钮可定位当前位置或导出 PNG 截图。
- 关注列表存储在浏览器 `localStorage` 中，清除数据会导致关注记录丢失。
- 若未设置 `VITE_AMAP_KEY`，地图区域会提示错误，请到高德开放平台申请 Web JS Key。

## iOS 快捷指令

### 安装方式

1. 下载快捷指令文件（`.shortcut` 格式）
2. 在 iOS 设备上打开快捷指令 App
3. 导入下载的快捷指令文件

### 使用方法

1. 在快捷指令 App 中运行对应的快捷指令
2. 或通过 Siri 语音命令运行（如果已配置）
3. 快捷指令会自动查询关注站点的状态并显示结果

### 功能说明

- **关注点快速查询**：快速查询已关注的充电桩站点状态
- **自定义 API 地址**：可以在快捷指令中配置 API 服务器地址

详细使用说明请参考 [Script 快捷指令文档](./06-script-shortcuts.md)。

## 钉钉机器人

### 配置方式

1. 在钉钉群聊中添加自定义机器人
2. 获取 Webhook 地址和签名密钥
3. 在服务器环境变量中配置：

   ```env
   DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx
   DINGTALK_SECRET=your_secret_here
   ```

### DingBot 使用方法

在钉钉群聊中发送命令：

- `/全部` - 查询所有站点状态
- `/关注` - 查询关注站点状态（需要先配置关注列表）
- `/帮助` - 显示帮助信息

详细配置说明请参考 [钉钉机器人文档](./05-dingbot.md)。

## API 接口

### 基础接口

- `GET /api/status` - 查询所有站点状态
  - 参数：`?provider=neptune` - 筛选特定服务商
  - 参数：`?id=xxx` - 查询指定站点
- `GET /api/providers` - 获取可用服务商列表
- `GET /api/config` - 获取前端配置信息

### 使用示例

```bash
# 查询所有站点
curl http://localhost:8000/api/status

# 查询特定服务商的站点
curl http://localhost:8000/api/status?provider=neptune

# 查询指定站点
curl http://localhost:8000/api/status?id=29e30f45
```

## 常见问题

### Q: Web 页面无法访问？

A: 检查后端服务器是否正常运行，确认端口是否正确。

### Q: 快捷指令查询失败？

A: 检查 API 服务器地址配置是否正确，确保网络连接正常。

### Q: 钉钉机器人无响应？

A: 检查环境变量配置是否正确，确认服务器已启动并正常运行。

### Q: 数据不更新？

A: 系统会自动定时抓取数据，如果长时间不更新，请检查服务器日志。
