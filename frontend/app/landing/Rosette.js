import styles from "./Rosette.module.css";

// The hero's drawing: the compass-and-straightedge construction of an eight-point star, ringed by
// an astrolabe's degree scale. Hairlines only, drawn in on load. Pure geometry, computed here, so
// there is no image to ship. Radii are in units of the outer circle (100).
const R = 100;
const point = (deg, r) => {
  const a = ((deg - 90) * Math.PI) / 180; // 0 degrees points straight up
  return [r * Math.cos(a), r * Math.sin(a)];
};
const fmt = (n) => Math.round(n * 100) / 100;
const polygon = (order) => "M" + order.map((k) => point(k * 45, R).map(fmt).join(" ")).join("L") + "Z";

// Inner radius of a {8/m} star polygon: R cos(m pi/8) / cos((m-1) pi/8).
const inner = (m) => (R * Math.cos((m * Math.PI) / 8)) / Math.cos(((m - 1) * Math.PI) / 8);

const circles = [R, R * Math.cos(Math.PI / 8), inner(2), inner(3), inner(3) * Math.cos(Math.PI / 8) * 0.62];
const shapes = [
  polygon([0, 2, 4, 6]), // two squares make the {8/2} star
  polygon([1, 3, 5, 7]),
  polygon([0, 3, 6, 1, 4, 7, 2, 5]), // the {8/3} star
];
const axes = Array.from({ length: 8 }, (_, k) => [point(k * 22.5, 0), point(k * 22.5, 158), point(k * 22.5 + 180, 158)]);
const ticks = Array.from({ length: 72 }, (_, k) => {
  const deg = k * 5;
  const major = deg % 45 === 0;
  return [point(deg, 106), point(deg, major ? 118 : 110), major];
});

export default function Rosette() {
  let n = 0; // stagger: each stroke starts a little after the one before
  const delay = () => ({ "--i": n++ });
  return (
    <svg className={styles.rosette} viewBox="-160 -160 320 320" aria-hidden="true">
      <defs>
        <radialGradient id="rosette-fade">
          <stop offset="0.55" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="rosette-mask">
          <rect x="-160" y="-160" width="320" height="320" fill="url(#rosette-fade)" />
        </mask>
      </defs>
      <g mask="url(#rosette-mask)">
        <g className={styles.faint}>
          {axes.map(([, a, b], k) => (
            <path key={k} d={`M${a.map(fmt).join(" ")}L${b.map(fmt).join(" ")}`} style={{ "--i": k }} />
          ))}
        </g>
        <g className={styles.ring}>
          {ticks.map(([a, b, major], k) => (
            <path
              key={k}
              className={major ? styles.major : undefined}
              d={`M${a.map(fmt).join(" ")}L${b.map(fmt).join(" ")}`}
            />
          ))}
          <circle r="106" pathLength="1" />
        </g>
        {circles.map((r) => (
          <circle key={r} r={fmt(r)} pathLength="1" style={delay()} />
        ))}
        {shapes.map((d) => (
          <path key={d} d={d} pathLength="1" style={delay()} className={styles.star} />
        ))}
        {Array.from({ length: 8 }, (_, k) => {
          const [x, y] = point(k * 45, R);
          return <circle key={k} cx={fmt(x)} cy={fmt(y)} r="1.4" className={styles.node} />;
        })}
      </g>
    </svg>
  );
}
