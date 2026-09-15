import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const lookupMock = vi.fn();
// Only the shared-index lookup is stubbed. skeletonOf is the real thing: it is
// the key both the stored tags and the index are written under, so a stub of
// it would hide exactly the kind of mismatch this file is here to catch.
vi.mock('@/hooks/useWordSkeletonIndex', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useWordSkeletonIndex')>();
  return {
    ...actual,
    useWordSkeletonIndex: () => ({ ready: true, error: null, lookup: lookupMock }),
  };
});

const invokeMock = vi.fn();
// Saving to the library needs the signed-in reader and their private_texts
// rows, so the mock has to cover auth and a table read as well as functions.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ order: async () => ({ data: [], error: null }) }),
      }),
    }),
  },
}));

import ArabicInTheWild from './ArabicInTheWild';
import { skeletonOf } from '@/hooks/useWordSkeletonIndex';
import type { LibraryText } from '@/hooks/useLibraryTexts';

beforeEach(() => {
  lookupMock.mockReset();
  lookupMock.mockReturnValue(null);
  invokeMock.mockReset();
});

describe('ArabicInTheWild', () => {
  it('shows pasted text with a hoverable word for a recognized skeleton, plain text otherwise', async () => {
    lookupMock.mockImplementation((word: string) =>
      word === 'قال' ? [{ root: 'ق-و-ل', lemma: 'قَالَ', pos: 'verb', verbForm: 'I', gloss: 'he said' }] : null,
    );
    const user = userEvent.setup();
    render(<ArabicInTheWild />);

    await user.type(screen.getByPlaceholderText('Paste the article text here…'), 'قال الرجل شيئا');
    await user.click(screen.getByRole('button', { name: 'Show with translations' }));

    expect(screen.getByRole('button', { name: /قال/ })).toBeInTheDocument();
    expect(screen.getByText('الرجل')).toBeInTheDocument();
  });

  it('shows a popover with every candidate reading for an ambiguous word', async () => {
    lookupMock.mockReturnValue([
      { root: 'ع-ل-م', lemma: 'عَلِمَ', pos: 'verb', verbForm: 'I', gloss: 'he knew' },
      { root: 'ع-ل-م', lemma: 'عِلْم', pos: 'noun', verbForm: null, gloss: 'knowledge' },
    ]);
    const user = userEvent.setup();
    render(<ArabicInTheWild />);

    await user.type(screen.getByPlaceholderText('Paste the article text here…'), 'علم');
    await user.click(screen.getByRole('button', { name: 'Show with translations' }));

    await user.click(screen.getByRole('button', { name: /علم/ }));
    expect(await screen.findByText('he knew')).toBeInTheDocument();
    expect(screen.getByText('knowledge')).toBeInTheDocument();
  });

  it('fetches article text from a URL into the paste box', async () => {
    invokeMock.mockResolvedValue({ data: { title: 'عنوان', content: 'نص المقال' }, error: null });
    const user = userEvent.setup();
    render(<ArabicInTheWild />);

    await user.type(screen.getByPlaceholderText(/bbc\.com/), 'https://www.bbc.com/arabic/articles/xyz');
    await user.click(screen.getByRole('button', { name: /Fetch/ }));

    expect(invokeMock).toHaveBeenCalledWith('fetch-article', {
      body: { url: 'https://www.bbc.com/arabic/articles/xyz' },
    });
    expect(await screen.findByDisplayValue('عنوان')).toBeInTheDocument();
    expect(screen.getByDisplayValue('نص المقال')).toBeInTheDocument();
  });

  it('shows a fetch error but leaves the paste box usable', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'network down' } });
    const user = userEvent.setup();
    render(<ArabicInTheWild />);

    await user.type(screen.getByPlaceholderText(/bbc\.com/), 'https://example.com/a');
    await user.click(screen.getByRole('button', { name: /Fetch/ }));

    expect(await screen.findByText(/network down/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Paste the article text here…')).toBeEnabled();
  });

  it('returns to the editor from the reading view', async () => {
    lookupMock.mockReturnValue(null);
    const user = userEvent.setup();
    render(<ArabicInTheWild />);

    await user.type(screen.getByPlaceholderText('Paste the article text here…'), 'نص');
    await user.click(screen.getByRole('button', { name: 'Show with translations' }));
    expect(screen.queryByRole('button', { name: 'Show with translations' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Back to Edit text/ }));
    expect(screen.getByRole('button', { name: 'Show with translations' })).toBeInTheDocument();
  });
});

/** A saved entry, as the library hands one over. */
function entry(over: Partial<LibraryText> = {}): LibraryText {
  return {
    id: 'e1',
    title: 'نص',
    body: 'بَعيد برة',
    coverUrl: null,
    updatedAt: '2026-09-15',
    wordTags: {},
    ...over,
  };
}

describe('a saved entry', () => {
  it('shows a word from its own tags, which are keyed by skeleton', async () => {
    // The regression this exists for: the tags are written under a consonant
    // skeleton, and were being read back under the bare word. Every lookup
    // missed, so a fully tagged text hovered as though nothing was tagged.
    const user = userEvent.setup();
    lookupMock.mockReturnValue(null); // nothing from the shared index
    render(
      <ArabicInTheWild
        onBack={() => {}}
        entry={entry({
          wordTags: {
            [skeletonOf('بعيد')]: [
              { lemma: 'بَعيد', gloss: 'far away', root: 'ب-ع-د', pos: 'adjective', verbForm: null },
            ],
          },
        })}
      />,
    );

    await user.hover(screen.getByRole('button', { name: /بَعيد/ }));
    expect(await screen.findByText('far away')).toBeInTheDocument();
    expect(screen.getByText('ب-ع-د')).toBeInTheDocument();
  });

  it('still lets an untagged word be hovered, and says nothing is known', async () => {
    const user = userEvent.setup();
    lookupMock.mockReturnValue(null);
    render(<ArabicInTheWild onBack={() => {}} entry={entry()} />);

    // Every word is hoverable: the ones nothing is known about are the ones
    // worth stopping on, and the panel can still offer to learn them.
    await user.hover(screen.getByRole('button', { name: /برة/ }));
    expect(await screen.findByText('Nothing recorded for this word yet.')).toBeInTheDocument();
  });

  it('goes back to the library, not into the paste form', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    lookupMock.mockReturnValue(null);
    render(<ArabicInTheWild onBack={onBack} entry={entry()} />);

    await user.click(screen.getByRole('button', { name: /Library/ }));
    expect(onBack).toHaveBeenCalled();
    // And it did not fall through to the editor.
    expect(screen.queryByPlaceholderText('Paste the article text here…')).toBeNull();
  });

  it('offers to tag the words an entry saved before tagging existed has none of', () => {
    lookupMock.mockReturnValue(null);
    render(<ArabicInTheWild onBack={() => {}} entry={entry()} />);
    // Two untagged words in the body, and a way to act on them: without this
    // an already-saved entry could never be tagged at all.
    expect(screen.getByRole('button', { name: 'Tag 2 more words' })).toBeInTheDocument();
    expect(screen.getByText(/None of this text/)).toBeInTheDocument();
  });
});
