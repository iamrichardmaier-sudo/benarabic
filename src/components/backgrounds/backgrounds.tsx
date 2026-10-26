/**
 * The fifteen level backgrounds, one unlocked per level, each richer than the
 * last: from plain parchment through geometric tiling (khatam, girih,
 * zellige) and arabesque, to lanterns, arches and mosque skylines, ending in
 * an animated night scene.
 *
 * "light" backgrounds are faint patterns drawn in the theme's own colours, so
 * they follow the light/dark setting and never compete with the text. "dark"
 * backgrounds are full scenes; while one is in use the app switches to its
 * dark palette and lets the art show through its cards (see AppBackground).
 */
import { useId, type ComponentType } from 'react';
import { Crescent, Lantern, Octagram, Scene, Skyline, StarField, starPoints } from './art';

export interface BackgroundProps {
  /** No animation (thumbnails, reduced motion). */
  still?: boolean;
}

export interface BackgroundDef {
  id: string;
  level: number;
  name: string;
  arabic: string;
  blurb: string;
  tone: 'light' | 'dark';
  Art: ComponentType<BackgroundProps> | null;
}

const LINE = 'hsl(var(--primary))';
const GOLD = '#d4af37';

const uid = (raw: string) => raw.replace(/[^a-zA-Z0-9_-]/g, '');

// ------------------------------------------------------------ 2. star lattice
function StarLattice() {
  const id = uid(useId());
  return (
    <Scene>
      <defs>
        <pattern id={id} width="72" height="72" patternUnits="userSpaceOnUse">
          <Octagram cx={36} cy={36} r={9} fill="none" stroke={LINE} strokeWidth="1.2" />
          <circle cx="0" cy="0" r="1.6" fill={LINE} />
          <circle cx="72" cy="0" r="1.6" fill={LINE} />
          <circle cx="0" cy="72" r="1.6" fill={LINE} />
          <circle cx="72" cy="72" r="1.6" fill={LINE} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity="0.16" />
    </Scene>
  );
}

// ---------------------------------------------------------------- 3. trellis
function Trellis() {
  const id = uid(useId());
  return (
    <Scene>
      <defs>
        <pattern id={id} width="56" height="56" patternUnits="userSpaceOnUse">
          <path
            d="M0 28 C14 28 14 0 28 0 C42 0 42 28 56 28 M0 28 C14 28 14 56 28 56 C42 56 42 28 56 28"
            fill="none" stroke={LINE} strokeWidth="1.4"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity="0.15" />
    </Scene>
  );
}

// ---------------------------------------------------------- 4. hexagon garden
function HexGarden() {
  const id = uid(useId());
  const h = 103.92;
  const hexagram = (x: number, y: number) => (
    <g key={`${x},${y}`}>
      <polygon points={starPoints(x, y, 6, 15, 8.7)} fill={LINE} fillOpacity="0.25" />
      <polygon points={starPoints(x, y, 6, 30, 26, 0)} fill="none" />
    </g>
  );
  return (
    <Scene>
      <defs>
        <pattern id={id} width="60" height={h} patternUnits="userSpaceOnUse">
          <g stroke={LINE} strokeWidth="1.2" fill="none">
            {[[0, 0], [60, 0], [30, h / 2], [0, h], [60, h]].map(([x, y]) => hexagram(x, y))}
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity="0.17" />
    </Scene>
  );
}

// ------------------------------------------------------------------ 5. khatam
function Khatam() {
  const id = uid(useId());
  return (
    <Scene>
      <defs>
        <pattern id={id} width="80" height="80" patternUnits="userSpaceOnUse">
          <g stroke={LINE} strokeWidth="1.3" fill={LINE} fillOpacity="0.07">
            {[[40, 40], [0, 0], [80, 0], [0, 80], [80, 80]].map(([x, y]) => (
              <Octagram key={`${x},${y}`} cx={x} cy={y} r={24} />
            ))}
          </g>
          <g stroke={LINE} strokeWidth="1" fill="none">
            {[[40, 0], [0, 40], [80, 40], [40, 80]].map(([x, y]) => (
              <polygon key={`${x},${y}`} points={starPoints(x, y, 4, 9, 4, 0)} />
            ))}
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity="0.2" />
    </Scene>
  );
}

// ----------------------------------------------------------------- 6. zellige
function Zellige() {
  const id = uid(useId());
  return (
    <Scene>
      <defs>
        <pattern id={id} width="64" height="64" patternUnits="userSpaceOnUse">
          <rect width="64" height="64" fill="#e9c46a" fillOpacity="0.05" />
          <Octagram cx={32} cy={32} r={20} fill="#1f7a74" fillOpacity="0.2" stroke="#1f7a74" strokeOpacity="0.35" strokeWidth="1" />
          <polygon points={starPoints(32, 32, 8, 9, 5)} fill="#c2622a" fillOpacity="0.32" />
          {[[0, 0], [64, 0], [0, 64], [64, 64]].map(([x, y]) => (
            <polygon key={`${x},${y}`} points={starPoints(x, y, 4, 11, 4.5, 0)} fill="#e9c46a" fillOpacity="0.35" />
          ))}
          <path d="M0 32 H12 M52 32 H64 M32 0 V12 M32 52 V64" stroke="#1f7a74" strokeOpacity="0.3" strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </Scene>
  );
}

// -------------------------------------------------------------- 7. arabesque
function Arabesque() {
  const id = uid(useId());
  const leaf = (x: number, y: number, rot: number) => (
    <path
      key={`${x},${y},${rot}`}
      d="M0 0 C6 -10 18 -10 22 0 C18 10 6 10 0 0 Z"
      transform={`translate(${x} ${y}) rotate(${rot})`}
      fill={LINE} fillOpacity="0.35"
    />
  );
  return (
    <Scene>
      <defs>
        <pattern id={id} width="140" height="140" patternUnits="userSpaceOnUse">
          <g fill="none" stroke={LINE} strokeWidth="1.5" strokeLinecap="round">
            <path d="M0 70 C35 18 105 122 140 70" />
            <path d="M70 0 C18 35 122 105 70 140" />
            <path d="M35 44 c-12 -4 -14 -18 -4 -22 c8 -3 14 6 8 11" />
            <path d="M105 96 c12 4 14 18 4 22 c-8 3 -14 -6 -8 -11" />
            <path d="M96 35 c4 -12 18 -14 22 -4 c3 8 -6 14 -11 8" />
            <path d="M44 105 c-4 12 -18 14 -22 4 c-3 -8 6 -14 11 -8" />
          </g>
          {leaf(20, 52, -40)}
          {leaf(118, 88, 140)}
          {leaf(88, 22, 50)}
          {leaf(52, 118, -130)}
          <circle cx="70" cy="70" r="4" fill={LINE} fillOpacity="0.4" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity="0.4" />
    </Scene>
  );
}

// ---------------------------------------------------------- 8. arches at dusk
function ArchesAtDusk() {
  const id = uid(useId());
  return (
    <Scene>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f2a65a" stopOpacity="0.35" />
          <stop offset="45%" stopColor="#f2a65a" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#f2a65a" stopOpacity="0" />
        </linearGradient>
        <pattern id={`${id}-arch`} width="150" height="230" patternUnits="userSpaceOnUse">
          <path d="M0 0 H150 V230 H0 Z M22 230 V118 C22 70 52 48 75 48 C98 48 128 70 128 118 V230 Z" fillRule="evenodd" fill={LINE} fillOpacity="0.16" />
          <path d="M22 230 V118 C22 70 52 48 75 48 C98 48 128 70 128 118 V230" fill="none" stroke={LINE} strokeOpacity="0.35" strokeWidth="2" />
          <path d="M60 30 L75 14 L90 30" fill="none" stroke={LINE} strokeOpacity="0.3" />
        </pattern>
        <pattern id={`${id}-stars`} width="72" height="72" patternUnits="userSpaceOnUse">
          <Octagram cx={36} cy={36} r={7} fill="none" stroke={LINE} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-sky)`} />
      <rect y="230" width="100%" height="100%" fill={`url(#${id}-stars)`} opacity="0.12" />
      <rect width="100%" height="230" fill={`url(#${id}-arch)`} />
    </Scene>
  );
}

// ----------------------------------------------------------- 9. lantern glow
function LanternGlow() {
  const id = uid(useId());
  // On a phone the left half is where the page title sits, so only the
  // right-hand lanterns hang there; wider screens get the full row.
  const lanterns: [string, number, number, string][] = [
    ['9%', 90, 0.8, 'max-sm:hidden'], ['27%', 150, 1, 'max-sm:hidden'], ['50%', 70, 1.15, 'max-sm:hidden'],
    ['62%', 40, 0.75, 'sm:hidden'], ['73%', 135, 0.95, ''], ['91%', 95, 0.8, ''],
  ];
  return (
    <Scene>
      <defs>
        <linearGradient id={`${id}-warm`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4c56b" stopOpacity="0.28" />
          <stop offset="60%" stopColor="#f4c56b" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#f4c56b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-warm)`} />
      {lanterns.map(([x, len, s, cls], i) => (
        <g key={x} className={cls}><Lantern id={`${id}-l${i}`} x={x} length={len} scale={s} /></g>
      ))}
    </Scene>
  );
}

// ----------------------------------------------------------- 10. starry night
function StarryNight({ still }: BackgroundProps) {
  const id = uid(useId());
  return (
    <Scene>
      <defs>
        <radialGradient id={`${id}-sky`} cx="70%" cy="10%" r="110%">
          <stop offset="0%" stopColor="#26306b" />
          <stop offset="55%" stopColor="#141a3f" />
          <stop offset="100%" stopColor="#0a0d24" />
        </radialGradient>
        <pattern id={`${id}-p`} width="90" height="90" patternUnits="userSpaceOnUse">
          <Octagram cx={45} cy={45} r={10} fill="none" stroke={GOLD} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-sky)`} />
      <rect width="100%" height="100%" fill={`url(#${id}-p)`} opacity="0.06" />
      <StarField count={110} seed={10} depth={0.95} twinkle={!still} />
      <Crescent id={`${id}-moon`} x="82%" y="12%" r={30} />
    </Scene>
  );
}

// ----------------------------------------------------------- 11. desert mosque
function DesertMosque() {
  const id = uid(useId());
  return (
    <Scene>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#120c2c" />
          <stop offset="45%" stopColor="#3b1f55" />
          <stop offset="75%" stopColor="#8a3f5c" />
          <stop offset="100%" stopColor="#e2794b" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-sky)`} />
      <StarField count={70} seed={11} depth={0.45} />
      <Crescent id={`${id}-moon`} x="86%" y="8%" r={24} color="#ffe9b0" />
      <svg x="50%" y="100%" overflow="visible">
        <path d="M-1600 -40 C-1100 -150 -700 -60 -300 -110 C100 -160 500 -50 900 -120 C1200 -170 1450 -90 1600 -110 V0 H-1600 Z" fill="#5a2a3e" opacity="0.8" />
      </svg>
      <Skyline color="#1d0f24" windows="#ffc56a" y="100%" scale={0.82} />
      <svg x="50%" y="100%" overflow="visible">
        <path d="M-1600 -10 C-900 -70 -400 -20 0 -45 C450 -70 900 -15 1600 -40 V0 H-1600 Z" fill="#140a19" />
      </svg>
    </Scene>
  );
}

// -------------------------------------------------------------- 12. gold girih
function GoldGirih() {
  const id = uid(useId());
  const motif = (
    <>
      <polygon points={starPoints(60, 60, 8, 34, 18)} />
      <polygon points={starPoints(60, 60, 8, 18, 12, -67.5)} />
      {[[0, 0], [120, 0], [0, 120], [120, 120]].map(([x, y]) => (
        <polygon key={`${x},${y}`} points={starPoints(x, y, 8, 34, 18)} />
      ))}
      <path d="M60 26 L60 0 M60 94 L60 120 M26 60 L0 60 M94 60 L120 60" />
    </>
  );
  return (
    <Scene>
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="35%" r="90%">
          <stop offset="0%" stopColor="#11454a" />
          <stop offset="100%" stopColor="#061b1e" />
        </radialGradient>
        <pattern id={`${id}-p`} width="120" height="120" patternUnits="userSpaceOnUse">
          <g fill="none" stroke={GOLD} strokeOpacity="0.18" strokeWidth="5">{motif}</g>
          <g fill="none" stroke={GOLD} strokeOpacity="0.75" strokeWidth="1.3">{motif}</g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-bg)`} />
      <rect width="100%" height="100%" fill={`url(#${id}-p)`} opacity="0.55" />
    </Scene>
  );
}

// ----------------------------------------------------- 13. alhambra courtyard
function AlhambraCourtyard({ still }: BackgroundProps) {
  const id = uid(useId());
  // A wall with arched openings cut through it, so the night shows through
  // each arch; the piers between openings are what is left of the wall.
  const xs = Array.from({ length: 38 }, (_, i) => -1710 + i * 90);
  const opening = (x: number) =>
    `M${x + 7} 0 V-285 C${x + 7} -335 ${x + 27} -360 ${x + 45} -376 C${x + 63} -360 ${x + 83} -335 ${x + 83} -285 V0 Z`;
  const wall = `M-1750 -450 H1750 V0 H-1750 Z ${xs.map(opening).join(' ')}`;
  const colonnade = (
    <>
      <path d={wall} fillRule="evenodd" fill="#0d1636" />
      <path d={xs.map(opening).join(' ')} fill="none" stroke={GOLD} strokeOpacity="0.45" strokeWidth="1.6" />
      <path d={xs.map((x) => `M${x - 2} -285 h18 v8 h-18 Z`).join(' ')} fill={GOLD} fillOpacity="0.35" />
      <path
        d={`M-1750 -412 ${xs.map((x) => `L${x + 22} -412 L${x + 45} -428 L${x + 68} -412`).join(' ')} L1750 -412`}
        fill="none" stroke={GOLD} strokeOpacity="0.5" strokeWidth="1.4"
      />
      <path d="M-1750 -446 H1750 M-1750 -398 H1750" stroke={GOLD} strokeOpacity="0.3" strokeWidth="1" />
    </>
  );
  return (
    <Scene>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b1430" />
          <stop offset="70%" stopColor="#22336b" />
          <stop offset="100%" stopColor="#0b1430" />
        </linearGradient>
        <linearGradient id={`${id}-pool`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a4a8a" />
          <stop offset="100%" stopColor="#0b1430" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-sky)`} />
      <StarField count={90} seed={13} depth={0.7} twinkle={!still} />
      <Crescent id={`${id}-moon`} x="76%" y="11%" r={26} />
      <svg x="50%" y="82%" overflow="visible">{colonnade}</svg>
      <rect y="82%" width="100%" height="18%" fill={`url(#${id}-pool)`} />
      <svg x="50%" y="82%" overflow="visible">
        {/* The reflection: flipped by the outer group, rippled by the inner
            one (a CSS animation would replace a transform on the same element). */}
        <g transform="scale(1 -0.6)" opacity="0.3">
          <g className={still ? undefined : 'wz-anim wz-ripple'}>{colonnade}</g>
        </g>
      </svg>
    </Scene>
  );
}

// ---------------------------------------------------------- 14. lantern night
function LanternNight({ still }: BackgroundProps) {
  const id = uid(useId());
  const lanterns: [string, number, number, string][] = [
    ['6%', 70, 0.7, 'max-sm:hidden'], ['17%', 170, 0.9, 'max-sm:hidden'], ['29%', 95, 0.75, 'max-sm:hidden'],
    ['41%', 210, 1.05, 'max-sm:hidden'], ['53%', 60, 0.85, ''], ['64%', 160, 1, ''], ['76%', 100, 0.8, ''],
    ['87%', 200, 0.95, ''], ['96%', 80, 0.7, ''],
  ];
  return (
    <Scene>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a0f3a" />
          <stop offset="60%" stopColor="#2b1650" />
          <stop offset="100%" stopColor="#120a28" />
        </linearGradient>
        <pattern id={`${id}-p`} width="110" height="110" patternUnits="userSpaceOnUse">
          <polygon points={starPoints(55, 55, 8, 16, 8)} fill="none" stroke={GOLD} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-sky)`} />
      <rect width="100%" height="100%" fill={`url(#${id}-p)`} opacity="0.07" />
      <StarField count={120} seed={14} depth={1} twinkle={!still} />
      <Crescent id={`${id}-moon`} x="50%" y="88%" r={22} color="#ffe2a0" />
      {lanterns.map(([x, len, s, cls], i) => (
        <g key={x} className={cls}>
          <Lantern id={`${id}-l${i}`} x={x} length={len} scale={s} sway={!still} delay={-i * 0.7} light="#ffcf6e" />
        </g>
      ))}
    </Scene>
  );
}

// -------------------------------------------------------- 15. celestial dome
function CelestialDome({ still }: BackgroundProps) {
  const id = uid(useId());
  const anim = (cls: string) => (still ? undefined : `wz-anim ${cls}`);
  return (
    <Scene>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#070a1f" />
          <stop offset="55%" stopColor="#1b1446" />
          <stop offset="85%" stopColor="#3a1d52" />
          <stop offset="100%" stopColor="#5e2a4e" />
        </linearGradient>
        <radialGradient id={`${id}-aura`}>
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.28" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-shimmer`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="50%" stopColor="#fff6d0" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-sky)`} />
      <StarField count={150} seed={15} depth={0.85} twinkle={!still} />
      <Crescent id={`${id}-moon`} x="88%" y="6%" r={26} color="#fff1c4" />

      {/* The rosette: a sixteen-pointed star in rings, turning slowly. */}
      <svg x="50%" y="30%" overflow="visible">
        <circle r="330" fill={`url(#${id}-aura)`} />
        <g className={anim('wz-spin')} style={{ transformOrigin: '0px 0px' }}>
          <g fill="none" stroke={GOLD} strokeWidth="1.4" strokeOpacity="0.75">
            <polygon points={starPoints(0, 0, 16, 230, 150)} />
            <polygon points={starPoints(0, 0, 16, 150, 110, -78.75)} />
            <circle r="236" strokeOpacity="0.45" />
            {Array.from({ length: 16 }, (_, i) => (
              <line key={i} x1="0" y1="-108" x2="0" y2="-150" transform={`rotate(${i * 22.5})`} />
            ))}
          </g>
        </g>
        <g className={anim('wz-spin-rev')} style={{ transformOrigin: '0px 0px' }}>
          <g fill="none" stroke={GOLD} strokeWidth="1.2" strokeOpacity="0.6">
            <polygon points={starPoints(0, 0, 8, 100, 62)} />
            <polygon points={starPoints(0, 0, 8, 62, 40, -67.5)} />
            <circle r="290" strokeDasharray="2 10" strokeOpacity="0.5" />
          </g>
        </g>
        <polygon points={starPoints(0, 0, 8, 30, 15)} fill={GOLD} fillOpacity="0.85" />
      </svg>

      {/* An occasional shooting star. */}
      {!still && (
        <svg x="72%" y="6%" overflow="visible">
          <g className="wz-anim wz-shoot">
            <path d="M0 0 L-140 70" stroke="#fff8e0" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.85" />
          </g>
        </svg>
      )}

      <Skyline color="#0a0717" windows="#ffd27a" glow={!still} y="100%" scale={0.95} />
      {!still && (
        <svg x="50%" y="100%" overflow="visible">
          <rect className="wz-anim wz-sweep" x="-160" y="-330" width="90" height="190" fill={`url(#${id}-shimmer)`} opacity="0.4" />
        </svg>
      )}
    </Scene>
  );
}

export const BACKGROUNDS: BackgroundDef[] = [
  { id: 'parchment', level: 1, name: 'Parchment', arabic: 'رَقّ', blurb: 'Plain and quiet, for reading.', tone: 'light', Art: null },
  { id: 'star-lattice', level: 2, name: 'Star Lattice', arabic: 'نُجُوم', blurb: 'A faint grid of eight-pointed stars.', tone: 'light', Art: StarLattice },
  { id: 'trellis', level: 3, name: 'Moroccan Trellis', arabic: 'شَبَكَة', blurb: 'The interlocking lantern shapes of a Fez screen.', tone: 'light', Art: Trellis },
  { id: 'hex-garden', level: 4, name: 'Hexagon Garden', arabic: 'سُدَاسِيّ', blurb: 'Six-pointed stars set in a honeycomb.', tone: 'light', Art: HexGarden },
  { id: 'khatam', level: 5, name: 'Khatam', arabic: 'خَاتَم', blurb: 'The classic star-and-cross tiling.', tone: 'light', Art: Khatam },
  { id: 'zellige', level: 6, name: 'Zellige', arabic: 'زَلِّيج', blurb: 'Teal, terracotta and saffron tilework.', tone: 'light', Art: Zellige },
  { id: 'arabesque', level: 7, name: 'Arabesque', arabic: 'تَوْرِيق', blurb: 'Endless vine scrolls and leaves.', tone: 'light', Art: Arabesque },
  { id: 'arches-dusk', level: 8, name: 'Arches at Dusk', arabic: 'أَقْوَاس', blurb: 'A horseshoe arcade in evening light.', tone: 'light', Art: ArchesAtDusk },
  { id: 'lantern-glow', level: 9, name: 'Lantern Glow', arabic: 'فَوَانِيس', blurb: 'Brass lanterns hung across the top.', tone: 'light', Art: LanternGlow },
  { id: 'starry-night', level: 10, name: 'Starry Night', arabic: 'لَيْل', blurb: 'An indigo sky and a new crescent.', tone: 'dark', Art: StarryNight },
  { id: 'desert-mosque', level: 11, name: 'Desert Mosque', arabic: 'مَسْجِد', blurb: 'Domes and minarets against a desert sunset.', tone: 'dark', Art: DesertMosque },
  { id: 'gold-girih', level: 12, name: 'Gold Girih', arabic: 'عُقْدَة ذَهَبِيَّة', blurb: 'Gilded star tiling on deep teal.', tone: 'dark', Art: GoldGirih },
  { id: 'alhambra', level: 13, name: 'Alhambra Courtyard', arabic: 'الحَمْرَاء', blurb: 'A moonlit colonnade over still water.', tone: 'dark', Art: AlhambraCourtyard },
  { id: 'lantern-night', level: 14, name: 'Night of Lanterns', arabic: 'لَيْلَة الفَوَانِيس', blurb: 'Lanterns swaying under a sky of stars.', tone: 'dark', Art: LanternNight },
  { id: 'celestial-dome', level: 15, name: 'Celestial Dome', arabic: 'القُبَّة السَّمَاوِيَّة', blurb: 'A turning golden rosette above the city. The last one.', tone: 'dark', Art: CelestialDome },
];

export function backgroundById(id: string | null | undefined): BackgroundDef {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
}

/** Backgrounds unlocked at a level, newest last. */
export function unlockedAt(level: number): BackgroundDef[] {
  return BACKGROUNDS.filter((b) => b.level <= level);
}
