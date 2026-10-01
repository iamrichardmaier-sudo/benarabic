import { tokenize } from '@/lib/transcript-mask';
import { lookupKey } from '@/lib/bible-words';
import BibleWordPopover from '@/components/BibleWordPopover';
import UntaggedWordPopover from '@/components/UntaggedWordPopover';
import type { BibleWordTag } from '@/hooks/useBibleWordTags';

interface ArabicWithTagsProps {
  text: string;
  tags: Map<string, BibleWordTag>;
}

/**
 * Renders Arabic word by word: every word is tappable. A tagged word opens a
 * popover with root, lemma and gloss; an untagged word opens one that says so
 * — the same response Arabic in the Wild gives a word it has no data for,
 * rather than going silent on a tap the way this reader used to.
 */
const ArabicWithTags = ({ text, tags }: ArabicWithTagsProps) => (
  <>
    {tokenize(text).map((token, i) => {
      if (!token.isWord) return <span key={i}>{token.text}</span>;
      const tag = tags.get(lookupKey(token.text));
      if (!tag) return <UntaggedWordPopover key={i} text={token.text} />;
      return <BibleWordPopover key={i} text={token.text} tag={tag} />;
    })}
  </>
);

export default ArabicWithTags;
