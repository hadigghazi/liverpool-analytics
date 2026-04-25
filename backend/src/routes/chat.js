import { Router } from 'express';
import OpenAI from 'openai';
import { query } from '../db/bigquery.js';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  try {
    const season = '2425';

    const [matches, summary, players] = await Promise.all([
      query(
        `
        SELECT date, opponent, venue_type, lfc_goals, opp_goals, result, cumulative_points
        FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.liverpool_match_results\`
        WHERE season = @season ORDER BY date DESC LIMIT 15
      `,
        { season }
      ),
      query(
        `
        SELECT * FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.liverpool_season_summary\`
        WHERE season = @season LIMIT 1
      `,
        { season }
      ),
      query(
        `
        SELECT player, goals, assists, xg, minutes, tackles, pass_accuracy
        FROM \`${process.env.GCP_PROJECT}.liverpool_analytics.liverpool_player_performance\`
        WHERE season = @season ORDER BY goals DESC LIMIT 10
      `,
        { season }
      ),
    ]);

    const systemPrompt = `You are an expert Liverpool FC tactical analyst for the 2024-25 Premier League season.
Answer questions using ONLY the data below. Be concise, specific, and reference actual numbers.
If asked about something not in the data, say so clearly.

SEASON SUMMARY:
${JSON.stringify(summary[0], null, 2)}

LAST 15 MATCHES (most recent first):
${JSON.stringify(matches, null, 2)}

TOP PLAYERS (by goals):
${JSON.stringify(players, null, 2)}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6),
        { role: 'user', content: message },
      ],
    });

    res.json({
      reply: completion.choices[0].message.content,
      tokens: completion.usage.total_tokens,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
