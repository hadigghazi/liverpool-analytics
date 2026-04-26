-- SCD Type 2 for TM market values (maintained by transfermarkt/scrape_tm.py after each squad load).
CREATE TABLE IF NOT EXISTS `liverpool-analytics.liverpool_analytics.tm_player_value_history` (
  player_id STRING NOT NULL,
  player STRING,
  season STRING NOT NULL,
  market_value_eur INT64,
  valid_from DATE NOT NULL,
  valid_to DATE,
  is_current BOOL NOT NULL,
  recorded_at TIMESTAMP NOT NULL
);
