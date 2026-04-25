import { useEffect, useRef } from 'react';
import { useMatches, useSummary } from '../hooks/useData.js';
import StatCard from '../components/StatCard/StatCard.jsx';
import FormStrip from '../components/FormStrip/FormStrip.jsx';
import AIChatbot from '../components/AIChatbot/AIChatbot.jsx';
import styles from './Dashboard.module.css';

const RESULT_COLOR = { W: '#22c55e', D: '#f59e0b', L: '#ef4444' };

function PointsChart({ matches }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!matches.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * window.devicePixelRatio;
    canvas.height = H * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const played = matches.filter(m => m.result);
    const maxPts = Math.max(...played.map(m => m.cumulative_points || 0));
    const pad = { t: 16, r: 16, b: 28, l: 36 };
    const cw = W - pad.l - pad.r;
    const ch = H - pad.t - pad.b;

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    [0, 25, 50, 75, 91].forEach(pts => {
      const y = pad.t + ch - (pts / (maxPts + 5)) * ch;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.moveTo(pad.l, y);
      ctx.lineTo(W - pad.r, y);
      ctx.stroke();
      ctx.fillStyle = '#6b6b80';
      ctx.font = '10px DM Sans';
      ctx.textAlign = 'right';
      ctx.fillText(pts, pad.l - 6, y + 3);
    });

    // Area fill under line
    ctx.beginPath();
    played.forEach((m, i) => {
      const x = pad.l + (i / (played.length - 1)) * cw;
      const y = pad.t + ch - ((m.cumulative_points || 0) / (maxPts + 5)) * ch;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.l + cw, pad.t + ch);
    ctx.lineTo(pad.l, pad.t + ch);
    ctx.closePath();
    ctx.fillStyle = 'rgba(200,16,46,0.08)';
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#c8102e';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    played.forEach((m, i) => {
      const x = pad.l + (i / (played.length - 1)) * cw;
      const y = pad.t + ch - ((m.cumulative_points || 0) / (maxPts + 5)) * ch;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots colored by result
    played.forEach((m, i) => {
      const x = pad.l + (i / (played.length - 1)) * cw;
      const y = pad.t + ch - ((m.cumulative_points || 0) / (maxPts + 5)) * ch;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = RESULT_COLOR[m.result] || '#888';
      ctx.fill();
    });

    // X labels every 5
    played.forEach((m, i) => {
      if (i % 5 !== 0) return;
      const x = pad.l + (i / (played.length - 1)) * cw;
      ctx.fillStyle = '#6b6b80';
      ctx.font = '10px DM Sans';
      ctx.textAlign = 'center';
      ctx.fillText(m.match_number || i + 1, x, H - 6);
    });
  }, [matches]);

  return <canvas ref={canvasRef} className={styles.canvas} />;
}

function ResultDonut({ wins, draws, losses }) {
  const total = wins + draws + losses;
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!total) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const size = 120;
    canvas.width = size * window.devicePixelRatio;
    canvas.height = size * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const cx = size / 2, cy = size / 2, r = 46, innerR = 30;
    const slices = [
      { value: wins, color: '#22c55e' },
      { value: draws, color: '#f59e0b' },
      { value: losses, color: '#ef4444' },
    ];
    let angle = -Math.PI / 2;
    slices.forEach(s => {
      const sweep = (s.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + sweep);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      angle += sweep;
    });
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = '#0f0f1c';
    ctx.fill();
  }, [wins, draws, losses, total]);

  if (!total) return null;
  return (
    <div className={styles.donutWrap}>
      <canvas ref={canvasRef} className={styles.donut} />
      <div className={styles.donutLegend}>
        <span className={styles.leg} style={{ color: '#22c55e' }}>{wins}W</span>
        <span className={styles.leg} style={{ color: '#f59e0b' }}>{draws}D</span>
        <span className={styles.leg} style={{ color: '#ef4444' }}>{losses}L</span>
      </div>
    </div>
  );
}

function MatchRow({ m }) {
  const d = new Date(m.date?.value || m.date);
  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return (
    <div className={styles.matchRow}>
      <span className={`${styles.resultBadge} ${styles[m.result?.toLowerCase() || 'none']}`}>
        {m.result || '?'}
      </span>
      <span className={styles.opponent}>{m.opponent}</span>
      <span className={styles.venueTag}>{m.venue_type}</span>
      <span className={styles.score}>{m.lfc_goals} – {m.opp_goals}</span>
      <span className={styles.date}>{dateStr}</span>
    </div>
  );
}

export default function Dashboard({ season }) {
  const { data: matches, loading: mLoading } = useMatches(season);
  const { data: summary, loading: sLoading } = useSummary(season);

  if (mLoading || sLoading) return <div className={styles.loading}>Loading season data...</div>;

  const played = matches.filter(m => m.result);
  const homeMatches = played.filter(m => m.venue_type === 'home');
  const awayMatches = played.filter(m => m.venue_type === 'away');
  const homeGoals = homeMatches.reduce((s, m) => s + (m.lfc_goals || 0), 0);
  const awayGoals = awayMatches.reduce((s, m) => s + (m.lfc_goals || 0), 0);
  const biggestWin = played.filter(m => m.result === 'W')
    .sort((a, b) => (b.lfc_goals - b.opp_goals) - (a.lfc_goals - a.opp_goals))[0];
  const cleanSheets = played.filter(m => m.opp_goals === 0).length;

  return (
    <div className={styles.page}>
      <div className={styles.heroSection}>
        <div className={styles.heroLeft}>
          <h1 className={styles.heroTitle}>2024 — 25</h1>
          <p className={styles.heroSub}>Premier League Champions · {summary?.points || 0} points</p>
          <FormStrip matches={played} />
        </div>
        <div className={styles.heroRight}>
          <ResultDonut
            wins={summary?.wins || 0}
            draws={summary?.draws || 0}
            losses={summary?.losses || 0}
          />
        </div>
      </div>

      <div className={styles.statsGrid}>
        <StatCard label="Points" value={summary?.points} large accent />
        <StatCard label="Wins" value={summary?.wins} sub={`${summary?.draws}D · ${summary?.losses}L`} />
        <StatCard label="Goals scored" value={summary?.goals_scored} sub={`${(summary?.avg_goals_for || 0).toFixed(2)} per game`} />
        <StatCard label="Goals conceded" value={summary?.goals_conceded} sub={`${cleanSheets} clean sheets`} />
        <StatCard label="Home goals" value={homeGoals} sub={`${homeMatches.length} home games`} />
        <StatCard label="Away goals" value={awayGoals} sub={`${awayMatches.length} away games`} />
        <StatCard label="Goal difference" value={`+${summary?.goal_diff}`} />
        {biggestWin && (
          <StatCard
            label="Biggest win"
            value={`${biggestWin.lfc_goals}–${biggestWin.opp_goals}`}
            sub={`vs ${biggestWin.opponent}`}
          />
        )}
      </div>

      <div className={styles.chartSection}>
        <h2 className={styles.sectionTitle}>Points progression</h2>
        <div className={styles.chartCard}>
          <PointsChart matches={played} />
          <div className={styles.chartLegend}>
            <span className={styles.legendItem} style={{ color: '#22c55e' }}>● Win</span>
            <span className={styles.legendItem} style={{ color: '#f59e0b' }}>● Draw</span>
            <span className={styles.legendItem} style={{ color: '#ef4444' }}>● Loss</span>
          </div>
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={styles.matchList}>
          <h2 className={styles.sectionTitle}>All results</h2>
          <div className={styles.matches}>
            {[...played].reverse().map(m => <MatchRow key={m.game_id} m={m} />)}
          </div>
        </div>
        <AIChatbot />
      </div>
    </div>
  );
}
