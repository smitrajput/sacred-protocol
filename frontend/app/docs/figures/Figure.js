import styles from "./figures.module.css";

// The parts a docs diagram is drawn from. Each figure is plain SVG in a viewBox: boxes, labelled
// arrows and a few glyphs, placed by hand in the figure modules. Marker and pattern ids are the
// same in every figure on purpose: they are identical, and the first in the document serves all.

export function Figure({ w, h, min = 560, label, caption, children }) {
  return (
    <figure className={styles.figure}>
      <svg className={styles.svg} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} style={{ minWidth: min }}>
        <defs>
          <marker id="fig-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" className={styles.head} />
          </marker>
          <marker id="fig-arrow-accent" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" className={styles.headAccent} />
          </marker>
          <pattern id="fig-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" className={styles.hatch} />
          </pattern>
          <pattern id="fig-hatch-accent" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" className={styles.hatchAccent} />
          </pattern>
        </defs>
        {children}
      </svg>
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
}

// One or more lines of text, stacked.
export function Text({ x, y, lines, anchor = "middle", className = styles.body, dy = 12.5 }) {
  const list = [].concat(lines);
  return (
    <text x={x} y={y} textAnchor={anchor} className={className}>
      {list.map((line, i) => (
        <tspan key={i} x={x} dy={i ? dy : 0}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

// A box with a bold title, muted sub-lines under it, or plain body lines. Text is centred.
export function Box({ x, y, w, h, title, sub, body, kind = "paper" }) {
  const subs = sub ? [].concat(sub) : [];
  const bodies = body ? [].concat(body) : [];
  const block = (title ? 13 : 0) + subs.length * 12.5 + bodies.length * 13;
  let baseline = y + (h - block) / 2 + 10;
  const cx = x + w / 2;
  const out = [];
  if (title) {
    out.push(
      <text key="t" x={cx} y={baseline} textAnchor="middle" className={styles.title}>
        {title}
      </text>,
    );
    baseline += 13;
  }
  if (subs.length) out.push(<Text key="s" x={cx} y={baseline} lines={subs} className={styles.sub} />);
  if (bodies.length) out.push(<Text key="b" x={cx} y={baseline} lines={bodies} className={styles.body} dy={13} />);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="2" className={styles[kind]} />
      {out}
    </g>
  );
}

// A polyline with an arrowhead, or a path given as `d`, with an optional label at `at`.
export function Arrow({ points, d, label, at, anchor = "middle", dashed, accent, mute, head = true }) {
  const path = d ?? points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  const cls = [styles.line, dashed && styles.dashed, accent && styles.accentLine].filter(Boolean).join(" ");
  const labelCls = accent ? styles.labelAccent : mute ? styles.labelMute : styles.label;
  return (
    <g>
      <path d={path} className={cls} markerEnd={head ? `url(#fig-arrow${accent ? "-accent" : ""})` : undefined} />
      {label && <Text x={at[0]} y={at[1]} lines={label} anchor={anchor} className={labelCls} />}
    </g>
  );
}

// ---- Glyphs for the strip ----

export function Person({ x, y, label }) {
  return (
    <>
      <g className={styles.glyph}>
        <circle cx={x} cy={y - 12} r="6" />
        <path d={`M${x - 12} ${y + 10} A12 12 0 0 1 ${x + 12} ${y + 10}`} />
      </g>
      <Text x={x} y={y + 26} lines={label} className={styles.sub} />
    </>
  );
}

export function Bucket({ x, y, label }) {
  return (
    <>
      <g className={styles.glyph}>
        <path d={`M${x - 18} ${y - 14} H${x + 18} L${x + 14} ${y + 14} H${x - 14} Z`} />
        <ellipse cx={x} cy={y - 14} rx="18" ry="3" />
      </g>
      <Text x={x} y={y + 30} lines={label} className={styles.sub} />
    </>
  );
}

export function Coin({ x, y }) {
  return (
    <g>
      <circle cx={x} cy={y} r="10" className={styles.coin} />
      <text x={x} y={y + 2.5} textAnchor="middle" className={styles.coinText}>
        BTC
      </text>
    </g>
  );
}

export function Cash({ x, y, text, accent }) {
  const w = text.length * 6 + 14;
  return (
    <g>
      <rect x={x - w / 2} y={y - 8} width={w} height="16" rx="8" className={`${styles.cash} ${accent ? styles.cashAccent : ""}`} />
      <text x={x} y={y + 3.5} textAnchor="middle" className={`${styles.cashText} ${accent ? styles.cashTextAccent : ""}`}>
        {text}
      </text>
    </g>
  );
}
