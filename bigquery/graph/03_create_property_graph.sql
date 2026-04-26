-- Run after 01_create_tables.sql and 02_populate_tables.sql.

CREATE OR REPLACE PROPERTY GRAPH `liverpool-analytics.liverpool_analytics.LiverpoolGraph`
  NODE TABLES (
    `liverpool-analytics.liverpool_analytics.graph_players` AS Player
      KEY (player_id)
      LABEL Player
      PROPERTIES (player_id, name, nationality, position, photo_url),
    `liverpool-analytics.liverpool_analytics.graph_seasons` AS Season
      KEY (season_id)
      LABEL Season
      PROPERTIES (season_id, label, points, wins, goals_for),
    `liverpool-analytics.liverpool_analytics.graph_clubs` AS Club
      KEY (club_id)
      LABEL Club
      PROPERTIES (club_id, name)
  )
  EDGE TABLES (
    `liverpool-analytics.liverpool_analytics.edge_played_in` AS PlayedIn
      SOURCE KEY (player_id) REFERENCES Player
      DESTINATION KEY (season_id) REFERENCES Season
      LABEL PlayedIn
      PROPERTIES (goals, assists, minutes, shots),
    `liverpool-analytics.liverpool_analytics.edge_played_with` AS PlayedWith
      SOURCE KEY (player_id_a) REFERENCES Player
      DESTINATION KEY (player_id_b) REFERENCES Player
      LABEL PlayedWith
      PROPERTIES (shared_seasons, combined_goals, seasons_list),
    `liverpool-analytics.liverpool_analytics.edge_transferred_to` AS TransferredTo
      SOURCE KEY (player_id) REFERENCES Player
      DESTINATION KEY (club_id) REFERENCES Club
      LABEL TransferredTo
      PROPERTIES (season, direction, fee_eur, fee_text)
  );
