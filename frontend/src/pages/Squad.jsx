import { useState } from 'react';
import { usePlayers } from '../hooks/useData.js';
import PlayerModal from '../components/PlayerModal/PlayerModal.jsx';
import styles from './Squad.module.css';

const COLS = [
  { key: 'player',            label: 'Player',   sortable: false },
  { key: 'minutes',           label: 'Min',      fmt: v => Math.round(v || 0) },
  { key: 'goals',             label: 'G',        fmt: v => v || 0, highlight: true },
  { key: 'assists',           label: 'A',        fmt: v => v || 0 },
  { key: 'goal_contributions',label: 'G+A',      fmt: v => v || 0 },
  { key: 'shots',             label: 'Sh',       fmt: v => v || 0 },
  { key: 'shots_on_tgt',      label: 'SoT',      fmt: v => v || 0 },
  { key: 'shot_accuracy',     label: 'SoT%',     fmt: v => v ? `${(v * 100).toFixed(0)}%` : '—' },
  { key: 'tackles',           label: 'Tkl',      fmt: v => v || 0 },
  { key: 'interceptions',     label: 'Int',      fmt: v => v || 0 },
  { key: 'fouls',             label: 'Fls',      fmt: v => v || 0 },
  { key: 'fouled',            label: 'Fld',      fmt: v => v || 0 },
  { key: 'offsides',          label: 'Off',      fmt: v => v || 0 },
  { key: 'yellow_cards',      label: 'YC',       fmt: v => v || 0 },
];

function PlayerCard({ p, onSelect }) {
  const initials = p.player.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const per90min = p.minutes > 0 ? ((p.goals || 0) / (p.minutes / 90)).toFixed(2) : '0.00';
  return (
    <div
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(p.player)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(p.player); } }}
    >
      <div className={styles.cardAvatar}>{initials}</div>
      <div className={styles.cardInfo}>
        <span className={styles.cardName}>{p.player}</span>
        <div className={styles.cardStats}>
          <span>{p.goals || 0}G</span>
          <span>{p.assists || 0}A</span>
          <span>{Math.round(p.minutes || 0)}min</span>
          <span className={styles.per90}>{per90min} G/90</span>
        </div>
      </div>
      <div className={styles.cardGoals}>{p.goals || 0}</div>
    </div>
  );
}

export default function Squad({ season }) {
  const { data: players, loading } = usePlayers(season);
  const [sort, setSort] = useState('goals');
  const [order, setOrder] = useState('DESC');
  const [view, setView] = useState('table');
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const sorted = [...players].sort((a, b) => {
    const av = a[sort] || 0;
    const bv = b[sort] || 0;
    return order === 'DESC' ? bv - av : av - bv;
  });

  const toggle = (key) => {
    if (sort === key) setOrder(o => o === 'DESC' ? 'ASC' : 'DESC');
    else { setSort(key); setOrder('DESC'); }
  };

  if (loading) return <div className={styles.loading}>Loading squad data...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Squad stats</h1>
        <div className={styles.controls}>
          <button
            className={`${styles.viewBtn} ${view === 'table' ? styles.active : ''}`}
            onClick={() => setView('table')}
          >Table</button>
          <button
            className={`${styles.viewBtn} ${view === 'cards' ? styles.active : ''}`}
            onClick={() => setView('cards')}
          >Cards</button>
        </div>
      </div>

      {view === 'cards' ? (
        <div className={styles.cards}>
          {[...players].sort((a, b) => (b.goals || 0) - (a.goals || 0)).map(p => (
            <PlayerCard key={p.player} p={p} onSelect={setSelectedPlayer} />
          ))}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {COLS.map(c => (
                  <th
                    key={c.key}
                    className={`${styles.th} ${c.key !== 'player' ? styles.sortable : ''} ${sort === c.key ? styles.sorted : ''}`}
                    onClick={() => c.key !== 'player' && toggle(c.key)}
                  >
                    {c.label}
                    {sort === c.key && <span className={styles.arrow}>{order === 'DESC' ? '↓' : '↑'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr
                  key={p.player}
                  className={`${i % 2 === 0 ? styles.even : ''} ${styles.clickableRow}`}
                  onClick={() => setSelectedPlayer(p.player)}
                >
                  {COLS.map(c => (
                    <td
                      key={c.key}
                      className={`${styles.td} ${c.key === 'player' ? styles.name : ''} ${c.highlight && (p[c.key] || 0) >= 10 ? styles.hot : ''}`}
                    >
                      {c.key === 'player' ? p.player : (c.fmt ? c.fmt(p[c.key]) : (p[c.key] || 0))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedPlayer && (
        <PlayerModal
          playerName={selectedPlayer}
          season={season}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}

