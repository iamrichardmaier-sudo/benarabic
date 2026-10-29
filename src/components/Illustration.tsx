import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The app's hand-printed illustrations (public/illustrations): one
 * risograph-style series in the app's own palette, used only where a picture
 * does a job — the welcome screen, the Library's two shelves, the end of a
 * session and an empty deck. Decorative: the words beside each one carry the
 * meaning, so it is hidden from screen readers, and it simply disappears if
 * it cannot load (offline before it was ever fetched).
 */
export type IllustrationName = 'courtyard' | 'bible' | 'articles' | 'review-done' | 'learn-done' | 'empty-deck';

const SIZE: Record<IllustrationName, [number, number]> = {
  courtyard: [1200, 884],
  bible: [480, 480],
  articles: [480, 480],
  'review-done': [480, 480],
  'learn-done': [480, 480],
  'empty-deck': [480, 480],
};

interface IllustrationProps {
  name: IllustrationName;
  className?: string;
  /** Load straight away rather than when scrolled near, for art above the fold. */
  eager?: boolean;
}

const Illustration = ({ name, className, eager = false }: IllustrationProps) => {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const [width, height] = SIZE[name];
  return (
    <img
      src={`${import.meta.env.BASE_URL}illustrations/${name}.webp`}
      alt=""
      aria-hidden="true"
      width={width}
      height={height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      data-illustration={name}
      className={cn('select-none', className)}
      draggable={false}
    />
  );
};

export default Illustration;
