CREATE TABLE IF NOT EXISTS `liverpool-analytics.liverpool_analytics.graph_players` (
  player_id     STRING NOT NULL,
  name          STRING,
  nationality   STRING,
  position      STRING,
  photo_url     STRING,
  PRIMARY KEY (player_id) NOT ENFORCED
);

CREATE TABLE IF NOT EXISTS `liverpool-analytics.liverpool_analytics.graph_seasons` (
  season_id   STRING NOT NULL,
  label       STRING,
  points      INT64,
  wins        INT64,
  goals_for   INT64,
  PRIMARY KEY (season_id) NOT ENFORCED
);

CREATE TABLE IF NOT EXISTS `liverpool-analytics.liverpool_analytics.graph_clubs` (
  club_id STRING NOT NULL,
  name    STRING,
  PRIMARY KEY (club_id) NOT ENFORCED
);

CREATE TABLE IF NOT EXISTS `liverpool-analytics.liverpool_analytics.edge_played_in` (
  player_id   STRING NOT NULL,
  season_id   STRING NOT NULL,
  goals       FLOAT64,
  assists     FLOAT64,
  minutes     FLOAT64,
  shots       FLOAT64,
  PRIMARY KEY (player_id, season_id) NOT ENFORCED
);

CREATE TABLE IF NOT EXISTS `liverpool-analytics.liverpool_analytics.edge_played_with` (
  player_id_a     STRING NOT NULL,
  player_id_b     STRING NOT NULL,
  shared_seasons  INT64,
  combined_goals  FLOAT64,
  seasons_list    STRING,
  PRIMARY KEY (player_id_a, player_id_b) NOT ENFORCED
);

CREATE TABLE IF NOT EXISTS `liverpool-analytics.liverpool_analytics.edge_transferred_to` (
  player_id   STRING NOT NULL,
  club_id     STRING NOT NULL,
  season      STRING,
  direction   STRING,
  fee_eur     INT64,
  fee_text    STRING,
  PRIMARY KEY (player_id, club_id, season) NOT ENFORCED
);
