import styles from './SeasonSummary.module.css';

export default function SeasonSummary({ data }) {
  const stats = [
    { label: 'Played', value: data.played },
    { label: 'W', value: data.wins, color: '#22c55e' },
    { label: 'D', value: data.draws, color: '#f59e0b' },
    { label: 'L', value: data.losses, color: '#ef4444' },
    { label: 'Points', value: data.points, big: true },
    { label: 'GF', value: data.goals_scored },
    { label: 'GA', value: data.goals_conceded },
    { label: 'GD', value: (data.goal_diff > 0 ? '+' : '') + data.goal_diff },
    { label: 'Avg scored', value: data.avg_goals_for },
    { label: 'Home W', value: data.home_wins },
    { label: 'Away W', value: data.away_wins },
  ];

  return (
    <div className={styles.summary}>
      <div className={styles.crest}>⚽</div>
      <div className={styles.stats}>
        {stats.map((s) => (
          <div key={s.label} className={`${styles.stat} ${s.big ? styles.big : ''}`}>
            <span className={styles.value} style={s.color ? { color: s.color } : {}}>
              {s.value ?? '—'}
            </span>
            <span className={styles.label}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
