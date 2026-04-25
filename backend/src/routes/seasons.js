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
    const normalizedDefault = normalizeSeason(defaultSeason);
    const normalizedRows = rows.map((r) => ({
      ...r,
      season: normalizeSeason(r.season),
    }));

    // Only return seasons that actually have FBref data, otherwise selecting them
    // makes the dashboards look "empty" even though Transfermarkt has history.
    const filtered = normalizedRows.filter((r) => {
      const mc = Number(r.matches_count ?? 0);
      const pc = Number(r.players_count ?? 0);
      return mc > 0 || pc > 0;
    });

    const seen = new Set(filtered.map((r) => r.season));
    if (normalizedDefault && !seen.has(normalizedDefault)) {
      filtered.unshift({
        season: normalizedDefault,
        matches_count: null,
        players_count: null,
        is_complete: false,
        scraped_at: null,
      });
    }

    const seasons = filtered.map((r) => ({
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

function normalizeSeason(season) {
  if (season == null) return null;
  const s = String(season).trim();

  // Already in "2425" form
  if (/^\d{4}$/.test(s) && !s.startsWith('20')) return s;

  // "2024/25" or "2024-25" -> "2425"
  const m = s.match(/^(20\d{2})\D+(\d{2})$/);
  if (m) return `${m[1].slice(2)}${m[2]}`;

  // "2024" -> "2425"
  if (/^20\d{2}$/.test(s)) {
    const y = Number(s);
    return `${String(y % 100).padStart(2, '0')}${String((y + 1) % 100).padStart(2, '0')}`;
  }

  return s;
}

function seasonLabel(season) {
  const y1 = `20${season.slice(0, 2)}`;
  const y2 = `20${season.slice(2)}`;
  return `${y1}/${season.slice(2)}`; // "2024/25"
}

export default router;

/* old code removed below */
