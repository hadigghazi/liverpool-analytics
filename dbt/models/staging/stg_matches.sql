SELECT
    game_id,
    season,
    DATE(date) AS date,
    gameweek,
    home_team,
    away_team,
    COALESCE(home_goals, 0) AS home_goals,
    COALESCE(away_goals, 0) AS away_goals,
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
        WHEN home_team = 'Liverpool' THEN COALESCE(home_goals, 0)
        ELSE COALESCE(away_goals, 0)
    END AS lfc_goals,
    CASE
        WHEN home_team = 'Liverpool' THEN COALESCE(away_goals, 0)
        ELSE COALESCE(home_goals, 0)
    END AS opp_goals,
    CASE
        WHEN home_team = 'Liverpool' AND home_goals > away_goals THEN 'W'
        WHEN away_team = 'Liverpool' AND away_goals > home_goals THEN 'W'
        WHEN home_goals = away_goals THEN 'D'
        WHEN home_goals IS NULL THEN NULL
        ELSE 'L'
    END AS result
FROM `{{ env_var('GCP_PROJECT') }}.liverpool_analytics.raw_matches`
WHERE home_team = 'Liverpool' OR away_team = 'Liverpool'
