SELECT
    game_id,
    season,
    date,
    gameweek,
    opponent,
    venue_type,
    lfc_goals,
    opp_goals,
    result,
    SUM(CASE WHEN result = 'W' THEN 3
             WHEN result = 'D' THEN 1
             ELSE 0 END)
        OVER (PARTITION BY season ORDER BY date)   AS cumulative_points,
    ROW_NUMBER()
        OVER (PARTITION BY season ORDER BY date)   AS match_number
FROM {{ ref('stg_matches') }}
WHERE result IS NOT NULL
ORDER BY season, date
