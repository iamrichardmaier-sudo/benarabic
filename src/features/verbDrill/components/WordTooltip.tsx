import { ARABIC_GLOSSARY } from "../data/translations";

interface WordTooltipProps {
  word: string;
  children?: React.ReactNode;
}

const WordTooltip = ({ word }: WordTooltipProps) => {
  const gloss = ARABIC_GLOSSARY[word];

  if (!gloss) {
    return <span className="inline-block">{word}</span>;
  }

  return (
    <span className="relative group inline-block cursor-help">
      <span className="border-b border-dotted border-muted-foreground/40">{word}</span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs rounded bg-popover text-popover-foreground border border-border shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap pointer-events-none z-50">
        {gloss}
      </span>
    </span>
  );
};

export default WordTooltip;
