import { useState, useEffect } from 'react';
import styles from './PlayerModal.module.css';

function formatEur(val) {
  if (!val) return '—';
  if (val >= 1e9) return `€${(val / 1e9).toFixed(2)}bn`;
  if (val >= 1e6) return `€${(val / 1e6).toFixed(0)}m`;
  if (val >= 1e3) return `€${(val / 1e3).toFixed(0)}k`;
  return `€${val}`;
}

function seasonLabel(s) {
  if (!s) return '';
  return `20${s.slice(0, 2)}/${s.slice(2)}`;
}

function MVChart({ data }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map(d => d.market_value_eur || 0));

  return (
    <div className={styles.mvChart}>
      {data.map((d, i) => (
        <div
          key={`${d.season}-${i}`}
          className={styles.mvBar}
          title={`${seasonLabel(d.season)}: ${formatEur(d.market_value_eur)}`}
        >
          <div
            className={styles.mvFill}
            style={{ height: `${((d.market_value_eur || 0) / max) * 100}%` }}
          />
          {i % 3 === 0 && (
            <span className={styles.mvLabel}>{seasonLabel(d.season).slice(5)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function StatRow({ label, value, highlight }) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statValue} ${highlight ? styles.highlight : ''}`}>{value ?? '—'}</span>
    </div>
  );
}

export default function PlayerModal({ playerName, season, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!playerName) return;
    setLoading(true);
    setData(null);
    fetch(`/api/player-profile/${encodeURIComponent(playerName)}?season=${encodeURIComponent(season || '')}`)
      .then(async r => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          return { _error: body.error || r.statusText || 'Request failed', profile: null, performance: [] };
        }
        return body;
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setData({ _error: 'Network error', profile: null, performance: [] }); setLoading(false); });
  }, [playerName, season]);

  const currentSeasonPerf = data?.performance?.find(p => p.season === season);
  const careerGoals = data?.performance?.reduce((s, p) => s + (p.goals || 0), 0) ?? 0;
  const careerAssists = data?.performance?.reduce((s, p) => s + (p.assists || 0), 0) ?? 0;
  const seasonsAtLFC = data?.performance?.length || 0;
  const mvPeak = Math.max(0, ...(data?.marketValues || []).map(d => d.market_value_eur || 0));

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>

        {loading ? (
          <div className={styles.loading}>Loading player data...</div>
        ) : (data?._error || (!data?.profile && !(data?.performance || []).length)) ? (
          <div className={styles.loading}>
            {data?._error ? `${data._error}` : `No data found for ${playerName}`}
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <div className={styles.photoWrap}>
                {data.profile?.photo_url ? (
                  <img
                    src={data.profile.photo_url}
                    alt={playerName}
                    className={styles.photo}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className={styles.photoPlaceholder}>
                    {playerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className={styles.headerInfo}>
                <h2 className={styles.playerName}>{playerName}</h2>
                <p className={styles.position}>{data.profile?.position || '—'}</p>
                <div className={styles.bioGrid}>
                  <span className={styles.bioLabel}>Nationality</span>
                  <span className={styles.bioVal}>{data.profile?.nationality_full || data.profile?.nationality || '—'}</span>
                  <span className={styles.bioLabel}>Age</span>
                  <span className={styles.bioVal}>{data.profile?.age ?? '—'}</span>
                  <span className={styles.bioLabel}>Market value</span>
                  <span className={styles.bioVal}>{formatEur(data.profile?.market_value_eur)}</span>
                  <span className={styles.bioLabel}>Contract until</span>
                  <span className={styles.bioVal}>{data.profile?.contract_expires || '—'}</span>
                </div>
              </div>
              <div className={styles.careerStats}>
                <div className={styles.careerStat}>
                  <span className={styles.careerVal}>{careerGoals}</span>
                  <span className={styles.careerLabel}>Career goals (LFC)</span>
                </div>
                <div className={styles.careerStat}>
                  <span className={styles.careerVal}>{careerAssists}</span>
                  <span className={styles.careerLabel}>Career assists (LFC)</span>
                </div>
                <div className={styles.careerStat}>
                  <span className={styles.careerVal}>{seasonsAtLFC}</span>
                  <span className={styles.careerLabel}>Seasons at LFC</span>
                </div>
              </div>
            </div>

            <div className={styles.tabs}>
              {['overview', 'history', 'transfers'].map(tab => (
                <button
                  key={tab}
                  type="button"
                  className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div className={styles.content}>
                <div className={styles.twoCol}>
                  <div>
                    <h3 className={styles.sectionTitle}>{seasonLabel(season)} season</h3>
                    <StatRow label="Goals" value={currentSeasonPerf?.goals} highlight />
                    <StatRow label="Assists" value={currentSeasonPerf?.assists} highlight />
                    <StatRow label="Minutes" value={currentSeasonPerf?.minutes ? Math.round(currentSeasonPerf.minutes) : null} />
                    <StatRow label="Shots" value={currentSeasonPerf?.shots} />
                    <StatRow label="Shot accuracy" value={currentSeasonPerf?.shot_accuracy ? `${(currentSeasonPerf.shot_accuracy * 100).toFixed(0)}%` : null} />
                    <StatRow label="Tackles" value={currentSeasonPerf?.tackles} />
                    <StatRow label="Interceptions" value={currentSeasonPerf?.interceptions} />
                    <StatRow label="Yellow cards" value={currentSeasonPerf?.yellow_cards} />
                    <StatRow label="Offsides" value={currentSeasonPerf?.offsides} />
                  </div>
                  <div>
                    <h3 className={styles.sectionTitle}>Market value history</h3>
                    <MVChart data={data.marketValues || []} />
                    <div className={styles.mvPeak}>
                      Peak: {formatEur(mvPeak)}
                    </div>
                    {(data.tmProfileExtras?.mvHistory || []).length > 0 && (
                      <p className={styles.mvNote}>
                        Transfermarkt detailed value curve points: {(data.tmProfileExtras.mvHistory || []).length}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className={styles.content}>
                <h3 className={styles.sectionTitle}>Season by season at Liverpool</h3>
                <div className={styles.historyTable}>
                  <div className={styles.historyHeader}>
                    <span>Season</span>
                    <span>G</span>
                    <span>A</span>
                    <span>G+A</span>
                    <span>Min</span>
                    <span>Shots</span>
                    <span>Tkl</span>
                  </div>
                  {(data.performance || []).map((p, i) => (
                    <div key={i} className={`${styles.historyRow} ${p.season === season ? styles.currentSeason : ''}`}>
                      <span>{seasonLabel(p.season)}</span>
                      <span className={styles.goals}>{p.goals || 0}</span>
                      <span>{p.assists || 0}</span>
                      <span>{(p.goals || 0) + (p.assists || 0)}</span>
                      <span>{p.minutes ? Math.round(p.minutes) : '—'}</span>
                      <span>{p.shots ?? '—'}</span>
                      <span>{p.tackles ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'transfers' && (
              <div className={styles.content}>
                <h3 className={styles.sectionTitle}>Transfer history</h3>
                {data.transfers?.length === 0 ? (
                  <p className={styles.noData}>No transfer data available</p>
                ) : (
                  <div className={styles.transferList}>
                    {(data.transfers || []).map((t, i) => (
                      <div key={i} className={`${styles.transferItem} ${t.direction === 'in' ? styles.arrival : styles.departure}`}>
                        <span className={styles.transferDir}>{t.direction === 'in' ? '←' : '→'}</span>
                        <div className={styles.transferInfo}>
                          <span className={styles.transferClubs}>
                            {t.from_club} → {t.to_club}
                          </span>
                          <span className={styles.transferSeason}>{seasonLabel(t.season)}</span>
                        </div>
                        <span className={styles.transferFee}>{t.fee_text || 'Unknown'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
