SELECT
    season,
    player,
    team,
    stat_type,
    COALESCE(SAFE_CAST(minutes AS FLOAT64), 0)        AS minutes,
    COALESCE(SAFE_CAST(goals AS FLOAT64), 0)          AS goals,
    COALESCE(SAFE_CAST(assists AS FLOAT64), 0)        AS assists,
    SAFE_CAST(xg AS FLOAT64)                          AS xg,
    SAFE_CAST(xag AS FLOAT64)                         AS xag,
    SAFE_CAST(shots AS FLOAT64)                       AS shots,
    SAFE_CAST(shots_on_tgt AS FLOAT64)                AS shots_on_tgt,
    SAFE_CAST(tackles AS FLOAT64)                     AS tackles,
    SAFE_CAST(interceptions AS FLOAT64)               AS interceptions,
    SAFE_CAST(fouls AS FLOAT64)                       AS fouls,
    SAFE_CAST(fouled AS FLOAT64)                      AS fouled,
    SAFE_CAST(offsides AS FLOAT64)                    AS offsides,
    SAFE_CAST(yellow_cards AS FLOAT64)                AS yellow_cards,
    SAFE_CAST(red_cards AS FLOAT64)                   AS red_cards
FROM `liverpool-analytics.liverpool_analytics.raw_player_stats`
WHERE team = 'Liverpool'