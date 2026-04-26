-- ---------------------------------------------------------------------------
-- graph_players (TM player_id when available, else fingerprint)
-- ---------------------------------------------------------------------------
MERGE `liverpool-analytics.liverpool_analytics.graph_players` AS T
USING (
  WITH perf_players AS (
    SELECT DISTINCT TRIM(player) AS player
    FROM `liverpool-analytics.liverpool_analytics.liverpool_player_performance`
    WHERE player IS NOT NULL AND TRIM(player) != ''
  ),
  latest_tm AS (
    SELECT * EXCEPT (rn)
    FROM (
      SELECT
        *,
        ROW_NUMBER() OVER (PARTITION BY player ORDER BY season DESC) AS rn
      FROM `liverpool-analytics.liverpool_analytics.tm_squad_values`
    )
    WHERE rn = 1
  )
  SELECT
    COALESCE(
      NULLIF(TRIM(tm.player_id), ''),
      CAST(ABS(FARM_FINGERPRINT(LOWER(TRIM(pp.player)))) AS STRING)
    ) AS player_id,
    pp.player AS name,
    COALESCE(tm.nationality, tm.nationality_full, '') AS nationality,
    COALESCE(tm.position, '') AS position,
    CASE
      WHEN tm.player_id IS NOT NULL AND TRIM(tm.player_id) != ''
        THEN CONCAT(
          'https://img.a.transfermarkt.technology/portrait/header/',
          TRIM(tm.player_id),
          '.jpg'
        )
      ELSE COALESCE(tm.photo_url, '')
    END AS photo_url
  FROM perf_players pp
  LEFT JOIN latest_tm tm
    ON LOWER(TRIM(tm.player)) = LOWER(TRIM(pp.player))
) AS S
ON T.player_id = S.player_id
WHEN MATCHED THEN
  UPDATE SET
    name = S.name,
    nationality = S.nationality,
    position = S.position,
    photo_url = S.photo_url
WHEN NOT MATCHED THEN
  INSERT (player_id, name, nationality, position, photo_url)
  VALUES (S.player_id, S.name, S.nationality, S.position, S.photo_url);

-- ---------------------------------------------------------------------------
-- graph_seasons
-- ---------------------------------------------------------------------------
MERGE `liverpool-analytics.liverpool_analytics.graph_seasons` AS T
USING (
  SELECT
    season AS season_id,
    CONCAT('20', SUBSTR(season, 1, 2), '/', SUBSTR(season, 3, 2)) AS label,
    CAST(points AS INT64) AS points,
    CAST(wins AS INT64) AS wins,
    CAST(goals_scored AS INT64) AS goals_for
  FROM `liverpool-analytics.liverpool_analytics.liverpool_season_summary`
) AS S
ON T.season_id = S.season_id
WHEN MATCHED THEN
  UPDATE SET
    label = S.label,
    points = S.points,
    wins = S.wins,
    goals_for = S.goals_for
WHEN NOT MATCHED THEN
  INSERT (season_id, label, points, wins, goals_for)
  VALUES (S.season_id, S.label, S.points, S.wins, S.goals_for);

-- ---------------------------------------------------------------------------
-- graph_clubs (distinct club names from transfers)
-- ---------------------------------------------------------------------------
MERGE `liverpool-analytics.liverpool_analytics.graph_clubs` AS T
USING (
  SELECT DISTINCT
    CAST(ABS(FARM_FINGERPRINT(LOWER(TRIM(club)))) AS STRING) AS club_id,
    TRIM(club) AS name
  FROM (
    SELECT from_club AS club
    FROM `liverpool-analytics.liverpool_analytics.tm_transfers`
    WHERE from_club IS NOT NULL AND TRIM(from_club) != ''
    UNION DISTINCT
    SELECT to_club AS club
    FROM `liverpool-analytics.liverpool_analytics.tm_transfers`
    WHERE to_club IS NOT NULL AND TRIM(to_club) != ''
  )
) AS S
ON T.club_id = S.club_id
WHEN MATCHED THEN
  UPDATE SET name = S.name
WHEN NOT MATCHED THEN
  INSERT (club_id, name)
  VALUES (S.club_id, S.name);

-- ---------------------------------------------------------------------------
-- edge_played_in
-- ---------------------------------------------------------------------------
MERGE `liverpool-analytics.liverpool_analytics.edge_played_in` AS T
USING (
  SELECT
    gp.player_id,
    p.season AS season_id,
    p.goals,
    p.assists,
    p.minutes,
    p.shots
  FROM `liverpool-analytics.liverpool_analytics.liverpool_player_performance` p
  JOIN `liverpool-analytics.liverpool_analytics.graph_players` gp
    ON LOWER(TRIM(gp.name)) = LOWER(TRIM(p.player))
) AS S
ON T.player_id = S.player_id AND T.season_id = S.season_id
WHEN MATCHED THEN
  UPDATE SET
    goals = S.goals,
    assists = S.assists,
    minutes = S.minutes,
    shots = S.shots
WHEN NOT MATCHED THEN
  INSERT (player_id, season_id, goals, assists, minutes, shots)
  VALUES (S.player_id, S.season_id, S.goals, S.assists, S.minutes, S.shots);

-- ---------------------------------------------------------------------------
-- edge_played_with (rebuild)
-- ---------------------------------------------------------------------------
TRUNCATE TABLE `liverpool-analytics.liverpool_analytics.edge_played_with`;

INSERT INTO `liverpool-analytics.liverpool_analytics.edge_played_with` (
  player_id_a,
  player_id_b,
  shared_seasons,
  combined_goals,
  seasons_list
)
SELECT
  pa.player_id AS player_id_a,
  pb.player_id AS player_id_b,
  COUNT(DISTINCT a.season) AS shared_seasons,
  SUM(COALESCE(a.goals, 0) + COALESCE(b.goals, 0)) AS combined_goals,
  STRING_AGG(DISTINCT a.season, ',' ORDER BY a.season) AS seasons_list
FROM `liverpool-analytics.liverpool_analytics.liverpool_player_performance` a
JOIN `liverpool-analytics.liverpool_analytics.liverpool_player_performance` b
  ON a.season = b.season
  AND LOWER(TRIM(a.player)) < LOWER(TRIM(b.player))
JOIN `liverpool-analytics.liverpool_analytics.graph_players` pa
  ON LOWER(TRIM(pa.name)) = LOWER(TRIM(a.player))
JOIN `liverpool-analytics.liverpool_analytics.graph_players` pb
  ON LOWER(TRIM(pb.name)) = LOWER(TRIM(b.player))
GROUP BY 1, 2;

-- ---------------------------------------------------------------------------
-- edge_transferred_to
-- ---------------------------------------------------------------------------
MERGE `liverpool-analytics.liverpool_analytics.edge_transferred_to` AS T
USING (
  SELECT
    gp.player_id,
    CAST(ABS(FARM_FINGERPRINT(LOWER(TRIM(
      CASE
        WHEN LOWER(TRIM(t.direction)) = 'in' THEN t.from_club
        ELSE t.to_club
      END
    )))) AS STRING) AS club_id,
    t.season,
    t.direction,
    t.fee_eur,
    t.fee_text
  FROM `liverpool-analytics.liverpool_analytics.tm_transfers` t
  JOIN `liverpool-analytics.liverpool_analytics.graph_players` gp
    ON LOWER(TRIM(gp.name)) = LOWER(TRIM(t.player))
  WHERE t.player IS NOT NULL AND TRIM(t.player) != ''
) AS S
ON T.player_id = S.player_id AND T.club_id = S.club_id AND T.season = S.season
WHEN MATCHED THEN
  UPDATE SET
    direction = S.direction,
    fee_eur = S.fee_eur,
    fee_text = S.fee_text
WHEN NOT MATCHED THEN
  INSERT (player_id, club_id, season, direction, fee_eur, fee_text)
  VALUES (S.player_id, S.club_id, S.season, S.direction, S.fee_eur, S.fee_text);
