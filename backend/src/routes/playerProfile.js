import { Router } from 'express';
import { spawn, spawnSync } from 'child_process';
import path from 'path';
import { query } from '../db/bigquery.js';

const router = Router();

function decodeName(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function normalizeUrl(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (!s) return '';
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return `https://www.transfermarkt.com${s}`;
  return s;
}

function tmPortraitUrl(playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return '';
  // This is a stable pattern used by TM/CDN for profile portraits.
  return `https://img.a.transfermarkt.technology/portrait/header/${encodeURIComponent(pid)}.jpg`;
}

function runTmProfileScrape(playerId, playerSlug, playerName) {
  const script =
    process.env.TM_SCRAPER_SCRIPT ||
    path.join(process.cwd(), 'transfermarkt', 'scrape_tm.py');
  const py = process.env.TM_PYTHON_BIN || 'python3';
  const args = [
    '-u',
    script,
    '--cache-profile',
    String(playerId),
    String(playerSlug),
    String(playerName || ''),
  ];
  const out = spawnSync(py, args, {
    encoding: 'utf-8',
    env: { ...process.env },
    timeout: Number(process.env.TM_PROFILE_TIMEOUT_MS || 120000),
  });
  if (out.error || out.status !== 0) {
    console.error('[tm profile scrape]', out.stderr || out.error?.message || out.status);
    return false;
  }
  return true;
}

function kickOffTmProfileScrape(playerId, playerSlug, playerName) {
  try {
    const script =
      process.env.TM_SCRAPER_SCRIPT ||
      path.join(process.cwd(), 'transfermarkt', 'scrape_tm.py');
    const py = process.env.TM_PYTHON_BIN || 'python3';
    const args = [
      '-u',
      script,
      '--cache-profile',
      String(playerId),
      String(playerSlug),
      String(playerName || ''),
    ];

    const child = spawn(py, args, {
      env: { ...process.env },
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
    return true;
  } catch (e) {
    console.error('[tm profile scrape kickoff]', e?.message || e);
    return false;
  }
}

// GET /api/player-profile/:playerName?season=2425&refresh=1
router.get('/:playerName', async (req, res) => {
  const raw = req.params.playerName;
  const playerName = decodeName(raw).trim();
  const { season = '2425', refresh } = req.query;
  const like = `%${playerName.replace(/%/g, '')}%`;

  try {
    const exactRows = await query(
      `
      SELECT player, player_id, player_slug, position, nationality, nationality_full,
             age, market_value_eur, photo_url, dob, height, foot, contract_expires
      FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.tm_squad_values\`
      WHERE season = @season
        AND LOWER(TRIM(player)) = LOWER(TRIM(@exact))
      LIMIT 1
    `,
      { season, exact: playerName }
    );

    const fuzzyRows =
      exactRows.length > 0
        ? exactRows
        : await query(
            `
        SELECT player, player_id, player_slug, position, nationality, nationality_full,
               age, market_value_eur, photo_url, dob, height, foot, contract_expires
        FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.tm_squad_values\`
        WHERE season = @season
          AND LOWER(player) LIKE LOWER(@like)
        ORDER BY LENGTH(player) ASC
        LIMIT 1
      `,
            { season, like }
          );

    let tm = fuzzyRows[0] || null;
    let tmSeasonUsed = season;

    // If TM squad scrape for this season is missing/partial, fall back to any season.
    if (!tm) {
      const anySeasonRows = await query(
        `
        SELECT player, player_id, player_slug, position, nationality, nationality_full,
               age, market_value_eur, photo_url, dob, height, foot, contract_expires, season
        FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.tm_squad_values\`
        WHERE LOWER(TRIM(player)) = LOWER(TRIM(@exact))
           OR LOWER(player) LIKE LOWER(@like)
        ORDER BY season DESC
        LIMIT 1
      `,
        { exact: playerName, like }
      );
      tm = anySeasonRows[0] || null;
      tmSeasonUsed = tm?.season || season;
    }

    if (!tm) {
      return res.status(404).json({ error: 'Player not found in Transfermarkt squad data (try re-scraping the season)' });
    }

    const pid = tm.player_id || '';
    const slug = tm.player_slug || '';

    let cached = null;
    if (pid) {
      const cachedRows = await query(
        `
        SELECT *
        FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.tm_player_profiles\`
        WHERE player_id = @pid
        LIMIT 1
      `,
        { pid }
      );
      cached = cachedRows[0] || null;
    }

    const refreshRequested = refresh === '1' || refresh === 'true';

    // Important: don't block the API response on a slow TM scrape.
    // If cache is missing, we return squad-level info immediately and
    // optionally kickoff a background scrape for next time.
    const canScrape = Boolean(pid && slug);
    const cacheHit = Boolean(cached);

    if (refreshRequested && canScrape) {
      runTmProfileScrape(pid, slug, tm.player || playerName);
      const cachedRows2 = await query(
        `
        SELECT *
        FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.tm_player_profiles\`
        WHERE player_id = @pid
        LIMIT 1
      `,
        { pid }
      );
      cached = cachedRows2[0] || null;
    } else if (!cacheHit && canScrape) {
      kickOffTmProfileScrape(pid, slug, tm.player || playerName);
    }

    let mvHistory = [];
    if (cached?.mv_history_json) {
      try {
        mvHistory = JSON.parse(cached.mv_history_json);
      } catch {
        mvHistory = [];
      }
    }

    const profile = {
      ...tm,
      player: tm.player,
      market_value_eur: tm.market_value_eur,
      photo_url: (() => {
        const fromCache = normalizeUrl((cached && cached.photo_url) || tm.photo_url || '');
        // If TM returns a placeholder / blocked image, always prefer portrait-by-id.
        const portrait = tmPortraitUrl(pid);
        if (!fromCache) return portrait;
        const lc = fromCache.toLowerCase();
        if (lc.includes('no_picture') || lc.includes('nopicture') || lc.includes('default')) return portrait;
        // Sometimes TM returns a generic "blocked" icon from the CDN; portrait still works.
        return fromCache;
      })(),
      height: (cached && cached.height) || tm.height || '',
      foot: (cached && cached.foot) || tm.foot || '',
      contract_expires: (cached && cached.contract_expires) || tm.contract_expires || '',
      dob: (cached && cached.dob) || tm.dob || '',
      nationality_full: tm.nationality_full || tm.nationality || '',
      agent: (cached && cached.agent) || '',
    };

    const perfRows = await query(
      `
      SELECT season, goals, assists, minutes, shots, shots_on_tgt,
             tackles, interceptions, fouls, fouled, offsides,
             yellow_cards, red_cards, goal_contributions, shot_accuracy
      FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.liverpool_player_performance\`
      WHERE LOWER(TRIM(player)) = LOWER(TRIM(@name))
      ORDER BY season ASC
    `,
      { name: tm.player }
    );

    const mvRows = await query(
      `
      SELECT season, market_value_eur, age
      FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.tm_squad_values\`
      WHERE LOWER(TRIM(player)) = LOWER(TRIM(@name))
      ORDER BY season ASC
    `,
      { name: tm.player }
    );

    const transferRows = await query(
      `
      SELECT season, direction, from_club, to_club, fee_eur, fee_text, position
      FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.tm_transfers\`
      WHERE LOWER(TRIM(player)) = LOWER(TRIM(@name))
      ORDER BY season ASC
    `,
      { name: tm.player }
    );

    res.json({
      profile,
      performance: perfRows,
      marketValues: mvRows,
      transfers: transferRows,
      tmProfileExtras: { mvHistory },
      tmCache: { hit: Boolean(cached), player_id: pid || null },
      tmSeasonUsed,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
