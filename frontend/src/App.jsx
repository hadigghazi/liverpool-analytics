import { useState } from 'react';
import Dashboard from './pages/Dashboard.jsx';
import Attack from './pages/Attack.jsx';
import Defense from './pages/Defense.jsx';
import Squad from './pages/Squad.jsx';
import Nav from './components/Nav/Nav.jsx';
import styles from './styles/App.module.css';

export default function App() {
  const [tab, setTab] = useState('dashboard');

  const pages = {
    dashboard: <Dashboard />,
    attack: <Attack />,
    defense: <Defense />,
    squad: <Squad />,
  };

  return (
    <div className={styles.app}>
      <main className={styles.main}>
        <Nav tab={tab} setTab={setTab} />
        {pages[tab]}
      </main>
    </div>
  );
}
