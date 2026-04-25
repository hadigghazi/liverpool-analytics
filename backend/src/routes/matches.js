import { Router } from 'express';
import { query } from '../db/bigquery.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { season = '2425' } = req.query;
    const rows = await query(
      `
      SELECT game_id, date, gameweek, opponent, venue_type,
             lfc_goals, opp_goals, result, cumulative_points, match_number
      FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.liverpool_match_results\`
      WHERE season = @season
      ORDER BY date ASC
    `,
      { season }
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { season = '2425' } = req.query;
    const rows = await query(
      `
      SELECT * FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.liverpool_season_summary\`
      WHERE season = @season
      LIMIT 1
    `,
      { season }
    );
    res.json(rows[0] || {});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
