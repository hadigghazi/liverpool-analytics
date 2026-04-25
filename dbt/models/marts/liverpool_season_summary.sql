SELECT
    season,
    COUNT(*)                                                          AS played,
    COUNTIF(result = 'W')                                             AS wins,
    COUNTIF(result = 'D')                                             AS draws,
    COUNTIF(result = 'L')                                             AS losses,
    SUM(lfc_goals)                                                    AS goals_scored,
    SUM(opp_goals)                                                    AS goals_conceded,
    SUM(lfc_goals) - SUM(opp_goals)                                   AS goal_diff,
    SUM(CASE WHEN result='W' THEN 3 WHEN result='D' THEN 1 ELSE 0 END) AS points,
    ROUND(AVG(lfc_goals), 2)                                          AS avg_goals_for,
    ROUND(AVG(opp_goals), 2)                                          AS avg_goals_against,
    COUNTIF(venue_type = 'home' AND result = 'W')                     AS home_wins,
    COUNTIF(venue_type = 'away' AND result = 'W')                     AS away_wins
FROM {{ ref('stg_matches') }}
WHERE result IS NOT NULL
GROUP BY season
ORDER BY season DESC
