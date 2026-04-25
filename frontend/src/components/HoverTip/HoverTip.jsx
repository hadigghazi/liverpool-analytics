import { useCallback, useRef, useState } from 'react';
import styles from './HoverTip.module.css';

export default function HoverTip({ children, title, lines = [], wrapClassName = '', variant = 'block' }) {
  const wrapRef = useRef(null);
  const [tip, setTip] = useState(null);

  const onMove = useCallback((e) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    setTip({ x, y, title, lines });
  }, [title, lines]);

  const onLeave = useCallback(() => setTip(null), []);

  return (
    <div
      ref={wrapRef}
      className={`${styles.wrap} ${variant === 'flex1' ? styles.flex1 : ''} ${wrapClassName}`.trim()}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
      {tip && (
        <div
          className={styles.tip}
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.title && <div className={styles.title}>{tip.title}</div>}
          {tip.lines?.map((line, i) => (
            <div key={i} className={styles.line}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
