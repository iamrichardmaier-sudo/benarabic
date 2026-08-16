import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const lookupMock = vi.fn();
vi.mock('@/hooks/useWordSkeletonIndex', () => ({
  useWordSkeletonIndex: () => ({ ready: true, error: null, lookup: lookupMock }),
}));

const invokeMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invokeMock(...args) } },
}));

import ArabicInTheWild from './ArabicInTheWild';

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
