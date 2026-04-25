import { useState } from 'react';
import Dashboard from './pages/Dashboard.jsx';
import Players from './pages/Players.jsx';
import styles from './styles/App.module.css';

export default function App() {
  const [tab, setTab] = useState('dashboard');

  return (
    <div className={styles.app}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          <span className={styles.badge}>LFC</span>
          <span className={styles.title}>Analytics</span>
        </div>
        <div className={styles.tabs}>
          {['dashboard', 'players'].map((t) => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.active : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'dashboard' ? 'Season Overview' : 'Player Stats'}
            </button>
          ))}
        </div>
      </nav>
      <main className={styles.main}>
        {tab === 'dashboard' ? <Dashboard /> : <Players />}
      </main>
    </div>
  );
}
