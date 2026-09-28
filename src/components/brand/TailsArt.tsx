/**
 * The coin's tails side as flat art: the octagram mount from the launch post
 * with the Ionic column at its heart. Original drawing; the 3D coin's tails
 * texture follows the same recipe (src/three/coin/textures.ts).
 */
export function TailsArt({ className, title }: { className?: string; title?: string }) {
  const square = (rot: number, r: number) => {
    const pts = [0, 1, 2, 3].map((k) => {
      const a = rot + (k * Math.PI) / 2;
      return `${(50 + Math.cos(a) * r).toFixed(2)},${(50 + Math.sin(a) * r).toFixed(2)}`;
    });
    return pts.join(" ");
  };
  const stones: [number, number][] = [];
  for (const rot of [-Math.PI / 4, 0]) {
    for (let k = 0; k < 4; k++) {
      const a0 = rot + (k * Math.PI) / 2;
      const a1 = a0 + Math.PI / 2;
      for (let s = 1; s < 8; s++) {
        const t = s / 8;
        stones.push([
          50 + (Math.cos(a0) * (1 - t) + Math.cos(a1) * t) * 37,
          50 + (Math.sin(a0) * (1 - t) + Math.sin(a1) * t) * 37,
        ]);
      }
    }
  }
  return (
    <svg viewBox="0 0 100 100" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <circle cx="50" cy="50" r="49" className="fill-accent-muted" />
      <circle cx="50" cy="50" r="45" fill="none" className="stroke-rule" strokeWidth="0.8" />
      {[-Math.PI / 4, 0].map((rot) => (
        <g key={rot} fill="none" className="stroke-accent-strong">
          <polygon points={square(rot, 39)} strokeWidth="1" />
          <polygon points={square(rot, 35)} strokeWidth="0.5" />
        </g>
      ))}
      {stones.map(([x, y], i) => (
        <circle key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} r="0.7" className="fill-accent-strong" />
      ))}
      <circle cx="50" cy="50" r="17" className="fill-accent stroke-accent-strong" strokeWidth="0.8" />
      <g transform="translate(40.2 38.8) scale(0.7)" fill="none" className="stroke-on-accent" strokeWidth="1.3" strokeLinecap="round">
        <path d="M3.5 3.5h21M7.5 5.2h13M8 7.4h12M9 9.6h10M9.5 10.4v15.2M18.5 10.4v15.2M12 11.2v13.6M14 11.2v13.6M16 11.2v13.6M8 26.2h12M6.5 28h15M4.5 30h19" />
        <path d="M7.5 5.2c-2.6 0-4 1.2-4 2.7 0 1.3 1 2.2 2.2 2.2 1 0 1.8-.7 1.8-1.6 0-.8-.6-1.3-1.3-1.3-.6 0-1 .4-1 .9M20.5 5.2c2.6 0 4 1.2 4 2.7 0 1.3-1 2.2-2.2 2.2-1 0-1.8-.7-1.8-1.6 0-.8.6-1.3 1.3-1.3.6 0 1 .4 1 .9" />
      </g>
    </svg>
  );
}
