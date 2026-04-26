import { useState } from 'react';
import Dashboard from './pages/Dashboard.jsx';
import Attack from './pages/Attack.jsx';
import Defense from './pages/Defense.jsx';
import Squad from './pages/Squad.jsx';
import Transfers from './pages/Transfers.jsx';
import Graph from './pages/Graph.jsx';
import Nav from './components/Nav/Nav.jsx';
import { useSeasons } from './hooks/useData.js';
import styles from './styles/App.module.css';

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const { seasons } = useSeasons();
  const [season, setSeason] = useState(null);

  // Default to most recent season once loaded
  const activeSeason = season || (seasons.length > 0 ? seasons[0].season : null);

  const pages = {
    dashboard: <Dashboard season={activeSeason} />,
    attack:    <Attack season={activeSeason} />,
    defense:   <Defense season={activeSeason} />,
    squad:     <Squad season={activeSeason} />,
    transfers: <Transfers season={activeSeason} />,
    graph:     <Graph season={activeSeason} />,
  };

  return (
    <div className={styles.app}>
      <main className={styles.main}>
        <Nav
          tab={tab}
          setTab={setTab}
          seasons={seasons}
          season={activeSeason}
          setSeason={setSeason}
        />
        {activeSeason ? pages[tab] : <div className={styles.loading}>Loading...</div>}
      </main>
    </div>
  );
}
