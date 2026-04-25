import { useEffect, useState } from 'react';
import styles from './Players.module.css';

const COLS = [
  { key: 'player', label: 'Player', fmt: (v) => v },
  { key: 'minutes', label: 'Min', fmt: (v) => Math.round(v) },
  { key: 'goals', label: 'G', fmt: (v) => v },
  { key: 'assists', label: 'A', fmt: (v) => v },
  { key: 'goal_contributions', label: 'G+A', fmt: (v) => v },
  { key: 'xg', label: 'xG', fmt: (v) => (+v).toFixed(1) },
  { key: 'xag', label: 'xAG', fmt: (v) => (+v).toFixed(1) },
  { key: 'shot_accuracy', label: 'SoT%', fmt: (v) => (v ? (v * 100).toFixed(0) + '%' : '—') },
  { key: 'pass_accuracy', label: 'Pass%', fmt: (v) => (v ? (v * 100).toFixed(0) + '%' : '—') },
  { key: 'key_passes', label: 'KP', fmt: (v) => v },
  { key: 'tackles', label: 'Tkl', fmt: (v) => v },
  { key: 'prog_carries', label: 'PrgC', fmt: (v) => v },
];

export default function Players() {
  const [players, setPlayers] = useState([]);
  const [sort, setSort] = useState('goals');
  const [order, setOrder] = useState('DESC');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/players?season=2425&sort=${sort}&order=${order}`)
      .then((r) => r.json())
      .then((d) => {
        setPlayers(d);
        setLoading(false);
      });
  }, [sort, order]);

  const toggleSort = (key) => {
    if (sort === key) setOrder((o) => (o === 'DESC' ? 'ASC' : 'DESC'));
    else {
      setSort(key);
      setOrder('DESC');
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Player performance — 2024/25</h1>
      {loading ? (
        <p className={styles.loading}>Loading...</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th
                    key={c.key}
                    className={`${styles.th} ${c.key !== 'player' ? styles.sortable : ''} ${sort === c.key ? styles.sorted : ''}`}
                    onClick={() => c.key !== 'player' && toggleSort(c.key)}
                  >
                    {c.label}
                    {sort === c.key && <span className={styles.arrow}>{order === 'DESC' ? ' ↓' : ' ↑'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={p.player} className={i % 2 === 0 ? styles.even : ''}>
                  {COLS.map((c) => (
                    <td key={c.key} className={`${styles.td} ${c.key === 'player' ? styles.name : ''}`}>
                      {c.fmt(p[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
