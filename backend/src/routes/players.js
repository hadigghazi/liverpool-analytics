import { Router } from 'express';
import { query } from '../db/bigquery.js';
import { defaultSeason } from '../loadEnv.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { season = defaultSeason, sort = 'goals', order = 'DESC' } = req.query;
    const allowed = [
      'goals',
      'assists',
      'goal_contributions',
      'minutes',
      'shots',
      'shots_on_tgt',
      'shot_accuracy',
      'tackles',
      'interceptions',
      'fouls',
      'offsides',
    ];
    const col = allowed.includes(sort) ? sort : 'goals';
    const dir = order === 'ASC' ? 'ASC' : 'DESC';

    const rows = await query(
      `
      SELECT player, season, minutes, goals, assists, goal_contributions,
             shots, shots_on_tgt, shot_accuracy,
             tackles, interceptions, fouls, fouled, offsides,
             yellow_cards, red_cards
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
