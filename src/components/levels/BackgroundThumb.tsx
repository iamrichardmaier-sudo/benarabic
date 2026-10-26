import { Lock } from 'lucide-react';
import type { BackgroundDef } from '@/components/backgrounds/backgrounds';

interface BackgroundThumbProps {
  bg: BackgroundDef;
  locked?: boolean;
  className?: string;
}

/** A still miniature of a background, as it looks behind the app. */
const BackgroundThumb = ({ bg, locked = false, className = '' }: BackgroundThumbProps) => {
  const Art = bg.Art;
  return (
    // A night scene is previewed in the dark palette it switches the app to.
    <div className={`relative overflow-hidden bg-background ${bg.tone === 'dark' ? 'dark' : ''} ${className}`}>
      {/* Drawn at three times the size and shrunk, so the preview shows the
          pattern at the density it has behind the app, not one tile of it. */}
      {Art && (
        <div className="absolute left-0 top-0 h-[300%] w-[300%] origin-top-left scale-[0.3334]">
          <Art still />
        </div>
      )}
      {/* A hint of the app on top, so the preview reads as a background. */}
      <div className="absolute inset-x-[12%] top-[22%] h-[14%] rounded-md bg-card/90 border border-border/60" />
      <div className="absolute inset-x-[12%] top-[40%] h-[22%] rounded-md bg-card/90 border border-border/60" />
      {locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/70 text-foreground backdrop-blur-[2px]">
          <Lock className="h-4 w-4" />
          <span className="text-[11px] font-semibold">Level {bg.level}</span>
        </div>
      )}
    </div>
  );
};

export default BackgroundThumb;
