SELECT
    s.season,
    s.player,
    s.minutes,
    s.goals,
    s.assists,
    s.goals + s.assists                              AS goal_contributions,
    s.xg,
    s.xag,
    SAFE_DIVIDE(s.goals, s.xg)                      AS goals_vs_xg,
    sh.shots,
    sh.shots_on_tgt,
    SAFE_DIVIDE(sh.shots_on_tgt, sh.shots)           AS shot_accuracy,
    p.passes_cmp,
    p.passes_att,
    SAFE_DIVIDE(p.passes_cmp, p.passes_att)          AS pass_accuracy,
    p.key_passes,
    p.prog_passes,
    d.tackles,
    d.interceptions,
    d.pressures,
    po.touches,
    po.prog_carries
FROM {{ ref('stg_player_stats') }} s
LEFT JOIN {{ ref('stg_player_stats') }} sh
    ON s.player = sh.player AND s.season = sh.season AND sh.stat_type = 'shooting'
LEFT JOIN {{ ref('stg_player_stats') }} p
    ON s.player = p.player AND s.season = p.season AND p.stat_type = 'passing'
LEFT JOIN {{ ref('stg_player_stats') }} d
    ON s.player = d.player AND s.season = d.season AND d.stat_type = 'defense'
LEFT JOIN {{ ref('stg_player_stats') }} po
    ON s.player = po.player AND s.season = po.season AND po.stat_type = 'possession'
WHERE s.stat_type = 'standard'
  AND s.minutes > 0
ORDER BY s.goals DESC
