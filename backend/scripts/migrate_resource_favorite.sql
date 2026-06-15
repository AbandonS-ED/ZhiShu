-- 资源表添加收藏字段
-- 执行方式: psql -U postgres -d zhishu -f backend/scripts/migrate_resource_favorite.sql

-- 添加 is_favorited 字段（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'resources' AND column_name = 'is_favorited'
    ) THEN
        ALTER TABLE resources ADD COLUMN is_favorited BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ 已添加 resources.is_favorited 字段';
    ELSE
        RAISE NOTICE '⏭️  resources.is_favorited 字段已存在，跳过';
    END IF;
END $$;

\echo '✅ 资源表收藏字段迁移完成'
