import { Router } from 'express';
import { query } from '../db/bigquery.js';

const router = Router();

router.get('/squad-value', async (req, res) => {
  try {
    const rows = await query(`
      SELECT season, squad_size, avg_age, total_value_eur,
             avg_value_eur, highest_value_eur, highest_value_player
      FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.liverpool_squad_value\`
      ORDER BY season DESC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/balance', async (req, res) => {
  try {
    const rows = await query(`
      SELECT season, spent_eur, received_eur, net_spend_eur,
             arrivals, departures, biggest_buy_eur, biggest_sale_eur, biggest_signing
      FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.liverpool_transfer_balance\`
      ORDER BY season DESC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { season, direction } = req.query;
    const conditions = [];
    const params = {};

    if (season) {
      conditions.push('season = @season');
      params.season = season;
    }
    if (direction) {
      conditions.push('direction = @direction');
      params.direction = direction;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query(
      `
      SELECT season, player, direction, from_club, to_club,
             fee_eur, fee_text, position, age_at_transfer
      FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.tm_transfers\`
      ${where}
      ORDER BY season DESC, fee_eur DESC NULLS LAST
    `,
      params
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/player-values', async (req, res) => {
  try {
    const { season } = req.query;
    const sql = `
      SELECT season, player, position, nationality, age,
             market_value_eur, goals, assists, minutes,
             contributions_per_10m
      FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.liverpool_player_values\`
      ${season ? 'WHERE season = @season' : ''}
      ORDER BY market_value_eur DESC
    `;
    const rows = await query(sql, season ? { season } : {});
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

