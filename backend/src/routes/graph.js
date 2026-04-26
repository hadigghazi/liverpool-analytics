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
        COALESCE(v.position, '') AS position,
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

    res.json({ nodes, edges, season });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
