import { tokenize } from '@/lib/transcript-mask';
import { lookupKey } from '@/lib/bible-words';
import BibleWordPopover from '@/components/BibleWordPopover';
import type { BibleWordTag } from '@/hooks/useBibleWordTags';

interface ArabicWithTagsProps {
  text: string;
  tags: Map<string, BibleWordTag>;
}

/**
 * Renders Arabic word by word: tagged words get a hover/tap popover with root,
 * lemma and gloss; whitespace and untagged words render as plain text, so a
 * partially-tagged chapter degrades gracefully rather than looking broken.
 */
const ArabicWithTags = ({ text, tags }: ArabicWithTagsProps) => (
  <>
    {tokenize(text).map((token, i) => {
      if (!token.isWord) return <span key={i}>{token.text}</span>;
      const tag = tags.get(lookupKey(token.text));
      if (!tag) return <span key={i}>{token.text}</span>;
      return <BibleWordPopover key={i} text={token.text} tag={tag} />;
    })}
  </>
);

export default ArabicWithTags;
