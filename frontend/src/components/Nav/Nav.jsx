import styles from './Nav.module.css';

const TABS = [
  { id: 'dashboard', label: 'Season' },
  { id: 'attack',    label: 'Attack' },
  { id: 'defense',   label: 'Defense' },
  { id: 'squad',     label: 'Squad' },
  { id: 'transfers', label: 'Transfers' },
];

function seasonLabel(s) {
  if (!s) return '';
  return `20${s.slice(0,2)}/${s.slice(2)}`;
}

export default function Nav({ tab, setTab, seasons, season, setSeason }) {
  const currentSeason = seasons.find(s => !s.is_complete);

  return (
    <nav className={styles.nav}>
      <div className={styles.brand}>
        <div className={styles.crest}>LFC</div>
        <div className={styles.brandText}>
          <span className={styles.title}>Analytics</span>
          <span className={styles.season}>{seasonLabel(season)}</span>
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

      <div className={styles.right}>
        <select
          className={styles.seasonSelect}
          value={season || ''}
          onChange={e => setSeason(e.target.value)}
        >
          {seasons.map(s => (
            <option key={s.season} value={s.season}>
              {seasonLabel(s.season)}{!s.is_complete ? ' ●' : ''}
            </option>
          ))}
        </select>

        {currentSeason && season === currentSeason.season && (
          <span className={styles.champion}>Live</span>
        )}
        {season === '2425' && (
          <span className={styles.champion}>Champions</span>
        )}
      </div>
    </nav>
  );
}

