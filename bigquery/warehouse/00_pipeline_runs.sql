-- Operational lineage: one row per scraper / job run (also created from Python on first use).
CREATE TABLE IF NOT EXISTS `liverpool-analytics.liverpool_analytics.pipeline_runs` (
  run_id STRING NOT NULL,
  pipeline STRING NOT NULL,
  season STRING,
  started_at TIMESTAMP NOT NULL,
  finished_at TIMESTAMP,
  rows_written INT64,
  status STRING NOT NULL,
  error_msg STRING
);
