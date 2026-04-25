SELECT
    game_id,
    season,
    DATE(date) AS date,
    SAFE_CAST(gameweek AS INT64) AS gameweek,
    home_team,
    away_team,
    COALESCE(SAFE_CAST(home_goals AS INT64), 0) AS home_goals,
    COALESCE(SAFE_CAST(away_goals AS INT64), 0) AS away_goals,
    venue,
    CASE
        WHEN home_team = 'Liverpool' THEN 'home'
        ELSE 'away'
    END AS venue_type,
    CASE
        WHEN home_team = 'Liverpool' THEN away_team
        ELSE home_team
    END AS opponent,
    CASE
        WHEN home_team = 'Liverpool' THEN COALESCE(SAFE_CAST(home_goals AS INT64), 0)
        ELSE COALESCE(SAFE_CAST(away_goals AS INT64), 0)
    END AS lfc_goals,
    CASE
        WHEN home_team = 'Liverpool' THEN COALESCE(SAFE_CAST(away_goals AS INT64), 0)
        ELSE COALESCE(SAFE_CAST(home_goals AS INT64), 0)
    END AS opp_goals,
    CASE
        WHEN home_team = 'Liverpool' AND SAFE_CAST(home_goals AS INT64) > SAFE_CAST(away_goals AS INT64) THEN 'W'
        WHEN away_team = 'Liverpool' AND SAFE_CAST(away_goals AS INT64) > SAFE_CAST(home_goals AS INT64) THEN 'W'
        WHEN SAFE_CAST(home_goals AS INT64) = SAFE_CAST(away_goals AS INT64) AND home_goals IS NOT NULL THEN 'D'
        WHEN home_goals IS NULL THEN NULL
        ELSE 'L'
    END AS result
FROM `liverpool-analytics.liverpool_analytics.raw_matches`
WHERE home_team = 'Liverpool' OR away_team = 'Liverpool'