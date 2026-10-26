import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HomeDashboard from './HomeDashboard';

vi.mock('@/components/decks/HomeDeckShelves', () => ({ default: () => null }));
vi.mock('@/components/daily-audio/DailyAudios', () => ({ default: () => null }));
vi.mock('@/components/HomeDesktopColumns', () => ({ default: () => null }));
vi.mock('@/hooks/useBibleBooks', () => ({
  useBibleBooks: () => ({ books: [{ code: 'John', name: 'John', chapters: 21 }], loading: false, error: null }),
}));

const base = {
  dueCount: 0, learnCount: 0, deckSize: 10,
  onReview: vi.fn(), onLearn: vi.fn(), onBrowseDecks: vi.fn(),
  onContinueReading: vi.fn(), onBrowseLibrary: vi.fn(), onSelectPractice: vi.fn(),
};

describe('HomeDashboard', () => {
  beforeEach(() => localStorage.clear());

  it('leads with review when cards are due, and says so in the summary', () => {
    const onReview = vi.fn();
    render(<HomeDashboard {...base} dueCount={48} learnCount={73} onReview={onReview} />);
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByText('48 to review · 73 new waiting')).toBeInTheDocument();
    const review = screen.getByRole('button', { name: /Review 48 cards/ });
    expect(review.className).toContain('bg-primary');
    fireEvent.click(review);
    expect(onReview).toHaveBeenCalled();
  });

  it('marks reviews done and moves the highlight to learning', () => {
    render(<HomeDashboard {...base} learnCount={5} nextWave={null} />);
    expect(screen.getByText('Reviews done')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reviews done/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Learn new words/ }).className).toContain('bg-primary');
  });

  it('offers a first deck to an empty account', () => {
    const onBrowseDecks = vi.fn();
    render(<HomeDashboard {...base} deckSize={0} onBrowseDecks={onBrowseDecks} />);
    fireEvent.click(screen.getByRole('button', { name: /Pick your first deck/ }));
    expect(onBrowseDecks).toHaveBeenCalled();
  });

  it('continues the last chapter read', () => {
    localStorage.setItem('arabic-flashcards-bible-book', 'John');
    localStorage.setItem('arabic-flashcards-bible-chapter', '3');
    const onContinueReading = vi.fn();
    render(<HomeDashboard {...base} onContinueReading={onContinueReading} />);
    fireEvent.click(screen.getByRole('button', { name: /Continue John 3/ }));
    expect(onContinueReading).toHaveBeenCalledWith('John', 3);
  });

  it('says all caught up when nothing is waiting', () => {
    render(<HomeDashboard {...base} />);
    expect(screen.getByText('All caught up.')).toBeInTheDocument();
  });
});
