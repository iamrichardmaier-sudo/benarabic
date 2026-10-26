/**
 * Shared drawing pieces for the level backgrounds: stars, a crescent, a
 * hanging lantern (fanous) and a mosque skyline.
 *
 * Scenes are drawn without a viewBox and placed with percentages, while each
 * piece is drawn in pixels inside its own nested <svg>. A skyline therefore
 * stays anchored to the bottom and a crescent to its corner on a tall phone
 * and a wide monitor alike, where a scaled viewBox would crop or squash them.
 */
import type { ReactNode, SVGProps } from 'react';

/** Deterministic pseudo-random numbers, so a scene looks the same every visit. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Points of an n-pointed star polygon. */
export function starPoints(cx: number, cy: number, n: number, outer: number, inner: number, rotate = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((rotate + (i * 180) / n) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/** The eight-pointed khatam: two squares, one turned 45°. */
export function Octagram({ cx, cy, r, ...rest }: { cx: number; cy: number; r: number } & SVGProps<SVGGElement>) {
  const s = r * Math.SQRT2;
  return (
    <g {...rest}>
      <rect x={cx - s / 2} y={cy - s / 2} width={s} height={s} />
      <rect x={cx - s / 2} y={cy - s / 2} width={s} height={s} transform={`rotate(45 ${cx} ${cy})`} />
    </g>
  );
}

interface StarFieldProps {
  count: number;
  seed: number;
  /** Fraction of the height the stars occupy, from the top. */
  depth?: number;
  color?: string;
  twinkle?: boolean;
}

export function StarField({ count, seed, depth = 0.75, color = '#fff8e7', twinkle = false }: StarFieldProps) {
  const rnd = seeded(seed);
  return (
    <g fill={color}>
      {Array.from({ length: count }, (_, i) => {
        const x = rnd() * 100;
        const y = rnd() * depth * 100;
        const r = 0.5 + rnd() * rnd() * 1.6;
        const o = 0.35 + rnd() * 0.65;
        const anim = twinkle && i % 3 === 0;
        return (
          <circle
            key={i}
            cx={`${x}%`}
            cy={`${y}%`}
            r={r}
            opacity={o}
            className={anim ? 'wz-anim wz-twinkle' : undefined}
            style={anim ? { animationDelay: `${(rnd() * 6).toFixed(2)}s`, animationDuration: `${(3 + rnd() * 4).toFixed(2)}s` } : undefined}
          />
        );
      })}
    </g>
  );
}

/** A crescent moon of radius r, with a soft halo. */
export function Crescent({ x, y, r = 34, color = '#fdf3d0', id }: { x: string; y: string; r?: number; color?: string; id: string }) {
  return (
    <svg x={x} y={y} overflow="visible">
      <defs>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-cut`}>
          <rect x={-r * 2} y={-r * 2} width={r * 4} height={r * 4} fill="white" />
          <circle cx={r * 0.42} cy={-r * 0.18} r={r * 0.86} fill="black" />
        </mask>
      </defs>
      <circle r={r * 3.2} fill={`url(#${id}-halo)`} />
      <circle r={r} fill={color} mask={`url(#${id}-cut)`} />
    </svg>
  );
}

/**
 * A hanging lantern: cord from the top of the screen, cap, glowing body with
 * window panes, and a pointed foot. `length` is the cord in pixels.
 */
export function Lantern({
  x, length, scale = 1, sway = false, delay = 0, id, metal = '#c9962f', light = '#ffd27a',
}: {
  x: string; length: number; scale?: number; sway?: boolean; delay?: number; id: string; metal?: string; light?: string;
}) {
  const L = length;
  return (
    <svg x={x} y="0" overflow="visible">
      <g
        className={sway ? 'wz-anim wz-sway' : undefined}
        style={sway ? { animationDelay: `${delay}s`, transformOrigin: '0px 0px' } : undefined}
      >
        <line x1="0" y1="0" x2="0" y2={L} stroke={metal} strokeOpacity="0.7" strokeWidth="1.2" />
        <g transform={`translate(0 ${L}) scale(${scale})`}>
          <defs>
            <radialGradient id={`${id}-glow`}>
              <stop offset="0%" stopColor={light} stopOpacity="0.55" />
              <stop offset="100%" stopColor={light} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cy="38" r="62" fill={`url(#${id}-glow)`} className={sway ? 'wz-anim wz-glow' : undefined} />
          <circle cy="2" r="3.2" fill="none" stroke={metal} strokeWidth="1.4" />
          <path d="M-15 17 Q0 1 15 17 Z" fill={metal} />
          <path d="M-19 17 H19 L15 58 H-15 Z" fill={light} fillOpacity="0.9" stroke={metal} strokeWidth="2" />
          <path d="M-6.5 17 L-5 58 M6.5 17 L5 58 M-17 31 H17 M-16 45 H16" stroke={metal} strokeWidth="1.2" />
          <path d={starPoints(0, 37.5, 8, 5, 2.4)} fill={metal} fillOpacity="0.8" />
          <path d="M-15 58 L0 74 L15 58 Z" fill={metal} />
          <circle cy="77" r="2" fill={metal} />
        </g>
      </g>
    </svg>
  );
}

/**
 * A mosque on the skyline, centred on x and standing on the bottom edge:
 * main onion dome, two side domes, two minarets with balconies, crescent
 * finials, lit windows, and lower rooftops trailing off to both sides.
 */
export function Skyline({
  color, windows, x = '50%', y = '100%', scale = 1, glow = false,
}: {
  color: string; windows?: string; x?: string; y?: string; scale?: number; glow?: boolean;
}) {
  const win = (cx: number, cy: number, w = 10, h = 18) => (
    <path
      key={`${cx},${cy}`}
      d={`M${cx - w / 2} ${cy} V${cy - h + w / 2} A${w / 2} ${w / 2} 0 0 1 ${cx + w / 2} ${cy - h + w / 2} V${cy} Z`}
      fill={windows}
      className={glow ? 'wz-anim wz-glow' : undefined}
    />
  );
  const finial = (fx: number, fy: number, s = 1) => (
    <g key={`f${fx}`} transform={`translate(${fx} ${fy}) scale(${s})`}>
      <path d="M0 0 V-18" stroke={color} strokeWidth="2.5" />
      <circle cy="-21" r="3" fill={color} />
      <path d="M-5 -32 A7 7 0 1 0 5 -32 A5.5 5.5 0 1 1 -5 -32 Z" fill={color} />
    </g>
  );
  const minaret = (mx: number) => (
    <g key={`m${mx}`} fill={color}>
      <rect x={mx - 12} y={-330} width={24} height={330} />
      <rect x={mx - 19} y={-250} width={38} height={8} />
      <rect x={mx - 17} y={-185} width={34} height={7} />
      <rect x={mx - 9} y={-372} width={18} height={44} />
      <path d={`M${mx - 13} -372 Q${mx} -420 ${mx + 13} -372 Z`} />
      {finial(mx, -410, 0.8)}
    </g>
  );
  const dome = (dx: number, base: number, w: number, h: number) => (
    <path
      key={`d${dx}`}
      d={`M${dx - w} ${base} C${dx - w * 1.2} ${base - h * 0.65}, ${dx - w * 0.25} ${base - h * 0.8}, ${dx} ${base - h} C${dx + w * 0.25} ${base - h * 0.8}, ${dx + w * 1.2} ${base - h * 0.65}, ${dx + w} ${base} Z`}
      fill={color}
    />
  );
  const rnd = seeded(7);
  const roofs = Array.from({ length: 18 }, (_, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const k = Math.floor(i / 2);
    const cx = side * (360 + k * 90 + rnd() * 30);
    const w = 50 + rnd() * 40;
    const h = 50 + rnd() * 70;
    const domed = rnd() > 0.55;
    return (
      <g key={`r${i}`} fill={color}>
        <rect x={cx - w / 2} y={-h} width={w} height={h} />
        {domed && dome(cx, -h, w * 0.32, w * 0.42)}
        {windows && win(cx, -h * 0.35, 7, 12)}
      </g>
    );
  });
  return (
    <svg x={x} y={y} overflow="visible">
      <g transform={`scale(${scale})`}>
        {roofs}
        <rect x={-1400} y={-30} width={2800} height={40} fill={color} />
        <rect x={-235} y={-120} width={470} height={120} fill={color} />
        <rect x={-95} y={-175} width={190} height={60} fill={color} />
        {dome(0, -172, 100, 150)}
        {finial(0, -318)}
        {dome(-165, -118, 52, 78)}
        {dome(165, -118, 52, 78)}
        {finial(-165, -192, 0.7)}
        {finial(165, -192, 0.7)}
        {minaret(-280)}
        {minaret(280)}
        {windows && [-60, -20, 20, 60].map((wx) => win(wx, -128, 11, 22))}
        {windows && [-200, -150, -100, 100, 150, 200].map((wx) => win(wx, -40, 12, 26))}
        {windows && [-280, 280].map((wx) => win(wx, -280, 7, 14))}
      </g>
    </svg>
  );
}

/** A full-screen SVG wrapper; `children` are the layers, back to front. */
export function Scene({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <svg className={`absolute inset-0 h-full w-full ${className}`} width="100%" height="100%" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
