import { usePlayers, useMatches } from '../hooks/useData.js';
import styles from './Defense.module.css';

function TacklesChart({ players }) {
  const top = players.filter(p => p.tackles > 0).sort((a, b) => b.tackles - a.tackles).slice(0, 10);
  const max = Math.max(...top.map(p => p.tackles));
  return (
    <div className={styles.chart}>
      <h2 className={styles.chartTitle}>Tackles won</h2>
      <p className={styles.insight}>Outfield players ranked by tackles won — a proxy for defensive work rate and pressing intensity.</p>
      <div className={styles.bars}>
        {top.map(p => (
          <div key={p.player} className={styles.barRow}>
            <span className={styles.barName}>{p.player.split(' ').pop()}</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${(p.tackles / max) * 100}%` }} />
              <span className={styles.barVal}>{p.tackles}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InterceptionsChart({ players }) {
  const top = players.filter(p => p.interceptions > 0).sort((a, b) => b.interceptions - a.interceptions).slice(0, 10);
  const max = Math.max(...top.map(p => p.interceptions));
  return (
    <div className={styles.chart}>
      <h2 className={styles.chartTitle}>Interceptions</h2>
      <p className={styles.insight}>Reading of play and positional intelligence — defenders who cut off supply lines.</p>
      <div className={styles.bars}>
        {top.map(p => (
          <div key={p.player} className={styles.barRow}>
            <span className={styles.barName}>{p.player.split(' ').pop()}</span>
            <div className={styles.barTrack}>
              <div className={styles.barFillTeal} style={{ width: `${(p.interceptions / max) * 100}%` }} />
              <span className={styles.barVal}>{p.interceptions}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CleanSheetTimeline({ matches }) {
  const played = matches.filter(m => m.result);
  const cleanSheets = played.filter(m => m.opp_goals === 0);
  const goalsAgainstByGW = played.map(m => m.opp_goals || 0);
  const max = Math.max(...goalsAgainstByGW, 1);

  return (
    <div className={styles.chart}>
      <h2 className={styles.chartTitle}>Goals conceded per match</h2>
      <div className={styles.csStats}>
        <div className={styles.csStat}>
          <span className={styles.csVal}>{cleanSheets.length}</span>
          <span className={styles.csLabel}>Clean sheets</span>
        </div>
        <div className={styles.csStat}>
          <span className={styles.csVal}>{played.length > 0 ? (played.reduce((s, m) => s + (m.opp_goals || 0), 0) / played.length).toFixed(2) : 0}</span>
          <span className={styles.csLabel}>Goals against / game</span>
        </div>
        <div className={styles.csStat}>
          <span className={styles.csVal}>{Math.max(...goalsAgainstByGW)}</span>
          <span className={styles.csLabel}>Most conceded</span>
        </div>
      </div>
      <div className={styles.timeline}>
        {played.map((m, i) => (
          <div
            key={i}
            className={styles.tlBar}
            title={`GW${m.match_number} vs ${m.opponent}: conceded ${m.opp_goals}`}
            style={{ height: `${Math.max(((m.opp_goals || 0) / max) * 80, m.opp_goals === 0 ? 3 : 0)}px` }}
          >
            <div
              className={`${styles.tlFill} ${m.opp_goals === 0 ? styles.clean : m.opp_goals >= 3 ? styles.bad : styles.normal}`}
            />
          </div>
        ))}
      </div>
      <div className={styles.tlLegend}>
        <span><span className={styles.dot} style={{ background: '#1D9E75' }} />Clean sheet</span>
        <span><span className={styles.dot} style={{ background: '#888' }} />Conceded</span>
        <span><span className={styles.dot} style={{ background: '#ef4444' }} />3+ goals</span>
      </div>
    </div>
  );
}

function DisciplinaryTable({ players }) {
  const sorted = players
    .filter(p => (p.yellow_cards || 0) + (p.red_cards || 0) > 0)
    .sort((a, b) => ((b.yellow_cards || 0) * 1 + (b.red_cards || 0) * 3) - ((a.yellow_cards || 0) + (a.red_cards || 0) * 3));

  return (
    <div className={styles.chart}>
      <h2 className={styles.chartTitle}>Disciplinary record</h2>
      <p className={styles.insight}>Yellow cards + fouls committed reveal who battles hardest — and who&apos;s most combustible.</p>
      <div className={styles.discGrid}>
        <div className={styles.discHeader}>
          <span>Player</span>
          <span>YC</span>
          <span>RC</span>
          <span>Fouls</span>
          <span>Fouled</span>
        </div>
        {sorted.map(p => (
          <div key={p.player} className={styles.discRow}>
            <span className={styles.playerName}>{p.player}</span>
            <span className={styles.yc}>{p.yellow_cards || 0}</span>
            <span className={styles.rc}>{p.red_cards || 0}</span>
            <span>{p.fouls || 0}</span>
            <span className={styles.fouled}>{p.fouled || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Defense({ season }) {
  const { data: players, loading: pLoading } = usePlayers(season);
  const { data: matches, loading: mLoading } = useMatches(season);

  if (pLoading || mLoading) return <div className={styles.loading}>Loading defense data...</div>;

  const totalTackles = players.reduce((s, p) => s + (p.tackles || 0), 0);
  const totalInterceptions = players.reduce((s, p) => s + (p.interceptions || 0), 0);
  const played = matches.filter(m => m.result);
  const goalsAgainst = played.reduce((s, m) => s + (m.opp_goals || 0), 0);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Defensive stats</h1>
        <div className={styles.headerStats}>
          <div className={styles.hstat}>
            <span className={styles.hstatVal}>{totalTackles}</span>
            <span className={styles.hstatLabel}>Total tackles</span>
          </div>
          <div className={styles.hstat}>
            <span className={styles.hstatVal}>{totalInterceptions}</span>
            <span className={styles.hstatLabel}>Interceptions</span>
          </div>
          <div className={styles.hstat}>
            <span className={styles.hstatVal}>{goalsAgainst}</span>
            <span className={styles.hstatLabel}>Goals conceded</span>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <TacklesChart players={players} />
        <InterceptionsChart players={players} />
        <CleanSheetTimeline matches={matches} />
        <DisciplinaryTable players={players} />
      </div>
    </div>
  );
}

