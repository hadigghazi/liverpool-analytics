import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import SeasonSummary from '../components/SeasonSummary/SeasonSummary.jsx';
import MatchList from '../components/MatchList/MatchList.jsx';
import AIChatbot from '../components/AIChatbot/AIChatbot.jsx';
import { appSeason } from '../config.js';
import styles from './Dashboard.module.css';

const RESULT_COLOR = { W: '#22c55e', D: '#f59e0b', L: '#ef4444' };

export default function Dashboard() {
  const [matches, setMatches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/matches?season=${encodeURIComponent(appSeason)}`).then((r) => r.json()),
      fetch(`/api/matches/summary?season=${encodeURIComponent(appSeason)}`).then((r) => r.json()),
    ]).then(([m, s]) => {
      setMatches(m);
      setSummary(s);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className={styles.loading}>Loading Liverpool data...</div>;

  const pointsData = matches.map((m) => ({
    match: m.match_number,
    points: m.cumulative_points,
    opponent: m.opponent,
    result: m.result,
  }));

  const goalData = matches.slice(-10).map((m) => ({
    label: m.opponent.slice(0, 5),
    scored: m.lfc_goals,
    conceded: m.opp_goals,
    result: m.result,
  }));

  return (
    <div className={styles.page}>
      {summary && <SeasonSummary data={summary} />}

      <div className={styles.charts}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Points progression</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={pointsData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="match"
                tick={{ fill: '#666', fontSize: 12 }}
                label={{ value: 'Matchday', position: 'insideBottom', offset: -4, fill: '#666', fontSize: 12 }}
              />
              <YAxis tick={{ fill: '#666', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #c8102e', borderRadius: 8, fontSize: 13 }}
                formatter={(v, _, props) => [`${v} pts — vs ${props.payload.opponent}`, '']}
                labelFormatter={(v) => `Match ${v}`}
              />
              <Line
                type="monotone"
                dataKey="points"
                stroke="#c8102e"
                strokeWidth={2.5}
                dot={(p) => (
                  <circle
                    key={p.key}
                    cx={p.cx}
                    cy={p.cy}
                    r={4}
                    fill={RESULT_COLOR[p.payload.result] || '#888'}
                    stroke="none"
                  />
                )}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className={styles.hint}>Dots: green = W, amber = D, red = L</p>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Goals — last 10 matches</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={goalData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: '#666', fontSize: 11 }} />
              <YAxis tick={{ fill: '#666', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #444', borderRadius: 8, fontSize: 13 }} />
              <Bar dataKey="scored" name="LFC scored" radius={[4, 4, 0, 0]}>
                {goalData.map((g, i) => (
                  <Cell key={i} fill={RESULT_COLOR[g.result] || '#c8102e'} />
                ))}
              </Bar>
              <Bar dataKey="conceded" name="Conceded" fill="rgba(255,255,255,0.15)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.bottom}>
        <MatchList matches={matches} />
        <AIChatbot />
      </div>
    </div>
  );
}
