// Top-down pizza drawn in brand tokens (no raster assets, so it stays crisp and themeable).
const PEPPERONI: [number, number][] = [
  [100, 52], [140, 78], [140, 122], [100, 148], [60, 122], [60, 78], [100, 100],
  [78, 98], [124, 100],
];
const BASIL: [number, number, number][] = [
  [118, 70, 20], [82, 128, 200], [126, 134, 70], [74, 72, 140],
];

export function Pizza({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Pizza" className={className}>
      <circle cx="100" cy="100" r="96" className="fill-crust" />
      <circle cx="100" cy="100" r="96" className="fill-none stroke-crust-dark" strokeWidth="2" />
      <circle cx="100" cy="100" r="82" className="fill-cheese" />
      {Array.from({ length: 8 }, (_, i) => (
        <line key={i} x1="100" y1="100" x2="100" y2="18" transform={`rotate(${i * 45 + 22.5} 100 100)`} className="stroke-crust" strokeWidth="2" strokeLinecap="round" />
      ))}
      {PEPPERONI.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="13" className="fill-brand" />
          <circle cx={x - 3} cy={y - 3} r="3" className="fill-brand-hover" />
          <circle cx={x + 4} cy={y + 3} r="2.5" className="fill-brand-hover" />
        </g>
      ))}
      {BASIL.map(([x, y, rot], i) => (
        <ellipse key={i} cx={x} cy={y} rx="9" ry="5" transform={`rotate(${rot} ${x} ${y})`} className="fill-success" />
      ))}
    </svg>
  );
}
