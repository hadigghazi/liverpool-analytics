SELECT
    v.season,
    v.player,
    v.position,
    v.nationality,
    v.age,
    v.market_value_eur,
    p.goals,
    p.assists,
    p.minutes,
    p.shots,
    p.tackles,
    CASE
        WHEN v.market_value_eur > 0
        THEN ROUND(((COALESCE(p.goals,0) + COALESCE(p.assists,0)) / (v.market_value_eur / 10000000)), 2)
        ELSE NULL
    END AS contributions_per_10m
FROM {{ source('liverpool_ops', 'tm_squad_values') }} v
LEFT JOIN {{ ref('liverpool_player_performance') }} p
    ON LOWER(v.player) = LOWER(p.player)
    AND v.season = p.season
WHERE v.market_value_eur IS NOT NULL
-- No final ORDER BY: required for BQ table CTAS with cluster_by on this model.

