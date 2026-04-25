import { usePlayers, useMatches } from '../hooks/useData.js';
import HoverTip from '../components/HoverTip/HoverTip.jsx';
import styles from './Attack.module.css';

function GoalsBar({ players }) {
  const top = players.filter(p => p.goals > 0).slice(0, 10);
  if (!top.length) return null;
  const rawMax = Math.max(...top.map(p => p.goals));
  const max = rawMax > 0 ? rawMax : 1;

  return (
    <div className={styles.chart}>
      <h2 className={styles.chartTitle}>Top scorers</h2>
      <div className={styles.bars}>
        {top.map(p => (
          <div key={p.player} className={styles.barRow}>
            <span className={styles.barName}>{p.player.split(' ').pop()}</span>
            <HoverTip
              variant="flex1"
              title={p.player}
              lines={[
                `Goals: ${p.goals ?? 0}`,
                `Assists: ${p.assists ?? 0}`,
                `Minutes: ${Math.round(p.minutes || 0)}`,
              ]}
            >
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{ width: `${(p.goals / max) * 100}%` }}
                />
                <span className={styles.barVal}>{p.goals}</span>
              </div>
            </HoverTip>
            <span className={styles.barSub}>{p.assists}A</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShotsTable({ players }) {
  const top = players
    .filter(p => p.shots > 0)
    .sort((a, b) => b.shots - a.shots)
    .slice(0, 12);

  return (
    <div className={styles.chart}>
      <h2 className={styles.chartTitle}>Shooting efficiency</h2>
      <div className={styles.shotGrid}>
        <div className={styles.shotHeader}>
          <span>Player</span>
          <span>Shots</span>
          <span>On tgt</span>
          <span>SoT%</span>
          <span>Goals</span>
          <span>Conv%</span>
        </div>
        {top.map(p => {
          const conv = p.shots > 0 ? ((p.goals / p.shots) * 100).toFixed(0) : 0;
          const sotPct = p.shots > 0 ? ((p.shots_on_tgt / p.shots) * 100).toFixed(0) : 0;
          return (
            <div key={p.player} className={styles.shotRow}>
              <span className={styles.playerName}>{p.player}</span>
              <span>{p.shots}</span>
              <span>{p.shots_on_tgt}</span>
              <span>{sotPct}%</span>
              <span className={styles.goals}>{p.goals}</span>
              <span className={`${styles.conv} ${conv >= 15 ? styles.hot : conv >= 10 ? styles.warm : ''}`}>
                {conv}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HomeAwayGoals({ matches }) {
  const played = matches.filter(m => m.result);
  const home = played.filter(m => m.venue_type === 'home');
  const away = played.filter(m => m.venue_type === 'away');
  const homeGoals = home.reduce((s, m) => s + (m.lfc_goals || 0), 0);
  const awayGoals = away.reduce((s, m) => s + (m.lfc_goals || 0), 0);
  const homeAvg = home.length ? (homeGoals / home.length).toFixed(2) : 0;
  const awayAvg = away.length ? (awayGoals / away.length).toFixed(2) : 0;

  const goalsByGW = played.map(m => ({
    gw: m.match_number,
    goals: m.lfc_goals || 0,
    conceded: m.opp_goals || 0,
    venue: m.venue_type,
    opponent: m.opponent,
    result: m.result,
  }));

  return (
    <div className={styles.chart}>
      <h2 className={styles.chartTitle}>Goals by venue</h2>
      <div className={styles.venueStats}>
        <div className={styles.venueStat}>
          <span className={styles.venueLabel}>Home</span>
          <span className={styles.venueVal}>{homeGoals}</span>
          <span className={styles.venueSub}>{homeAvg} per game</span>
        </div>
        <div className={styles.venueDivider} />
        <div className={styles.venueStat}>
          <span className={styles.venueLabel}>Away</span>
          <span className={styles.venueVal}>{awayGoals}</span>
          <span className={styles.venueSub}>{awayAvg} per game</span>
        </div>
      </div>
      <div className={styles.goalTimeline}>
        {goalsByGW.map((m, i) => (
          <HoverTip
            key={i}
            wrapClassName={styles.timelineTipWrap}
            title={`GW${m.gw} · ${m.opponent || '—'}`}
            lines={[
              `Score: ${m.goals}–${m.conceded}`,
              `Venue: ${m.venue === 'home' ? 'Home' : m.venue === 'away' ? 'Away' : '—'}`,
              `Result: ${m.result || '—'}`,
            ]}
          >
            <div
              className={styles.gwBar}
              style={{ height: `${Math.max(m.goals * 16, 4)}px` }}
            >
              <div
                className={`${styles.gwFill} ${m.venue === 'home' ? styles.homeBar : styles.awayBar}`}
                style={{ height: '100%' }}
              />
            </div>
          </HoverTip>
        ))}
      </div>
      <div className={styles.barLegend}>
        <span><span className={styles.dot} style={{ background: '#c8102e' }} />Home</span>
        <span><span className={styles.dot} style={{ background: '#f6c700' }} />Away</span>
      </div>
    </div>
  );
}

function OffsideContext({ players }) {
  const top = players.filter(p => p.offsides > 0).sort((a, b) => b.offsides - a.offsides).slice(0, 6);
  if (!top.length) return null;
  const rawMax = top[0]?.offsides || 0;
  const max = rawMax > 0 ? rawMax : 1;
  return (
    <div className={styles.chart}>
      <h2 className={styles.chartTitle}>Offside trap — attacking intent</h2>
      <p className={styles.insight}>High offside counts signal aggressive runs in behind — a marker of direct attacking play.</p>
      <div className={styles.bars}>
        {top.map(p => (
          <div key={p.player} className={styles.barRow}>
            <span className={styles.barName}>{p.player.split(' ').pop()}</span>
            <HoverTip
              variant="flex1"
              title={p.player}
              lines={[
                `Offsides: ${p.offsides ?? 0}`,
                `Minutes: ${Math.round(p.minutes || 0)}`,
              ]}
            >
              <div className={styles.barTrack}>
                <div className={styles.barFillGold} style={{ width: `${(p.offsides / max) * 100}%` }} />
                <span className={styles.barVal}>{p.offsides}</span>
              </div>
            </HoverTip>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Attack({ season }) {
  const { data: players, loading: pLoading } = usePlayers(season);
  const { data: matches, loading: mLoading } = useMatches(season);

  if (pLoading || mLoading) return <div className={styles.loading}>Loading attack data...</div>;

  const totalGoals = players.reduce((s, p) => s + (p.goals || 0), 0);
  const totalShots = players.reduce((s, p) => s + (p.shots || 0), 0);
  const totalSoT = players.reduce((s, p) => s + (p.shots_on_tgt || 0), 0);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Attacking stats</h1>
        <div className={styles.headerStats}>
          <div className={styles.hstat}>
            <span className={styles.hstatVal}>{totalGoals}</span>
            <span className={styles.hstatLabel}>Total goals</span>
          </div>
          <div className={styles.hstat}>
            <span className={styles.hstatVal}>{totalShots}</span>
            <span className={styles.hstatLabel}>Total shots</span>
          </div>
          <div className={styles.hstat}>
            <span className={styles.hstatVal}>{totalSoT > 0 ? ((totalGoals / totalShots) * 100).toFixed(1) : 0}%</span>
            <span className={styles.hstatLabel}>Conversion</span>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <GoalsBar players={players} />
        <HomeAwayGoals matches={matches} />
        <ShotsTable players={players} />
        <OffsideContext players={players} />
      </div>
    </div>
  );
}

