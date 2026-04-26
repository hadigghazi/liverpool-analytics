SELECT
    season,
    player,
    minutes,
    goals,
    assists,
    COALESCE(goals, 0) + COALESCE(assists, 0)    AS goal_contributions,
    xg,
    xag,
    shots,
    shots_on_tgt,
    SAFE_DIVIDE(shots_on_tgt, shots)              AS shot_accuracy,
    tackles,
    interceptions,
    fouls,
    fouled,
    offsides,
    yellow_cards,
    red_cards
FROM {{ ref('stg_player_stats') }}
WHERE stat_type = 'combined'
  AND minutes > 0
-- No final ORDER BY: required for BQ table CTAS with cluster_by on this model.
