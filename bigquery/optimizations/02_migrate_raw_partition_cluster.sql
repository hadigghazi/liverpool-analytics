-- Recreate raw FBref tables with BigQuery partition + cluster (reduces scan for date/season filters).
-- Run in a maintenance window: brief lock while table is replaced. Idempotent in effect (same data).
-- Replace project/dataset if not liverpool-analytics / liverpool_analytics.
--
-- raw_matches: partition by match date; cluster by season + game_id (MERGE join keys)
CREATE OR REPLACE TABLE `liverpool-analytics.liverpool_analytics.raw_matches`
PARTITION BY date
CLUSTER BY season, game_id
OPTIONS (description = "FBref schedule/results; partitioned by match date")
AS
SELECT * FROM `liverpool-analytics.liverpool_analytics.raw_matches`;

-- raw_player_stats: no natural business date; partition by scrape day; cluster by season + player + stat_type
CREATE OR REPLACE TABLE `liverpool-analytics.liverpool_analytics.raw_player_stats`
PARTITION BY DATE(scraped_at)
CLUSTER BY season, player, stat_type
OPTIONS (description = "FBref player stats; partitioned by scrape date")
AS
SELECT * FROM `liverpool-analytics.liverpool_analytics.raw_player_stats`;
