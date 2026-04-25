import { Router } from 'express';
import { query } from '../db/bigquery.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { season = '2425', sort = 'goals', order = 'DESC' } = req.query;
    const allowed = [
      'goals',
      'assists',
      'goal_contributions',
      'xg',
      'minutes',
      'tackles',
      'pass_accuracy',
      'shot_accuracy',
      'key_passes',
    ];
    const col = allowed.includes(sort) ? sort : 'goals';
    const dir = order === 'ASC' ? 'ASC' : 'DESC';

    const rows = await query(
      `
      SELECT player, season, minutes, goals, assists, goal_contributions,
             xg, xag, goals_vs_xg, shots, shot_accuracy,
             pass_accuracy, key_passes, prog_passes,
             tackles, interceptions, pressures, prog_carries
      FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.liverpool_player_performance\`
      WHERE season = @season
      ORDER BY ${col} ${dir}
    `,
      { season }
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
