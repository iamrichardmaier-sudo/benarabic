import type { ReactNode } from 'react';
import type { WaznIconName } from '@/lib/wazn-icons';

/**
 * The deck marks.
 *
 * Drawn for this app rather than borrowed, and drawn by construction rather
 * than by eye: the medallions are {8/3} star polygons, the arches are
 * two-centred, the rosettes are two squares at 45° to each other. That is why
 * they read as one family — they are the same handful of constructions,
 * reused.
 *
 * These are the deck marks and nothing else. The rest of the app keeps its
 * borrowed line icons, which sit better at the sizes those surfaces use; a
 * wider set was tried and reverted in #82/#84, and is in the history if it is
 * ever wanted back.
 *
 * The grid is 48×48, not the 24 that line-icon sets normally use. Ornament
 * needs room: at 24 the interlace closes up into a blot. The consequence is
 * that these want to be shown large, which is a claim on the layouts using
 * them rather than on this file — see how the deck card gives its icon the
 * whole tile.
 *
 * Only geometry lives in the table. Every shared attribute is set once, on
 * the single <svg> below, so no icon can drift out of the family by carrying
 * its own stroke width or colour. Colour is `currentColor`, which is what
 * lets one drawing serve light and dark.
 */

/** The geometry of each mark, on a 48×48 grid. */
const GEOMETRY: Record<WaznIconName, ReactNode> = {
  mihrab: (
    <>
    <path d="M7.00 38.00 L7.00 19.57 A34.00 34.00 0 0 1 24.00 4.50 A34.00 34.00 0 0 1 41.00 19.57 L41.00 38.00" />
    <path d="M13.50 38.00 L13.50 26.75 A21.00 21.00 0 0 1 24.00 15.50 A21.00 21.00 0 0 1 34.50 26.75 L34.50 38.00" />
    <path d="M24.00 7.30 L25.91 11.91 L21.30 10.00 L25.91 8.09 L24.00 12.70 L22.09 8.09 L26.70 10.00 L22.09 11.91 Z" />
    <path d="M12.5 38V26.5" />
    <path d="M12.5 27.0L14.3 28.4L12.5 29.9L10.7 28.4Z M12.5 30.8L14.3 32.2L12.5 33.7L10.7 32.2Z M12.5 34.6L14.3 36.1L12.5 37.5L10.7 36.1Z" />
    <path d="M35.5 38V26.5" />
    <path d="M35.5 27.0L37.3 28.4L35.5 29.9L33.7 28.4Z M35.5 30.8L37.3 32.2L35.5 33.7L33.7 32.2Z M35.5 34.6L37.3 36.1L35.5 37.5L33.7 36.1Z" />
    <path d="M19.7 22.9A4.6 4.6 0 0 1 19.7 31.1" />
    <path d="M20.9 20.6A7.2 7.2 0 0 1 20.9 33.4" />
    <path d="M22.1 18.3A9.8 9.8 0 0 1 22.1 35.7" />
    <path d="M7 38h34v3.5H7z" />
    <path d="M4 41.5h40v3.5H4z" />
    </>
  ),
  foundation: (
    <>
    <path d="M24 8v28" />
    <path d="M18 36h12" />
    <path d="M15 40h18" />
    <path d="M14 40 L18 36 M34 40 L30 36" />
    <circle cx="24" cy="7" r="2.2" />
    <path d="M9 13h30" />
    <path d="M9 13 L4 23 M9 13 L14 23" />
    <path d="M39 13 L34 23 M39 13 L44 23" />
    <path d="M3 23a6 6 0 0 0 12 0z" />
    <path d="M33 23a6 6 0 0 0 12 0z" />
    </>
  ),
  compass: (
    <>
    <circle cx="24" cy="24" r="21" />
    <circle cx="24" cy="24" r="17.5" />
    <path d="M24.00 9.00 L34.61 34.61 L9.00 24.00 L34.61 13.39 L24.00 39.00 L13.39 13.39 L39.00 24.00 L13.39 34.61 Z" />
    <path d="M26.87 17.07 L30.93 21.13 L30.93 26.87 L26.87 30.93 L21.13 30.93 L17.07 26.87 L17.07 21.13 L21.13 17.07 Z" />
    </>
  ),
  scroll: (
    <>
    <path d="M13 8h24a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H11" />
    <path d="M13 8a4 4 0 0 0-4 4v24a4 4 0 0 0 4 4" />
    <path d="M7 12h12M7 36h12" />
    <path d="M18 17h15M18 24h15M18 31h9" />
    </>
  ),
  lantern: (
    <>
    <circle cx="24" cy="5" r="2" />
    <path d="M24 7v3" />
    <path d="M18 14h12l-3-4h-6z" />
    <path d="M30 14l4 6-4 15H18l-4-15 4-6" />
    <path d="M14 20h20" />
    <path d="M14 35h20" />
    <path d="M19 39h10l-2 4h-6z" />
    <path d="M24.00 18.00 L28.95 29.95 L17.00 25.00 L28.95 20.05 L24.00 32.00 L19.05 20.05 L31.00 25.00 L19.05 29.95 Z" />
    </>
  ),
  bridge: (
    <>
    <path d="M9.00 44.00 L9.00 26.90 A30.00 30.00 0 0 1 24.00 6.00 A30.00 30.00 0 0 1 39.00 26.90 L39.00 44.00" />
    <path d="M14.50 44.00 L14.50 29.60 A19.00 19.00 0 0 1 24.00 12.00 A19.00 19.00 0 0 1 33.50 29.60 L33.50 44.00" />
    <path d="M9.90 40.00 L13.10 37.75 L9.90 35.50 L13.10 33.25 L9.90 31.00 L13.10 28.75 L9.90 26.50 L13.10 24.25 L9.90 22.00" />
    <path d="M34.90 40.00 L38.10 37.75 L34.90 35.50 L38.10 33.25 L34.90 31.00 L38.10 28.75 L34.90 26.50 L38.10 24.25 L34.90 22.00" />
    <path d="M4 44h40" />
    </>
  ),
  anchor: (
    <>
    <circle cx="24" cy="9" r="4" />
    <path d="M24 13v29" />
    <path d="M15 20h18" />
    <path d="M8 27a16 16 0 0 0 32 0" />
    <path d="M5 25l3 2 3-2M43 25l-3 2-3-2" />
    <path d="M24.00 7.00 L26.00 9.00 L24.00 11.00 L22.00 9.00 Z" />
    </>
  ),
  feather: (
    <>
    <path d="M41 7C26 9 14 20 9 34l-3 8" />
    <path d="M41 7c1 14-5 24-16 29-5 2-9 2-12 1" />
    <path d="M13 37C18 25 27 15 41 7" />
    <path d="M22 33c-1-4-1-8 0-11M28 29c-2-4-2-9-1-13M34 23c-2-4-3-8-2-12" />
    </>
  ),
  flame: (
    <>
    <path d="M24 4c3 6 10 11 10 19a10 10 0 0 1-20 0c0-6 4-10 7-13 1 3 3 4 5 5 1-4 0-8-2-11z" />
    <path d="M24 26c2 2 4 5 4 8a4 4 0 0 1-8 0c0-3 2-6 4-8z" />
    </>
  ),
  footprints: (
    <>
    <path d="M13 8c4 0 6 3 6 8 0 4-1 6-1 9h-9c0-3-2-5-2-9 0-5 2-8 6-8z" />
    <path d="M9 29h9v5a4.5 4.5 0 0 1-9 0z" />
    <path d="M35 17c4 0 6 3 6 8 0 4-1 6-1 9h-9c0-3-2-5-2-9 0-5 2-8 6-8z" />
    <path d="M31 38h9v3a4.5 4.5 0 0 1-9 0z" />
    </>
  ),
  gem: (
    <>
    <path d="M14 9h20l9 12-19 20L5 21z" />
    <path d="M5 21h38" />
    <path d="M14 9l-4 12 14 20 14-20-4-12" />
    <path d="M24 9v12" />
    <path d="M14 21l10 20 10-20" />
    </>
  ),
  leaf: (
    <>
    <path d="M8 40C8 22 20 8 40 7c1 20-11 32-29 33z" />
    <path d="M8 40L33 14" />
    <path d="M15 33c4-1 8 0 11-2M21 26c3-2 5-4 9-4M27 20c2-3 4-4 7-5" />
    </>
  ),
  lightbulb: (
    <>
    <path d="M24 6a13 13 0 0 0-8 23c1.5 1.4 2 3 2 5h12c0-2 .5-3.6 2-5A13 13 0 0 0 24 6z" />
    <path d="M18 38h12M20 42h8" />
    <path d="M24.00 13.00 L28.24 23.24 L18.00 19.00 L28.24 14.76 L24.00 25.00 L19.76 14.76 L30.00 19.00 L19.76 23.24 Z" />
    </>
  ),
  map: (
    <>
    <path d="M6 12l12-5 12 5 12-5v29l-12 5-12-5-12 5z" />
    <path d="M18 7v29M30 12v29" />
    <path d="M10 18a2.5 2.5 0 1 1 5 0c0 2-2.5 5-2.5 5S10 20 10 18z" />
    <path d="M35 24h5M35 29h4" />
    </>
  ),
  mountain: (
    <>
    <path d="M4 40L17 14l8 15" />
    <path d="M22 40L31 20l13 20z" />
    <path d="M4 40h40" />
    <path d="M13 22l4 3 4-3" />
    <path d="M27 28l4 3 4-3" />
    </>
  ),
  ship: (
    <>
    <path d="M6 35h36l-4 7H10z" />
    <path d="M24 6v29" />
    <path d="M24 10l12 21H24z" />
    <path d="M22 31H12l10-16z" />
    <path d="M4 42c4-2 8-2 12 0s8 2 12 0 8-2 12 0" />
    </>
  ),
  sparkles: (
    <>
    <path d="M24.00 5.00 L26.49 17.99 L37.44 10.56 L30.01 21.51 L43.00 24.00 L30.01 26.49 L37.44 37.44 L26.49 30.01 L24.00 43.00 L21.51 30.01 L10.56 37.44 L17.99 26.49 L5.00 24.00 L17.99 21.51 L10.56 10.56 L21.51 17.99 Z" />
    <path d="M26.49 17.99 L30.01 21.51 L30.01 26.49 L26.49 30.01 L21.51 30.01 L17.99 26.49 L17.99 21.51 L21.51 17.99 Z" />
    </>
  ),
  sprout: (
    <>
    <path d="M24 44V22" />
    <path d="M24 26C17 26 11 21 11 13c8 0 13 5 13 13z" />
    <path d="M24 22c0-9 6-15 15-15 0 9-6 15-15 15z" />
    </>
  ),
  sun: (
    <>
    <circle cx="24" cy="24" r="13" />
    <path d="M24.00 15.00 L30.36 30.36 L15.00 24.00 L30.36 17.64 L24.00 33.00 L17.64 17.64 L33.00 24.00 L17.64 30.36 Z" />
    <path d="M24.0 7.0L24.0 2.0" />
    <path d="M36.0 12.0L39.6 8.4" />
    <path d="M41.0 24.0L46.0 24.0" />
    <path d="M36.0 36.0L39.6 39.6" />
    <path d="M24.0 41.0L24.0 46.0" />
    <path d="M12.0 36.0L8.4 39.6" />
    <path d="M7.0 24.0L2.0 24.0" />
    <path d="M12.0 12.0L8.4 8.4" />
    </>
  ),
  tent: (
    <>
    <path d="M4 40h40" />
    <path d="M24 7L6 40M24 7l18 33" />
    <path d="M24 7v33" />
    <path d="M16 40l8-15 8 15" />
    <path d="M9.78 39.31 L13.72 38.02 L12.78 33.98 L16.72 32.69 L15.78 28.65 L19.72 27.35 L18.78 23.31" />
    <path d="M35.78 40.69 L36.72 36.65 L32.78 35.35 L33.72 31.31 L29.78 30.02 L30.72 25.98 L26.78 24.69" />
    </>
  ),
  waves: (
    <>
    <path d="M4 15c4-4 8-4 12 0s8 4 12 0 8-4 12 0" />
    <path d="M4 24c4-4 8-4 12 0s8 4 12 0 8-4 12 0" />
    <path d="M4 33c4-4 8-4 12 0s8 4 12 0 8-4 12 0" />
    </>
  ),
  wheat: (
    <>
    <path d="M24 44V9" />
    <path d="M24 12c-3 1-4 3-4 5 3 0 4-2 4-5z" />
    <path d="M24 12c3 1 4 3 4 5-3 0-4-2-4-5z" />
    <path d="M24 19c-5-1-7-4-7-7 4 0 7 3 7 7z" />
    <path d="M24 19c5-1 7-4 7-7-4 0-7 3-7 7z" />
    <path d="M24 26c-5-1-7-4-7-7 4 0 7 3 7 7z" />
    <path d="M24 26c5-1 7-4 7-7-4 0-7 3-7 7z" />
    <path d="M24 33c-5-1-7-4-7-7 4 0 7 3 7 7z" />
    <path d="M24 33c5-1 7-4 7-7-4 0-7 3-7 7z" />
    <path d="M24 40c-5-1-7-4-7-7 4 0 7 3 7 7z" />
    <path d="M24 40c5-1 7-4 7-7-4 0-7 3-7 7z" />
    </>
  ),
  book: (
    <>
    <path d="M24 13v26" />
    <path d="M24 13C19 9 12 8 5 9v25c7-1 14 0 19 5" />
    <path d="M24 13c5-4 12-5 19-4v25c-7-1-14 0-19 5" />
    <path d="M9 16h10M9 21h10M9 26h10" />
    <path d="M29 16h10M29 21h10M29 26h10" />
    </>
  ),
  key: (
    <>
    <circle cx="9.5" cy="18.5" r="4.2" />
    <circle cx="9.5" cy="29.5" r="4.2" />
    <circle cx="18" cy="24" r="4.2" />
    <path d="M22 24h21" />
    <path d="M34 24v6" />
    <path d="M39.5 24v4" />
    </>
  ),
};

interface WaznIconProps {
  name: WaznIconName;
  /** Pixel size of the square the icon is drawn in. */
  size?: number;
  /**
   * Stroke weight, in grid units. The default suits 28px and up; a smaller
   * rendering wants a proportionally heavier stroke or the ornament fades.
   */
  strokeWidth?: number;
  className?: string;
}

const WaznIcon = ({ name, size = 28, strokeWidth, className = '' }: WaznIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth ?? (size < 26 ? 2.8 : 2.2)}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={`shrink-0 ${className}`}
  >
    {GEOMETRY[name]}
  </svg>
);

export default WaznIcon;
