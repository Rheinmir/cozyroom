-- Run AFTER all worker nodes are up.
-- Registers workers, then distributes/references tables.

-- Register workers
SELECT citus_add_node('100.88.197.64', 5433);  -- worker-1 (Node 1, same host as coordinator)
SELECT citus_add_node('100.97.8.41',   5432);  -- worker-2 (Node 2)
SELECT citus_add_node('100.114.107.68',5432);  -- worker-3 (Node 3)

-- Verify workers registered
SELECT * FROM pg_dist_node;

-- Distribute large tables (sharded by id)
SELECT create_distributed_table('artists',              'id');
SELECT create_distributed_table('albums',               'id');
SELECT create_distributed_table('tracks',               'id');
SELECT create_distributed_table('videos',               'id');
SELECT create_distributed_table('ebooks',               'id');
SELECT create_distributed_table('trending_repos',       'id');
SELECT create_distributed_table('chat_logs',            'id');
SELECT create_distributed_table('comics_downloads',     'id');

-- Distribute trending tables by repo_id (co-located for JOIN performance)
SELECT create_distributed_table('trending_daily',        'repo_id');
SELECT create_distributed_table('trending_star_history', 'repo_id');

-- Reference tables (small, replicated to all workers)
SELECT create_reference_table('lyrics_cache');
SELECT create_reference_table('settings');
SELECT create_reference_table('playlists');
SELECT create_reference_table('playlist_tracks');
SELECT create_reference_table('lyrics_translations');
SELECT create_reference_table('playback_progress');
SELECT create_reference_table('agent_memory');
SELECT create_reference_table('agent_state');
SELECT create_reference_table('ai_model_prices');
SELECT create_reference_table('scheduled_tasks');
SELECT create_reference_table('comics_cache');
SELECT create_reference_table('comics_galleries');
SELECT create_reference_table('comics_pages');
