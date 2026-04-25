import styles from './Nav.module.css';

const TABS = [
  { id: 'dashboard', label: 'Season' },
  { id: 'attack', label: 'Attack' },
  { id: 'defense', label: 'Defense' },
  { id: 'squad', label: 'Squad' },
];

export default function Nav({ tab, setTab }) {
  return (
    <nav className={styles.nav}>
      <div className={styles.brand}>
        <div className={styles.crest}>LFC</div>
        <div className={styles.brandText}>
          <span className={styles.title}>Analytics</span>
          <span className={styles.season}>2024 — 25</span>
        </div>
      </div>
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.active : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.badge}>
        <span className={styles.champion}>Premier League Champions</span>
      </div>
    </nav>
  );
}

