-- 智枢(ZhiShu) 数据库初始化脚本
-- 用法: psql -U postgres -f init_db.sql

-- 创建数据库
SELECT 'CREATE DATABASE zhishu'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'zhishu')\gexec

-- 连接到 zhishu 数据库后执行（建表由 SQLAlchemy 自动完成，此处仅建库）
\echo '✅ 数据库 zhishu 创建完成（表结构由后端启动时自动创建）'
