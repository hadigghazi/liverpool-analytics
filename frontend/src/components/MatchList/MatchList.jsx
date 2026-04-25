import styles from './MatchList.module.css';

const BADGE = { W: styles.win, D: styles.draw, L: styles.loss };

export default function MatchList({ matches }) {
  const recent = [...matches].reverse().slice(0, 8);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Recent results</h2>
      <div className={styles.list}>
        {recent.map((m) => (
          <div key={m.game_id} className={styles.row}>
            <span className={`${styles.badge} ${BADGE[m.result] || ''}`}>{m.result}</span>
            <span className={styles.opponent}>{m.opponent}</span>
            <span className={styles.venue}>{m.venue_type}</span>
            <span className={styles.score}>
              {m.lfc_goals} – {m.opp_goals}
            </span>
            <span className={styles.date}>
              {new Date(m.date?.value || m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
