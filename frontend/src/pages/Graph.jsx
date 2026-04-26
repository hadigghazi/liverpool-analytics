import { useState, useEffect, useRef, useCallback } from 'react';
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

function getColor(position) {
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

function matchesFilter(node, filter) {
  if (filter === 'all') return true;
  const pos = (node.position || '').toLowerCase();
  if (filter === 'goalkeeper') return pos.includes('goalkeeper');
  if (filter === 'back') return pos.includes('back') || pos.includes('defence') || pos.includes('defense');
  if (filter === 'midfield') return pos.includes('midfield');
  if (filter === 'winger') return pos.includes('winger');
  if (filter === 'forward') {
    return pos.includes('forward') || pos.includes('striker') || pos.includes('strike');
  }
  return true;
}

function ForceGraph({ nodes, edges, onNodeClick, selectedId }) {
  const svgRef = useRef(null);
  const simRef = useRef(null);

  useEffect(() => {
    if (!nodes.length || !svgRef.current) return;

    const container = svgRef.current.parentElement;
    const W = Math.max(320, container?.offsetWidth || 800);
    const H = Math.max(360, container?.offsetHeight || 520);

    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    svg.call(
      d3.zoom()
        .scaleExtent([0.25, 4])
        .on('zoom', e => {
          g.attr('transform', e.transform);
        })
    );

    const nodeById = new Map(nodes.map(n => [n.id, { ...n }]));
    const links = edges
      .filter(e => nodeById.has(e.source) && nodeById.has(e.target))
      .map(e => ({
        source: e.source,
        target: e.target,
        weight: Number(e.weight) || 1,
      }));

    const simNodes = nodes.map(n => ({ ...n }));
    const sim = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(links).id(d => d.id)
        .distance(d => Math.max(70, 220 - Math.min(120, (d.weight || 1) * 14)))
        .strength(d => Math.min(0.85, 0.08 + (d.weight || 1) * 0.04)))
      .force('charge', d3.forceManyBody().strength(-380))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide().radius(d => 14 + Math.min(12, (d.goals || 0) * 0.35)));

    simRef.current = sim;

    const link = g.append('g')
      .attr('stroke', 'rgba(255,255,255,0.08)')
      .attr('stroke-opacity', 0.75)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', d => Math.min(5, 0.6 + Math.sqrt(d.weight || 1)));

    const drag = d3.drag()
      .on('start', (event, d) => {
        if (!event.active) sim.alphaTarget(0.25).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    const node = g.append('g')
      .selectAll('g')
      .data(simNodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(drag)
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClick(d);
      });

    node.append('circle')
      .attr('r', d => {
        const base = 12;
        const gBonus = Math.min(10, (Number(d.goals) || 0) * 0.35);
        return base + gBonus;
      })
      .attr('fill', d => getColor(d.position))
      .attr('fill-opacity', 0.88)
      .attr('stroke', d => (d.id === selectedId ? '#ffffff' : 'rgba(255,255,255,0.18)'))
      .attr('stroke-width', d => (d.id === selectedId ? 2.2 : 1));

    node.append('text')
      .text(d => {
        const parts = (d.label || d.id || '').split(' ');
        return parts.length ? parts[parts.length - 1] : '';
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#fff')
      .attr('font-size', 9)
      .attr('font-weight', 600)
      .attr('pointer-events', 'none');

    sim.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => {
      sim.stop();
    };
  }, [nodes, edges, selectedId, onNodeClick]);

  return <svg ref={svgRef} className={styles.svg} />;
}

function NodePanel({ node, partnerships, loadingP, onClose }) {
  if (!node) return null;
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
      <p className={styles.panelSectionTitle}>Partners (shared seasons)</p>
      {loadingP ? (
        <p className={styles.stats}>Loading…</p>
      ) : partnerships.length === 0 ? (
        <p className={styles.stats}>No partnership rows (run graph populate SQL).</p>
      ) : (
        partnerships.slice(0, 8).map((p, i) => (
          <div key={`${p.partner_name}-${i}`} className={styles.partnership}>
            <span className={styles.partnerName} title={p.partner_name}>{p.partner_name}</span>
            <span className={styles.partnerSeasons}>{p.shared_seasons} szns</span>
          </div>
        ))
      )}
    </div>
  );
}

export default function Graph({ season }) {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [partnerships, setPartnerships] = useState([]);
  const [loadingP, setLoadingP] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!season) return;
    setLoading(true);
    setError('');
    setSelectedNode(null);
    fetch(`/api/graph/squad-network?season=${encodeURIComponent(season)}`)
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
  }, [season]);

  useEffect(() => {
    if (!selectedNode?.label) {
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
  }, [selectedNode]);

  const onNodeClick = useCallback(d => {
    setSelectedNode(d);
  }, []);

  const filteredNodes = graphData.nodes.filter(n => matchesFilter(n, filter));
  const idSet = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = graphData.edges.filter(
    e => idSet.has(e.source) && idSet.has(e.target)
  );

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.title}>Squad network</h1>
          <p className={styles.subtitle}>
            {seasonLabel(season)} — Co-season links from <code>edge_played_with</code>. Node size ≈ goals; edge thickness ≈ shared seasons. Drag nodes; scroll to zoom.
          </p>
        </div>
        <div className={styles.toolbarRight}>
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
      </div>

      <div className={styles.graphContainer}>
        {error && <div className={styles.err}>{error}</div>}
        {loading ? (
          <div className={styles.loading}>Building network…</div>
        ) : (
          <ForceGraph
            nodes={filteredNodes}
            edges={filteredEdges}
            onNodeClick={onNodeClick}
            selectedId={selectedNode?.id}
          />
        )}
        {selectedNode && (
          <NodePanel
            node={selectedNode}
            partnerships={partnerships}
            loadingP={loadingP}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>

      {!loading && !error && (
        <div className={styles.stats}>
          <span>{filteredNodes.length} players</span>
          <span>·</span>
          <span>{filteredEdges.length} links</span>
          <span>·</span>
          <span>Click a node for partnerships (BigQuery Graph)</span>
        </div>
      )}
    </div>
  );
}
