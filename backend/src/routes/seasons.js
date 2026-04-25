import { Router } from 'express';
import { query } from '../db/bigquery.js';
import { defaultSeason } from '../loadEnv.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const rows = await query(
      `
      SELECT
        season,
        matches_count,
        players_count,
        is_complete,
        scraped_at
      FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.scraped_seasons\`
      ORDER BY season DESC
    `
    );

    // Also include current season even if not in scraped_seasons yet
    const seen = new Set(rows.map((r) => r.season));
    if (defaultSeason && !seen.has(defaultSeason)) {
      rows.unshift({
        season: defaultSeason,
        matches_count: null,
        players_count: null,
        is_complete: false,
        scraped_at: null,
      });
    }

    const seasons = rows.map((r) => ({
      season: r.season,
      label: seasonLabel(r.season),
      is_complete: r.is_complete,
      matches: r.matches_count,
    }));

    res.json(seasons);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function seasonLabel(season) {
  const y1 = `20${season.slice(0, 2)}`;
  const y2 = `20${season.slice(2)}`;
  return `${y1}/${season.slice(2)}`; // "2024/25"
}

export default router;

