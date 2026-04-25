SELECT
    season,
    COUNT(*)                                    AS squad_size,
    ROUND(AVG(age), 1)                          AS avg_age,
    SUM(market_value_eur)                       AS total_value_eur,
    ROUND(AVG(market_value_eur), 0)             AS avg_value_eur,
    MAX(market_value_eur)                       AS highest_value_eur,
    MAX(CASE WHEN market_value_eur = (
        SELECT MAX(market_value_eur)
        FROM `liverpool-analytics.liverpool_analytics.tm_squad_values` s2
        WHERE s2.season = s.season
    ) THEN player END)                          AS highest_value_player
FROM `liverpool-analytics.liverpool_analytics.tm_squad_values` s
WHERE market_value_eur IS NOT NULL
GROUP BY season
ORDER BY season

