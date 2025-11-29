# Supabase 数据库表结构

本文档描述充电桩使用情况数据库的表结构设计。

## 数据库设计

采用两张表设计：

- **`stations` 表**：存储站点基础信息（几乎不变）
- **`usage` 表**：存储使用情况历史快照（每次抓取记录）

## 表结构

### 1. `stations` 表（站点基础信息）

存储站点的基本信息，这些信息一般不会频繁变化。

#### SQL 建表语句

```sql
CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    campus INTEGER,
    lat NUMERIC(10, 6),
    lon NUMERIC(10, 6),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_stations_provider ON stations(provider_id);
CREATE INDEX IF NOT EXISTS idx_stations_campus ON stations(campus);
```

#### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | TEXT | 站点唯一标识（主键），对应抓取数据中的 `id` 字段 |
| `name` | TEXT | 站点名称 |
| `provider_id` | TEXT | 服务商标识（如 "neptune"） |
| `provider_name` | TEXT | 服务商显示名称（如 "尼普顿"） |
| `campus` | INTEGER | 校区 ID（如 2143, 1774） |
| `lat` | NUMERIC(10,6) | 纬度 |
| `lon` | NUMERIC(10,6) | 经度 |
| `created_at` | TIMESTAMPTZ | 创建时间（自动设置） |
| `updated_at` | TIMESTAMPTZ | 更新时间（自动设置） |

### 2. `usage` 表（使用情况历史快照）

存储每次抓取时的站点使用情况数据，用于历史分析和趋势统计。

#### usage 建表语句

```sql
CREATE TABLE IF NOT EXISTS usage (
    id BIGSERIAL PRIMARY KEY,
    station_id TEXT NOT NULL,
    snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    free INTEGER NOT NULL DEFAULT 0,
    used INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    error INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT fk_usage_station FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
);

-- 创建索引（非常重要，用于查询性能）
CREATE INDEX IF NOT EXISTS idx_usage_station_time ON usage(station_id, snapshot_time DESC);
CREATE INDEX IF NOT EXISTS idx_usage_time ON usage(snapshot_time DESC);
```

#### usage 表字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL | 主键，自增 |
| `station_id` | TEXT | 站点唯一标识（外键 → `stations.id`） |
| `snapshot_time` | TIMESTAMPTZ | 抓取时间（UTC+8） |
| `free` | INTEGER | 可用充电桩数量 |
| `used` | INTEGER | 已使用充电桩数量 |
| `total` | INTEGER | 总充电桩数量 |
| `error` | INTEGER | 故障充电桩数量 |

## 索引说明

### `stations` 表索引

- `idx_stations_provider`: 按服务商查询站点
- `idx_stations_campus`: 按校区查询站点

### `usage` 表索引

- `idx_usage_station_time`: 按站点和时间查询（最重要的索引）
  - 用于查询特定站点的历史数据
  - 使用 `DESC` 排序，便于获取最新数据
- `idx_usage_time`: 按时间查询所有站点数据
  - 用于时间范围查询和统计分析

## 外键约束

`usage` 表的 `station_id` 字段通过外键关联到 `stations` 表的 `id` 字段：

- `ON DELETE CASCADE`: 当站点被删除时，相关的使用情况记录也会被自动删除

## 使用示例

### 查询某个站点的最新使用情况

```sql
SELECT * FROM usage
WHERE station_id = '29e30f45'
ORDER BY snapshot_time DESC
LIMIT 1;
```

### 查询某个站点最近 24 小时的使用情况

```sql
SELECT * FROM usage
WHERE station_id = '29e30f45'
  AND snapshot_time >= NOW() - INTERVAL '24 hours'
ORDER BY snapshot_time DESC;
```

### 查询所有站点的最新使用情况

```sql
SELECT DISTINCT ON (station_id) *
FROM usage
ORDER BY station_id, snapshot_time DESC;
```

### 统计某个站点的平均使用率

```sql
SELECT 
    station_id,
    AVG(used::numeric / NULLIF(total, 0)) * 100 AS avg_usage_rate
FROM usage
WHERE station_id = '29e30f45'
  AND snapshot_time >= NOW() - INTERVAL '7 days'
GROUP BY station_id;
```

## Row Level Security (RLS) 配置

Supabase 默认启用 RLS，需要配置策略才能写入数据。有两种方案：

### 方案 1：使用 Service Role Key（推荐）

**适用于服务端应用**，Service Role Key 会绕过 RLS 策略。

1. 在 Supabase Dashboard 中获取 Service Role Key：
   - 进入项目设置 → API
   - 复制 `service_role` key（注意：这是**私密密钥**，不要暴露给客户端）

2. 在 `.env` 文件中配置：

   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-service-role-key-here
   ```

### 方案 2：配置 RLS 策略

如果使用 `anon` key，需要配置 RLS 策略允许写入：

```sql
-- 为 stations 表启用 RLS（如果未启用）
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

-- 允许匿名用户插入和更新 stations 表
CREATE POLICY "Allow insert stations" ON stations
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow update stations" ON stations
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- 为 usage 表启用 RLS（如果未启用）
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;

-- 允许匿名用户插入 usage 表
CREATE POLICY "Allow insert usage" ON usage
    FOR INSERT
    WITH CHECK (true);
```

**注意**：使用 `anon` key + RLS 策略的方案安全性较低，建议生产环境使用 Service Role Key。

## 注意事项

1. **数据量增长**：由于每次抓取都会插入记录，`usage` 表会快速增长。建议定期清理旧数据或使用分区表。

2. **时间格式**：所有时间字段使用 `TIMESTAMPTZ`（带时区的时间戳），确保时区一致性。

3. **数据完整性**：插入 `usage` 记录前，确保对应的站点已存在于 `stations` 表中。

4. **性能优化**：批量插入时使用 `batch_insert_usage()` 函数，比单条插入效率更高。

5. **错误处理**：数据库操作失败不应影响主流程（`latest.json` 的保存）。

6. **安全性**：**强烈建议使用 Service Role Key**，它专为服务端应用设计，会绕过 RLS 策略，适合后台任务使用。
