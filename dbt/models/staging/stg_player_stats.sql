SELECT
    season,
    player,
    team,
    stat_type,
    COALESCE(SAFE_CAST(minutes AS FLOAT64), 0)        AS minutes,
    COALESCE(SAFE_CAST(goals AS FLOAT64), 0)          AS goals,
    COALESCE(SAFE_CAST(assists AS FLOAT64), 0)        AS assists,
    COALESCE(SAFE_CAST(xg AS FLOAT64), 0)             AS xg,
    COALESCE(SAFE_CAST(xag AS FLOAT64), 0)            AS xag,
    COALESCE(SAFE_CAST(shots AS FLOAT64), 0)          AS shots,
    COALESCE(SAFE_CAST(shots_on_tgt AS FLOAT64), 0)   AS shots_on_tgt,
    COALESCE(SAFE_CAST(passes_cmp AS FLOAT64), 0)     AS passes_cmp,
    COALESCE(SAFE_CAST(passes_att AS FLOAT64), 0)     AS passes_att,
    COALESCE(SAFE_CAST(key_passes AS FLOAT64), 0)     AS key_passes,
    COALESCE(SAFE_CAST(prog_passes AS FLOAT64), 0)    AS prog_passes,
    COALESCE(SAFE_CAST(tackles AS FLOAT64), 0)        AS tackles,
    COALESCE(SAFE_CAST(interceptions AS FLOAT64), 0)  AS interceptions,
    COALESCE(SAFE_CAST(pressures AS FLOAT64), 0)      AS pressures,
    COALESCE(SAFE_CAST(touches AS FLOAT64), 0)        AS touches,
    COALESCE(SAFE_CAST(prog_carries AS FLOAT64), 0)   AS prog_carries
FROM `liverpool-analytics.liverpool_analytics.raw_player_stats`
WHERE team = 'Liverpool'