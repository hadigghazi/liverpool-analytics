import { useState, useEffect, useRef } from 'react';
import styles from './Transfers.module.css';

function formatEur(val) {
  if (!val) return '—';
  if (val >= 1_000_000_000) return `€${(val / 1_000_000_000).toFixed(2)}bn`;
  if (val >= 1_000_000) return `€${(val / 1_000_000).toFixed(0)}m`;
  if (val >= 1_000) return `€${(val / 1_000).toFixed(0)}k`;
  return `€${val}`;
}

function seasonLabel(s) {
  return `20${s.slice(0, 2)}/${s.slice(2)}`;
}

function SquadValueChart({ data }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!data.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * window.devicePixelRatio;
    canvas.height = H * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const pad = { t: 16, r: 16, b: 40, l: 56 };
    const cw = W - pad.l - pad.r;
    const ch = H - pad.t - pad.b;
    const maxVal = Math.max(...data.map(d => d.total_value_eur || 0));

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    [0, 0.25, 0.5, 0.75, 1].forEach(pct => {
      const y = pad.t + ch - pct * ch;
      const val = pct * maxVal;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.moveTo(pad.l, y);
      ctx.lineTo(W - pad.r, y);
      ctx.stroke();
      ctx.fillStyle = '#6b6b80';
      ctx.font = '10px DM Sans';
      ctx.textAlign = 'right';
      ctx.fillText(formatEur(val), pad.l - 6, y + 3);
    });

    // Area fill
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = pad.l + (i / (data.length - 1)) * cw;
      const y = pad.t + ch - ((d.total_value_eur || 0) / maxVal) * ch;
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
    data.forEach((d, i) => {
      const x = pad.l + (i / (data.length - 1)) * cw;
      const y = pad.t + ch - ((d.total_value_eur || 0) / maxVal) * ch;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots + labels every 3
    data.forEach((d, i) => {
      const x = pad.l + (i / (data.length - 1)) * cw;
      const y = pad.t + ch - ((d.total_value_eur || 0) / maxVal) * ch;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#c8102e';
      ctx.fill();

      if (i % 3 === 0) {
        ctx.fillStyle = '#6b6b80';
        ctx.font = '9px DM Sans';
        ctx.textAlign = 'center';
        ctx.fillText(seasonLabel(d.season), x, H - pad.b + 14);
      }
    });
  }, [data]);

  return <canvas ref={canvasRef} className={styles.canvas} />;
}

function TransferBalanceChart({ data }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!data.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * window.devicePixelRatio;
    canvas.height = H * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const recent = [...data].reverse().slice(0, 15);
    const pad = { t: 16, r: 16, b: 40, l: 56 };
    const cw = W - pad.l - pad.r;
    const ch = H - pad.t - pad.b;
    const maxVal = Math.max(...recent.map(d => Math.max(d.spent_eur || 0, d.received_eur || 0)));
    const barW = (cw / recent.length) * 0.35;

    ctx.clearRect(0, 0, W, H);

    // Grid
    [0, 0.5, 1].forEach(pct => {
      const y = pad.t + ch - pct * ch;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.moveTo(pad.l, y);
      ctx.lineTo(W - pad.r, y);
      ctx.stroke();
      ctx.fillStyle = '#6b6b80';
      ctx.font = '10px DM Sans';
      ctx.textAlign = 'right';
      ctx.fillText(formatEur(pct * maxVal), pad.l - 6, y + 3);
    });

    recent.forEach((d, i) => {
      const x = pad.l + (i / recent.length) * cw + (cw / recent.length) * 0.15;
      const spentH = ((d.spent_eur || 0) / maxVal) * ch;
      const recvH = ((d.received_eur || 0) / maxVal) * ch;

      // Spent (red)
      ctx.fillStyle = 'rgba(200,16,46,0.7)';
      ctx.fillRect(x, pad.t + ch - spentH, barW, spentH);

      // Received (green)
      ctx.fillStyle = 'rgba(34,197,94,0.7)';
      ctx.fillRect(x + barW + 2, pad.t + ch - recvH, barW, recvH);

      // Label
      ctx.fillStyle = '#6b6b80';
      ctx.font = '9px DM Sans';
      ctx.textAlign = 'center';
      ctx.fillText(seasonLabel(d.season), x + barW, H - pad.b + 14);
    });
  }, [data]);

  return <canvas ref={canvasRef} className={styles.canvas} />;
}

function TopTransfers({ transfers, direction }) {
  const filtered = transfers
    .filter(t => t.direction === direction && t.fee_eur > 0)
    .sort((a, b) => (b.fee_eur || 0) - (a.fee_eur || 0))
    .slice(0, 8);

  return (
    <div className={styles.transferList}>
      {filtered.map((t, i) => (
        <div key={i} className={styles.transferRow}>
          <span className={styles.transferRank}>{i + 1}</span>
          <div className={styles.transferInfo}>
            <span className={styles.transferPlayer}>{t.player}</span>
            <span className={styles.transferClub}>
              {direction === 'in' ? `← ${t.from_club}` : `→ ${t.to_club}`}
              {' · '}{seasonLabel(t.season)}
            </span>
          </div>
          <span className={styles.transferFee}>{formatEur(t.fee_eur)}</span>
        </div>
      ))}
    </div>
  );
}

function PlayerValueTable({ values, season }) {
  const filtered = values
    .filter(v => v.season === season && v.market_value_eur)
    .sort((a, b) => (b.market_value_eur || 0) - (a.market_value_eur || 0));

  return (
    <div className={styles.valueTable}>
      <div className={styles.valueHeader}>
        <span>Player</span>
        <span>Pos</span>
        <span>Age</span>
        <span>Value</span>
        <span>G+A</span>
        <span>G+A/€10m</span>
      </div>
      {filtered.map((p, i) => {
        const ga = (p.goals || 0) + (p.assists || 0);
        return (
          <div key={i} className={`${styles.valueRow} ${i % 2 === 0 ? styles.even : ''}`}>
            <span className={styles.valueName}>{p.player}</span>
            <span className={styles.valuePos}>{p.position?.split(' ')[0]}</span>
            <span>{p.age}</span>
            <span className={styles.valueAmount}>{formatEur(p.market_value_eur)}</span>
            <span>{ga || '—'}</span>
            <span className={`${styles.efficiency} ${p.contributions_per_10m > 2 ? styles.hot : ''}`}>
              {p.contributions_per_10m?.toFixed(2) || '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Transfers({ season }) {
  const [squadValues, setSquadValues] = useState([]);
  const [balance, setBalance] = useState([]);
  const [allTransfers, setAllTransfers] = useState([]);
  const [playerValues, setPlayerValues] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(season || '2425');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (season) setSelectedSeason(season);
  }, [season]);

  useEffect(() => {
    Promise.all([
      fetch('/api/transfers/squad-value').then(r => r.json()),
      fetch('/api/transfers/balance').then(r => r.json()),
      fetch('/api/transfers/history').then(r => r.json()),
      fetch('/api/transfers/player-values').then(r => r.json()),
    ]).then(([sv, bal, hist, pv]) => {
      setSquadValues(Array.isArray(sv) ? sv : []);
      setBalance(Array.isArray(bal) ? bal : []);
      setAllTransfers(Array.isArray(hist) ? hist : []);
      setPlayerValues(Array.isArray(pv) ? pv : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const availableSeasons = squadValues.map(s => s.season).sort().reverse();
  const peakSeason = squadValues.reduce((max, s) =>
    (s.total_value_eur || 0) > (max.total_value_eur || 0) ? s : max, {});
  const currentSquadValue = squadValues.find(s => s.season === (season || '2425'))?.total_value_eur;

  if (loading) return <div className={styles.loading}>Loading transfer data...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Market values & transfers</h1>
        <div className={styles.headerStats}>
          <div className={styles.hstat}>
            <span className={styles.hstatVal}>{formatEur(peakSeason.total_value_eur)}</span>
            <span className={styles.hstatLabel}>Peak squad value ({seasonLabel(peakSeason.season || '1819')})</span>
          </div>
          <div className={styles.hstat}>
            <span className={styles.hstatVal}>{formatEur(currentSquadValue)}</span>
            <span className={styles.hstatLabel}>Current squad value</span>
          </div>
        </div>
      </div>

      <div className={styles.chartSection}>
        <h2 className={styles.sectionTitle}>Squad value 2004 — present</h2>
        <div className={styles.chartCard}>
          <SquadValueChart data={[...squadValues].sort((a, b) => a.season.localeCompare(b.season))} />
        </div>
      </div>

      <div className={styles.twoCol}>
        <div>
          <h2 className={styles.sectionTitle}>Transfer spend vs income (last 15 seasons)</h2>
          <div className={styles.chartCard}>
            <TransferBalanceChart data={balance} />
            <div className={styles.legend}>
              <span><span className={styles.dot} style={{ background: 'rgba(200,16,46,0.7)' }} />Spent</span>
              <span><span className={styles.dot} style={{ background: 'rgba(34,197,94,0.7)' }} />Received</span>
            </div>
          </div>
        </div>

        <div>
          <h2 className={styles.sectionTitle}>All-time biggest buys</h2>
          <div className={styles.transferCard}>
            <TopTransfers transfers={allTransfers} direction="in" />
          </div>
        </div>
      </div>

      <div className={styles.twoCol}>
        <div>
          <h2 className={styles.sectionTitle}>All-time biggest sales</h2>
          <div className={styles.transferCard}>
            <TopTransfers transfers={allTransfers} direction="out" />
          </div>
        </div>

        <div>
          <div className={styles.seasonPickerRow}>
            <h2 className={styles.sectionTitle}>Player values — value vs performance</h2>
            <select
              className={styles.seasonSelect}
              value={selectedSeason}
              onChange={e => setSelectedSeason(e.target.value)}
            >
              {availableSeasons.map(s => (
                <option key={s} value={s}>{seasonLabel(s)}</option>
              ))}
            </select>
          </div>
          <div className={styles.transferCard}>
            <PlayerValueTable values={playerValues} season={selectedSeason} />
          </div>
        </div>
      </div>
    </div>
  );
}

