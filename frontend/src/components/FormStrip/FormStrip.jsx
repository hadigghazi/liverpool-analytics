import styles from './FormStrip.module.css';

export default function FormStrip({ matches }) {
  const recent = [...matches].reverse().slice(0, 10);

  return (
    <div className={styles.strip}>
      <span className={styles.label}>Last 10</span>
      <div className={styles.dots}>
        {recent.map((m, i) => (
          <div
            key={i}
            className={`${styles.dot} ${styles[m.result?.toLowerCase() || 'none']}`}
            title={`${m.opponent} ${m.lfc_goals}–${m.opp_goals}`}
          >
            {m.result || '?'}
          </div>
        ))}
      </div>
    </div>
  );
}

