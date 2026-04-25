SELECT
    season,
    player,
    team,
    stat_type,
    COALESCE(minutes, 0)        AS minutes,
    COALESCE(goals, 0)          AS goals,
    COALESCE(assists, 0)        AS assists,
    COALESCE(xg, 0)             AS xg,
    COALESCE(xag, 0)            AS xag,
    COALESCE(shots, 0)          AS shots,
    COALESCE(shots_on_tgt, 0)   AS shots_on_tgt,
    COALESCE(passes_cmp, 0)     AS passes_cmp,
    COALESCE(passes_att, 0)     AS passes_att,
    COALESCE(key_passes, 0)     AS key_passes,
    COALESCE(prog_passes, 0)    AS prog_passes,
    COALESCE(tackles, 0)        AS tackles,
    COALESCE(interceptions, 0)  AS interceptions,
    COALESCE(pressures, 0)      AS pressures,
    COALESCE(touches, 0)        AS touches,
    COALESCE(prog_carries, 0)   AS prog_carries
FROM `{{ env_var('GCP_PROJECT') }}.liverpool_analytics.raw_player_stats`
WHERE team = 'Liverpool'
