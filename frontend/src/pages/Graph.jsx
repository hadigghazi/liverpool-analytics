import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import styles from './Graph.module.css';

const POSITION_COLORS = {
  Goalkeeper: '#f59e0b',
  'Centre-Back': '#3b82f6',
  'Right-Back': '#60a5fa',
  'Left-Back': '#93c5fd',
  'Defensive Midfield': '#8b5cf6',
  'Central Midfield': '#a78bfa',
  'Attacking Midfield': '#c4b5fd',
  'Right Winger': '#c8102e',
  'Left Winger': '#ef4444',
  'Centre-Forward': '#f97316',
  default: '#6b7280',
};

const VIEWS = [
  { id: 'teammates', label: 'Teammates', desc: 'Teammate links: shared seasons in the graph (squad- or all-players set below)' },
  { id: 'transfers', label: 'Transfers', desc: 'Players → other clubs: full history (not only the year in the filter)' },
  { id: 'season', label: '↔ Season', desc: 'All seasons in the data—each link is minutes played in that LFC year' },
];

function getColor(position, nodeType) {
  if (nodeType === 'club') return 'var(--lfc-gold)';
  if (nodeType === 'season') return '#22c55e';
  const p = position || '';
  for (const [key, color] of Object.entries(POSITION_COLORS)) {
    if (key === 'default') continue;
    if (p.includes(key)) return color;
  }
  return POSITION_COLORS.default;
}

function seasonLabel(s) {
  if (!s) return '';
  return `20${s.slice(0, 2)}/${s.slice(2)}`;
}

function linkEndId(x) {
  if (x != null && typeof x === 'object' && 'id' in x) return x.id;
  return x;
}

/** 1-hop expansion from name / club / season substring matches. */
function applySearchSubgraph(rawNodes, rawEdges, { player, club, season }) {
  const n0 = Array.isArray(rawNodes) ? rawNodes : [];
  const e0 = Array.isArray(rawEdges) ? rawEdges : [];
  const pq = (player || '').trim().toLowerCase();
  const cq = (club || '').trim().toLowerCase();
  const sq = (season || '').trim().toLowerCase();
  if (!pq && !cq && !sq) {
    return { nodes: n0, edges: e0 };
  }
  const seed = new Set();
  for (const n of n0) {
    if (pq && n.node_type === 'player' && (n.label || n.id).toLowerCase().includes(pq)) seed.add(n.id);
    if (cq && n.node_type === 'club' && (n.label || '').toLowerCase().includes(cq)) seed.add(n.id);
    if (
      sq &&
      n.node_type === 'season' &&
      (String(n.id).toLowerCase().includes(sq) || (n.label || '').toLowerCase().includes(sq))
    ) {
      seed.add(n.id);
    }
  }
  if (seed.size === 0) {
    return { nodes: [], edges: [] };
  }
  const vis = new Set(seed);
  for (const e of e0) {
    if (vis.has(e.source)) vis.add(e.target);
    if (vis.has(e.target)) vis.add(e.source);
  }
  return {
    nodes: n0.filter(n => vis.has(n.id)),
    edges: e0.filter(e => vis.has(e.source) && vis.has(e.target)),
  };
}

/** Position strings on TM/FBref vary; match broadly (case-insensitive). */
function matchesFilter(node, filter) {
  if (filter === 'all') return true;
  const pos = (node.position || '').toLowerCase();
  if (!pos.trim()) return false;
  if (filter === 'goalkeeper') {
    return /goalkeeper|goal-keeper|keeper|torwart|tw| gk|gk\b/.test(pos);
  }
  if (filter === 'back') {
    return /back|defen[cs]e|defender|iv|cb|rb|lb|außenverteidiger|innverteidiger/.test(pos);
  }
  if (filter === 'midfield') {
    return /midfield|midfielder|zentral|mittelfeld|dm|cm|am|zm|defensive mid|central mid|attacking mid/.test(pos);
  }
  if (filter === 'winger') {
    return /winger|flügel|außen| wide|left w|right w|linksaußen|rechtsaußen/.test(pos);
  }
  if (filter === 'forward') {
    return /forward|striker|sturm|centre-forward|center-forward|centre forward|stürmer|attack/.test(pos);
  }
  return true;
}

function formatFee(edge) {
  if (edge.fee_text) return String(edge.fee_text);
  if (edge.fee_eur != null && edge.fee_eur > 0) return `€${Number(edge.fee_eur).toLocaleString()}`;
  return '—';
}

function ForceGraph({ nodes, edges, onNodeClick, onBackgroundClick, selectedId, viewMode, focusIds }) {
  const svgRef = useRef(null);
  const d3ref = useRef({ linkLines: null, node: null, sim: null, pinOneSeason: false });
  const onNodeClickRef = useRef(onNodeClick);
  const onBackgroundClickRef = useRef(onBackgroundClick);
  onNodeClickRef.current = onNodeClick;
  onBackgroundClickRef.current = onBackgroundClick;

  useEffect(() => {
    const nodeList = Array.isArray(nodes) ? nodes : [];
    const edgeList = Array.isArray(edges) ? edges : [];
    if (!nodeList.length || !svgRef.current) return;

    const container = svgRef.current.parentElement;
    const W = Math.max(320, container?.offsetWidth || 800);
    const H = Math.max(360, container?.offsetHeight || 520);

    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    svg.call(
      d3.zoom()
        .scaleExtent([0.2, 4])
        .on('zoom', e => {
          g.attr('transform', e.transform);
        })
    );

    g.append('rect')
      .attr('width', W)
      .attr('height', H)
      .attr('fill', 'transparent')
      .attr('pointer-events', 'all')
      .on('click', (event) => {
        if (event.target === event.currentTarget) onBackgroundClickRef.current?.();
      });

    const nodeById = new Map(nodeList.map(n => [n.id, { ...n }]));
    const rawLinks = edgeList
      .filter(e => nodeById.has(e.source) && nodeById.has(e.target))
      .map(e => ({
        source: e.source,
        target: e.target,
        weight: Number(e.weight) != null ? Number(e.weight) : 1,
        edge_type: e.edge_type,
        direction: e.direction,
        fee_text: e.fee_text,
        fee_eur: e.fee_eur,
        transfer_season: e.season,
        minutes: e.minutes,
        goals: e.goals,
        assists: e.assists,
      }));

    const simNodes = nodeList.map(n => ({ ...n }));
    const nSeason = simNodes.filter(n => n.node_type === 'season').length;
    const pinOneSeason = viewMode === 'season' && nSeason === 1;

    const sim = d3.forceSimulation(simNodes)
      .velocityDecay(viewMode === 'transfers' ? 0.4 : 0.22)
      .alphaDecay(viewMode === 'transfers' ? 0.04 : 0.0228)
      .force('link', d3.forceLink(rawLinks).id(d => d.id)
        .distance(d => {
          if (viewMode === 'transfers') return 52;
          if (viewMode === 'season') {
            if (nSeason > 1) return Math.min(150, 65 + (d.weight || 0) * 0.1);
            return Math.min(200, 90 + (d.weight || 0) * 0.12);
          }
          return Math.max(70, 220 - Math.min(120, (d.weight || 1) * 14));
        })
        .strength(d => {
          if (viewMode === 'transfers') return 0.6;
          if (viewMode === 'season') return nSeason > 1 ? 0.18 : 0.12;
          return Math.min(0.85, 0.08 + (d.weight || 1) * 0.04);
        }))
      .force('charge', d3.forceManyBody()
        .strength((d) => {
          if (d.node_type === 'season') return nSeason > 1 ? -20 : -50;
          if (d.node_type === 'club' && viewMode === 'transfers') return -55;
          if (d.node_type === 'club') return -120;
          if (viewMode === 'transfers') return -130;
          if (viewMode === 'season' && nSeason > 1) return -200;
          return -380;
        }))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide()
        .radius((d) => {
          if (d.node_type === 'season') return 40;
          if (d.node_type === 'club') {
            if (viewMode === 'transfers') return 18;
            return 22;
          }
          const b = viewMode === 'transfers' ? 0.18 : 0.35;
          return 12 + Math.min(12, (d.goals || 0) * b);
        }));

    simNodes.forEach((d) => {
      if (d.node_type === 'season' && pinOneSeason) {
        d.fx = W / 2;
        d.fy = H / 2;
      }
    });

    const linkLines = g.append('g')
      .attr('class', 'graph-links')
      .attr('stroke-linecap', 'round')
      .selectAll('line')
      .data(rawLinks)
      .join('line')
      .attr('stroke', (d) => {
        if (d.edge_type === 'TRANSFERRED_TO') {
          return (d.direction === 'in' || String(d.direction).toLowerCase() === 'in') ? '#22c55e' : '#ef4444';
        }
        if (d.edge_type === 'PLAYED_IN') return 'rgba(34,197,94,0.45)';
        return 'rgba(255,255,255,0.08)';
      })
      .attr('stroke-opacity', 0.85)
      .attr('stroke-dasharray', d => (d.edge_type === 'TRANSFERRED_TO' ? '4 3' : null))
      .attr('stroke-width', d => {
        if (d.edge_type === 'PLAYED_IN') return Math.max(0.5, 0.4 + (Number(d.minutes) || 0) / 600);
        if (d.edge_type === 'TRANSFERRED_TO') return 1.2;
        return Math.min(5, 0.6 + Math.sqrt(d.weight || 1));
      });
    linkLines
      .append('title')
      .text((d) => {
        if (d.edge_type === 'TRANSFERRED_TO') {
          const y = d.transfer_season != null && d.transfer_season !== '' ? ` · ${d.transfer_season}` : '';
          return `${d.direction} · ${formatFee(d)}${y}`;
        }
        if (d.edge_type === 'PLAYED_IN') {
          return `G ${d.goals ?? 0} · A ${d.assists ?? 0} · ${d.minutes != null ? Math.round(d.minutes) : '—'} min`;
        }
        return `Shared seasons: ${d.weight ?? ''}`;
      });

    const drag = d3.drag()
      .on('start', (event, d) => {
        if (d.node_type === 'season' && pinOneSeason) return;
        if (!event.active) sim.alphaTarget(0.25).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        if (d.node_type === 'season' && pinOneSeason) return;
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (d.node_type === 'season' && pinOneSeason) return;
        if (!event.active) sim.alphaTarget(0);
        d.fx = d.x;
        d.fy = d.y;
      });

    const node = g.append('g')
      .attr('class', 'graph-nodes')
      .selectAll('g')
      .data(simNodes)
      .join('g')
      .attr('cursor', d => (d.node_type === 'season' && pinOneSeason ? 'default' : 'move'))
      .call(drag)
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.node_type === 'season') return;
        onNodeClickRef.current(d);
      });

    node
      .filter(d => d.node_type !== 'club' && d.node_type !== 'season')
      .append('circle')
      .attr('r', d => {
        const base = 12;
        const gBonus = Math.min(10, (Number(d.goals) || 0) * 0.35);
        return base + gBonus;
      })
      .attr('fill', d => getColor(d.position, d.node_type))
      .attr('fill-opacity', 0.88)
      .attr('stroke', 'rgba(255,255,255,0.18)')
      .attr('stroke-width', 1);

    node
      .filter(d => d.node_type === 'club')
      .append('rect')
      .attr('x', -16)
      .attr('y', -16)
      .attr('width', 32)
      .attr('height', 32)
      .attr('rx', 4)
      .attr('fill', 'rgba(246, 199, 0, 0.2)')
      .attr('stroke', 'var(--lfc-gold)')
      .attr('stroke-width', 1.2);

    node
      .filter(d => d.node_type === 'season')
      .append('circle')
      .attr('r', 38)
      .attr('fill', 'rgba(34, 197, 94, 0.12)')
      .attr('stroke', '#22c55e')
      .attr('stroke-width', 2);

    node.append('text')
      .text(d => {
        if (d.node_type === 'club' && d.label) {
          const lab = String(d.label);
          return lab.length > 10 ? `${lab.slice(0, 9)}…` : lab;
        }
        if (d.node_type === 'season') return 'Season';
        const parts = (d.label || d.id || '').split(' ');
        return parts.length ? parts[parts.length - 1] : '';
      })
      .attr('text-anchor', 'middle')
      .attr('dy', d => (d.node_type === 'season' ? '-6' : '0.35em'))
      .attr('fill', d => (d.node_type === 'season' ? '#a7f3d0' : '#fff'))
      .attr('font-size', d => (d.node_type === 'season' ? 10 : 9))
      .attr('font-weight', 600)
      .attr('pointer-events', 'none');

    node
      .filter(d => d.node_type === 'season' && d.label)
      .append('text')
      .text(d => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.5em')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', 9)
      .attr('pointer-events', 'none');

    d3ref.current = { linkLines, node, sim, pinOneSeason };

    sim.on('tick', () => {
      linkLines
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => {
      sim.stop();
      d3ref.current = { linkLines: null, node: null, sim: null, pinOneSeason: false };
    };
  }, [nodes, edges, viewMode]);

  useEffect(() => {
    const { linkLines, node, pinOneSeason } = d3ref.current;
    if (!linkLines || !node) return;
    const focus = focusIds;

    const linkOpacity = (d) => {
      if (!focus) return 1;
      const a = linkEndId(d.source);
      const b = linkEndId(d.target);
      return focus.has(a) && focus.has(b) ? 1 : 0.07;
    };

    linkLines.attr('opacity', linkOpacity);

    node
      .attr('opacity', (d) => {
        if (d.node_type === 'season' && pinOneSeason) return 1;
        if (!focus) return 1;
        return focus.has(d.id) ? 1 : 0.1;
      })
      .each(function (d) {
        const g = d3.select(this);
        g.select('circle, rect')
          .attr('stroke', () => (d.id === selectedId ? '#ffffff' : (d.node_type === 'club' ? 'var(--lfc-gold)' : 'rgba(255,255,255,0.18)')))
          .attr('stroke-width', () => {
            if (d.id === selectedId) return d.node_type === 'club' ? 2.5 : 2.2;
            return d.node_type === 'club' ? 1.2 : 1;
          });
      });
  }, [selectedId, focusIds, nodes]);

  return <svg ref={svgRef} className={styles.svg} />;
}

function NodePanel({ node, partnerships, loadingP, onClose, viewMode }) {
  if (!node) return null;
  if (node.node_type === 'club') {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h3 className={styles.panelName}>{node.label}</h3>
            <p className={styles.panelPos}>Other club (transfer graph)</p>
          </div>
          <button type="button" className={styles.panelClose} onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className={styles.stats}>Clubs in this view come from <code>edge_transferred_to</code>.</p>
      </div>
    );
  }
  if (node.node_type === 'season') {
    return null;
  }
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelName}>{node.label}</h3>
          <p className={styles.panelPos}>{node.position || '—'}</p>
        </div>
        <button type="button" className={styles.panelClose} onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className={styles.panelStats}>
        <div className={styles.ps}>
          <span className={styles.psVal}>{node.goals ?? 0}</span>
          <span className={styles.psLabel}>Goals</span>
        </div>
        <div className={styles.ps}>
          <span className={styles.psVal}>{node.assists ?? 0}</span>
          <span className={styles.psLabel}>Assists</span>
        </div>
        <div className={styles.ps}>
          <span className={styles.psVal}>{node.minutes != null ? Math.round(node.minutes) : '—'}</span>
          <span className={styles.psLabel}>Minutes</span>
        </div>
        {Number(node.market_value) > 0 && (
          <div className={styles.ps}>
            <span className={styles.psVal}>€{(Number(node.market_value) / 1e6).toFixed(0)}m</span>
            <span className={styles.psLabel}>TM value</span>
          </div>
        )}
      </div>
      {viewMode === 'teammates' && (
        <>
          <p className={styles.panelSectionTitle}>Top partnership overlap</p>
          {loadingP ? (
            <p className={styles.stats}>Loading…</p>
          ) : (Array.isArray(partnerships) ? partnerships : []).length === 0 ? (
            <p className={styles.stats}>No partner rows (refresh graph in BigQuery if empty).</p>
          ) : (
            (Array.isArray(partnerships) ? partnerships : []).slice(0, 8).map((p, i) => (
              <div key={`${p.partner_name}-${i}`} className={styles.partnership}>
                <span className={styles.partnerName} title={p.partner_name}>{p.partner_name}</span>
                <span className={styles.partnerSeasons}>{p.shared_seasons} szns</span>
              </div>
            ))
          )}
        </>
      )}
      {viewMode === 'transfers' && (
        <p className={styles.stats}>Player → club links use <code>edge_transferred_to</code> (green in, red out). Hover a line for the fee in the browser tooltip (SVG title).</p>
      )}
      {viewMode === 'season' && (
        <p className={styles.stats}>Spokes use <code>edge_played_in</code> (minutes = link weight).</p>
      )}
    </div>
  );
}

export default function Graph({ season }) {
  const [viewMode, setViewMode] = useState('teammates');
  const [graphScope, setGraphScope] = useState('nav');
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [partnerships, setPartnerships] = useState([]);
  const [loadingP, setLoadingP] = useState(false);
  const [filter, setFilter] = useState('all');
  const [playerQ, setPlayerQ] = useState('');
  const [clubQ, setClubQ] = useState('');
  const [seasonQ, setSeasonQ] = useState('');

  const urlForView = (v) => {
    if (v === 'season') return '/api/graph/seasons-full-network';
    const s = graphScope === 'all' ? 'all' : season;
    if (v === 'teammates') return `/api/graph/squad-network?season=${encodeURIComponent(s || 'all')}`;
    return `/api/graph/transfer-network?season=${encodeURIComponent(s || 'all')}`;
  };

  useEffect(() => {
    setSelectedNode(null);
  }, [season, viewMode, graphScope]);

  useEffect(() => {
    if (viewMode !== 'season' && !season) return;
    setLoading(true);
    setError('');
    fetch(urlForView(viewMode))
      .then(async r => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || r.statusText);
        return body;
      })
      .then(d => {
        setGraphData({ nodes: d.nodes || [], edges: d.edges || [] });
        setLoading(false);
      })
      .catch(e => {
        setError(e.message || 'Failed to load graph');
        setGraphData({ nodes: [], edges: [] });
        setLoading(false);
      });
  }, [season, viewMode, graphScope]);

  useEffect(() => {
    if (viewMode !== 'teammates' || !selectedNode?.label || selectedNode?.node_type !== 'player') {
      setPartnerships([]);
      return;
    }
    setLoadingP(true);
    fetch(`/api/graph/partnerships?player=${encodeURIComponent(selectedNode.label)}&limit=12`)
      .then(r => r.json())
      .then(rows => {
        const list = Array.isArray(rows) ? rows : [];
        setPartnerships(
          list.map(r => ({
            partner_name: r.partner_name,
            shared_seasons: r.shared_seasons,
            combined_goals: r.combined_goals,
          }))
        );
        setLoadingP(false);
      })
      .catch(() => {
        setPartnerships([]);
        setLoadingP(false);
      });
  }, [selectedNode, viewMode]);

  const onNodeClick = useCallback((d) => {
    setSelectedNode(d);
  }, []);
  const onGraphBackground = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const usePositionFilter = viewMode === 'teammates';
  const { preNodes, preEdges } = useMemo(() => {
    const rawN = Array.isArray(graphData?.nodes) ? graphData.nodes : [];
    const rawE = Array.isArray(graphData?.edges) ? graphData.edges : [];
    if (!usePositionFilter) {
      return { preNodes: rawN, preEdges: rawE };
    }
    const preNodes0 = rawN.filter(
      n => n.node_type === 'player' && matchesFilter(n, filter)
    );
    const preIdSet = new Set(preNodes0.map(n => n.id));
    return {
      preNodes: preNodes0,
      preEdges: rawE.filter(e => preIdSet.has(e.source) && preIdSet.has(e.target)),
    };
  }, [graphData, usePositionFilter, filter]);

  const { displayNodes, displayEdges } = useMemo(() => {
    const r = applySearchSubgraph(preNodes, preEdges, { player: playerQ, club: clubQ, season: seasonQ });
    return {
      displayNodes: r?.nodes ?? [],
      displayEdges: r?.edges ?? [],
    };
  }, [preNodes, preEdges, playerQ, clubQ, seasonQ]);

  const focusIds = useMemo(() => {
    if (!selectedNode) return null;
    const id = selectedNode.id;
    const s = new Set([id]);
    const es = Array.isArray(displayEdges) ? displayEdges : [];
    for (const e of es) {
      if (e.source === id) s.add(e.target);
      if (e.target === id) s.add(e.source);
    }
    return s;
  }, [selectedNode, displayEdges]);

  const unknownCount = usePositionFilter
    ? (Array.isArray(graphData?.nodes) ? graphData.nodes : [])
      .filter(n => n.node_type === 'player' && !(n.position || '').trim()).length
    : 0;

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.title}>Squad network</h1>
          <p className={styles.subtitle}>
            {viewMode === 'season' && 'Full data · '}
            {viewMode !== 'season' && (graphScope === 'all' ? 'All time · ' : `${seasonLabel(season)} · `)}
            {VIEWS.find(v => v.id === viewMode)?.desc}
            {unknownCount > 0 && usePositionFilter && (
              <span> · {unknownCount} players with no position (from TM) are hidden by filters — use <strong>All</strong> to see them.</span>
            )}
          </p>
        </div>
        <div className={styles.toolbarRight}>
          <div className={styles.viewTabs} role="tablist" aria-label="Graph relationship type">
            {VIEWS.map(v => (
              <button
                key={v.id}
                type="button"
                role="tab"
                className={`${styles.viewTab} ${viewMode === v.id ? styles.viewTabActive : ''}`}
                onClick={() => {
                  setViewMode(v.id);
                  setFilter('all');
                  setPlayerQ('');
                  setClubQ('');
                  setSeasonQ('');
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
          {(viewMode === 'teammates' || viewMode === 'transfers') && (
            <div
              className={styles.scopeTabs}
              role="group"
              aria-label="Graph scope: squad year or all players in dataset"
            >
              <button
                type="button"
                className={`${styles.scopeTab} ${graphScope === 'nav' ? styles.scopeTabActive : ''}`}
                onClick={() => setGraphScope('nav')}
              >
                This season
              </button>
              <button
                type="button"
                className={`${styles.scopeTab} ${graphScope === 'all' ? styles.scopeTabActive : ''}`}
                onClick={() => setGraphScope('all')}
              >
                All time
              </button>
            </div>
          )}
          {usePositionFilter && (
            <div className={styles.filters}>
              {['all', 'goalkeeper', 'back', 'midfield', 'winger', 'forward'].map(f => (
                <button
                  key={f}
                  type="button"
                  className={`${styles.filterBtn} ${filter === f ? styles.active : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.legend}>
        {Object.entries(POSITION_COLORS)
          .filter(([k]) => k !== 'default')
          .slice(0, 8)
          .map(([pos, color]) => (
            <span key={pos} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: color }} />
              {pos}
            </span>
          ))}
        {viewMode === 'transfers' && (
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#22c55e' }} />
            In
            <span className={styles.legendDot} style={{ background: '#ef4444', marginLeft: 6 }} />
            Out
          </span>
        )}
        {viewMode === 'season' && (
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#22c55e' }} />
            Thickness ≈ minutes
          </span>
        )}
      </div>

      <div className={styles.searchRow} aria-label="Narrow the graph by name">
        <label>
          <span>Player</span>
          <input
            className={styles.searchField}
            value={playerQ}
            onChange={e => setPlayerQ(e.target.value)}
            placeholder="Filter by player name"
            type="search"
            autoComplete="off"
            spellCheck="false"
          />
        </label>
        {(viewMode === 'transfers') && (
          <label>
            <span>Club</span>
            <input
              className={styles.searchField}
              value={clubQ}
              onChange={e => setClubQ(e.target.value)}
              placeholder="e.g. Dortmund, Leipzig"
              type="search"
              autoComplete="off"
              spellCheck="false"
            />
          </label>
        )}
        {viewMode === 'season' && (
          <label>
            <span>Season</span>
            <input
              className={styles.searchField}
              value={seasonQ}
              onChange={e => setSeasonQ(e.target.value)}
              placeholder="Code or label (e.g. 25/26, 2324)"
              type="search"
              autoComplete="off"
              spellCheck="false"
            />
          </label>
        )}
      </div>

      <div className={styles.graphContainer}>
        {error && <div className={styles.err}>{error}</div>}
        {loading ? (
          <div className={styles.loading}>Loading graph…</div>
        ) : (
          <ForceGraph
            nodes={displayNodes}
            edges={displayEdges}
            onNodeClick={onNodeClick}
            onBackgroundClick={onGraphBackground}
            selectedId={selectedNode?.id}
            viewMode={viewMode}
            focusIds={focusIds}
          />
        )}
        {selectedNode && (
          <NodePanel
            node={selectedNode}
            partnerships={partnerships}
            loadingP={loadingP}
            onClose={() => setSelectedNode(null)}
            viewMode={viewMode}
          />
        )}
      </div>

      {!loading && !error && (
        <div className={styles.stats}>
          <span>{displayNodes.length} nodes</span>
          <span>·</span>
          <span>{displayEdges.length} links</span>
        </div>
      )}
    </div>
  );
}
