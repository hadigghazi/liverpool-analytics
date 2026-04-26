import { Router } from 'express';
import { query } from '../db/bigquery.js';
import { defaultSeason } from '../loadEnv.js';

const router = Router();

function projectTables() {
  const p = process.env.GCP_PROJECT;
  if (!p) throw new Error('GCP_PROJECT is not set');
  return {
    project: p,
    graph: `\`${p}.liverpool_analytics.LiverpoolGraph\``,
    perf: `\`${p}.liverpool_analytics.liverpool_player_performance\``,
    squad: `\`${p}.liverpool_analytics.tm_squad_values\``,
    edgeWith: `\`${p}.liverpool_analytics.edge_played_with\``,
    graphPlayers: `\`${p}.liverpool_analytics.graph_players\``,
    graphSeasons: `\`${p}.liverpool_analytics.graph_seasons\``,
    graphClubs: `\`${p}.liverpool_analytics.graph_clubs\``,
    edgePlayedIn: `\`${p}.liverpool_analytics.edge_played_in\``,
    edgeTransferred: `\`${p}.liverpool_analytics.edge_transferred_to\``,
  };
}

async function partnershipsViaGraph(playerName, limit) {
  const { graph } = projectTables();
  const sql = `
    SELECT
      partner_name,
      partner_position,
      partner_nationality,
      shared_seasons,
      combined_goals,
      seasons_list
    FROM GRAPH_TABLE(
      ${graph}
      MATCH (p:Player)-[e:PlayedWith]-(partner:Player)
      WHERE LOWER(p.name) = LOWER(@playerName)
      RETURN
        partner.name AS partner_name,
        partner.position AS partner_position,
        partner.nationality AS partner_nationality,
        e.shared_seasons AS shared_seasons,
        e.combined_goals AS combined_goals,
        e.seasons_list AS seasons_list
    )
    ORDER BY shared_seasons DESC, combined_goals DESC
    LIMIT @lim
  `;
  return query(sql, { playerName, lim: limit });
}

async function partnershipsViaSql(playerName, limit) {
  const { edgeWith, graphPlayers } = projectTables();
  const sql = `
    SELECT
      CASE
        WHEN LOWER(TRIM(pa.name)) = LOWER(TRIM(@playerName)) THEN pb.name
        ELSE pa.name
      END AS partner_name,
      CASE
        WHEN LOWER(TRIM(pa.name)) = LOWER(TRIM(@playerName)) THEN pb.position
        ELSE pa.position
      END AS partner_position,
      CASE
        WHEN LOWER(TRIM(pa.name)) = LOWER(TRIM(@playerName)) THEN pb.nationality
        ELSE pa.nationality
      END AS partner_nationality,
      e.shared_seasons AS shared_seasons,
      e.combined_goals AS combined_goals,
      e.seasons_list AS seasons_list
    FROM ${edgeWith} e
    JOIN ${graphPlayers} pa ON pa.player_id = e.player_id_a
    JOIN ${graphPlayers} pb ON pb.player_id = e.player_id_b
    WHERE LOWER(TRIM(pa.name)) = LOWER(TRIM(@playerName))
       OR LOWER(TRIM(pb.name)) = LOWER(TRIM(@playerName))
    ORDER BY shared_seasons DESC, combined_goals DESC
    LIMIT @lim
  `;
  return query(sql, { playerName, lim: limit });
}

// GET /api/graph/partnerships?player=Mohamed+Salah&limit=15
router.get('/partnerships', async (req, res) => {
  const player = (req.query.player || '').trim();
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '15'), 10) || 15));
  if (!player) {
    return res.status(400).json({ error: 'Missing query param: player' });
  }
  try {
    let rows;
    try {
      rows = await partnershipsViaGraph(player, limit);
    } catch (e) {
      console.warn('[graph] GRAPH_TABLE partnerships fallback:', e?.message || e);
      rows = await partnershipsViaSql(player, limit);
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/graph/squad-network?season=2425
router.get('/squad-network', async (req, res) => {
  const season = (req.query.season || defaultSeason || '2425').trim();
  try {
    const { perf, squad, edgeWith, graphPlayers } = projectTables();

    const nodes = await query(
      `
      SELECT
        p.player AS id,
        p.player AS label,
        COALESCE(
          NULLIF(TRIM(v.position), ''),
          NULLIF(TRIM(gp.position), ''),
          (
            SELECT t2.position
            FROM ${squad} t2
            WHERE LOWER(TRIM(t2.player)) = LOWER(TRIM(p.player))
              AND t2.position IS NOT NULL
              AND TRIM(t2.position) != ''
            ORDER BY t2.season DESC
            LIMIT 1
          ),
          ''
        ) AS position,
        COALESCE(v.nationality, v.nationality_full, '') AS nationality,
        COALESCE(v.market_value_eur, 0) AS market_value,
        COALESCE(gp.photo_url, v.photo_url, '') AS photo_url,
        p.goals AS goals,
        p.assists AS assists,
        p.minutes AS minutes,
        'player' AS node_type
      FROM ${perf} p
      LEFT JOIN ${squad} v
        ON LOWER(TRIM(v.player)) = LOWER(TRIM(p.player))
       AND v.season = @season
      LEFT JOIN ${graphPlayers} gp
        ON LOWER(TRIM(gp.name)) = LOWER(TRIM(p.player))
      WHERE p.season = @season
      ORDER BY p.minutes DESC NULLS LAST
    `,
      { season }
    );

    const edges = await query(
      `
      WITH season_players AS (
        SELECT DISTINCT player
        FROM ${perf}
        WHERE season = @season
      )
      SELECT
        pa.name AS source,
        pb.name AS target,
        e.shared_seasons AS weight,
        e.combined_goals AS combined_goals,
        e.seasons_list AS seasons_list,
        'PLAYED_WITH' AS edge_type
      FROM ${edgeWith} e
      JOIN ${graphPlayers} pa ON pa.player_id = e.player_id_a
      JOIN ${graphPlayers} pb ON pb.player_id = e.player_id_b
      JOIN season_players sp1 ON LOWER(TRIM(sp1.player)) = LOWER(TRIM(pa.name))
      JOIN season_players sp2 ON LOWER(TRIM(sp2.player)) = LOWER(TRIM(pb.name))
      WHERE @season IN UNNEST(SPLIT(COALESCE(e.seasons_list, ''), ','))
      ORDER BY e.shared_seasons DESC, e.combined_goals DESC
    `,
      { season }
    );

    res.json({ nodes, edges, season, view: 'teammates' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/graph/transfer-network?season=2425 — Player → Club (edge_transferred_to)
router.get('/transfer-network', async (req, res) => {
  const season = (req.query.season || defaultSeason || '2425').trim();
  try {
    const { perf, squad, graphPlayers, graphClubs, edgeTransferred } = projectTables();

    const playerNodes = await query(
      `
      SELECT
        p.player AS id,
        p.player AS label,
        COALESCE(
          NULLIF(TRIM(v.position), ''),
          NULLIF(TRIM(gp.position), ''),
          (
            SELECT t2.position
            FROM ${squad} t2
            WHERE LOWER(TRIM(t2.player)) = LOWER(TRIM(p.player))
              AND t2.position IS NOT NULL
              AND TRIM(t2.position) != ''
            ORDER BY t2.season DESC
            LIMIT 1
          ),
          ''
        ) AS position,
        COALESCE(v.nationality, v.nationality_full, gp.nationality, '') AS nationality,
        COALESCE(v.market_value_eur, 0) AS market_value,
        COALESCE(gp.photo_url, v.photo_url, '') AS photo_url,
        p.goals AS goals,
        p.assists AS assists,
        p.minutes AS minutes,
        'player' AS node_type
      FROM ${perf} p
      LEFT JOIN ${squad} v
        ON LOWER(TRIM(v.player)) = LOWER(TRIM(p.player)) AND v.season = @season
      LEFT JOIN ${graphPlayers} gp
        ON LOWER(TRIM(gp.name)) = LOWER(TRIM(p.player))
      WHERE p.season = @season
    `,
      { season }
    );

    const edgeRows = await query(
      `
      WITH squad AS (
        SELECT DISTINCT p.player
        FROM ${perf} p
        WHERE p.season = @season
      )
      SELECT
        gp.name AS source,
        CONCAT('club:', t.club_id) AS target,
        t.club_id AS club_id,
        1 AS weight,
        t.direction,
        t.fee_eur,
        t.fee_text,
        gc.name AS target_label,
        'TRANSFERRED_TO' AS edge_type
      FROM ${edgeTransferred} t
      JOIN ${graphPlayers} gp ON gp.player_id = t.player_id
      JOIN ${graphClubs} gc ON gc.club_id = t.club_id
      WHERE t.season = @season
        AND LOWER(TRIM(gp.name)) IN (SELECT LOWER(TRIM(s.player)) FROM squad s)
    `,
      { season }
    );

    const uids = [...new Set(edgeRows.map((e) => e.club_id).filter((x) => x != null && String(x) !== ''))];
    let clubNodes = [];
    if (uids.length > 0) {
      const rows = await query(
        `
        SELECT
          CONCAT('club:', club_id) AS id,
          name AS label,
          '' AS position,
          '' AS nationality,
          0 AS market_value,
          '' AS photo_url,
          CAST(NULL AS FLOAT64) AS goals,
          CAST(NULL AS FLOAT64) AS assists,
          CAST(NULL AS FLOAT64) AS minutes,
          'club' AS node_type
        FROM ${graphClubs}
        WHERE club_id IN UNNEST(@uids)
        `,
        { uids }
      );
      clubNodes = rows;
    }

    res.json({ nodes: [...playerNodes, ...clubNodes], edges: edgeRows, season, view: 'transfers' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/graph/player-season-hub?season=2425 — each Player → this Season (edge_played_in)
router.get('/player-season-hub', async (req, res) => {
  const season = (req.query.season || defaultSeason || '2425').trim();
  const seasonKey = `season:${season}`;
  try {
    const { perf, squad, graphPlayers, graphSeasons, edgePlayedIn } = projectTables();

    const [lbl] = await query(
      `SELECT label, points, wins, goals_for FROM ${graphSeasons} WHERE season_id = @season LIMIT 1`,
      { season }
    );
    const seasonNode = {
      id: seasonKey,
      label: (lbl && lbl.label) || season,
      position: (lbl && lbl.points != null) ? `Pts ${lbl.points} · W ${lbl.wins}` : 'Season',
      nationality: '',
      market_value: 0,
      photo_url: '',
      goals: lbl?.goals_for != null ? lbl.goals_for : null,
      assists: null,
      minutes: null,
      node_type: 'season',
    };

    const playerNodes = await query(
      `
      SELECT
        p.player AS id,
        p.player AS label,
        COALESCE(
          NULLIF(TRIM(v.position), ''),
          NULLIF(TRIM(gp.position), ''),
          (
            SELECT t2.position
            FROM ${squad} t2
            WHERE LOWER(TRIM(t2.player)) = LOWER(TRIM(p.player))
              AND t2.position IS NOT NULL
              AND TRIM(t2.position) != ''
            ORDER BY t2.season DESC
            LIMIT 1
          ),
          ''
        ) AS position,
        COALESCE(v.nationality, v.nationality_full, '') AS nationality,
        COALESCE(v.market_value_eur, 0) AS market_value,
        COALESCE(gp.photo_url, v.photo_url, '') AS photo_url,
        p.goals AS goals,
        p.assists AS assists,
        p.minutes AS minutes,
        'player' AS node_type
      FROM ${perf} p
      LEFT JOIN ${squad} v
        ON LOWER(TRIM(v.player)) = LOWER(TRIM(p.player)) AND v.season = @season
      LEFT JOIN ${graphPlayers} gp
        ON LOWER(TRIM(gp.name)) = LOWER(TRIM(p.player))
      WHERE p.season = @season
    `,
      { season }
    );

    const edgeRows = await query(
      `
      SELECT
        gp.name AS source,
        CONCAT('season:', epi.season_id) AS target,
        COALESCE(epi.minutes, 0) AS weight,
        epi.goals,
        epi.assists,
        epi.minutes,
        'PLAYED_IN' AS edge_type
      FROM ${edgePlayedIn} AS epi
      JOIN ${graphPlayers} gp ON gp.player_id = epi.player_id
      WHERE epi.season_id = @season
    `,
      { season }
    );

    res.json({
      nodes: [seasonNode, ...playerNodes],
      edges: edgeRows,
      season,
      view: 'player_season',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
