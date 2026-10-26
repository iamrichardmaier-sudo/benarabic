import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import Landing from './Landing';
import { captureLandingHtml, hasStoredSession } from '@/lib/landing';

describe('Landing', () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="landing"><h1>Learn Arabic</h1><a href="/auth">Sign in</a><a href="/words/">Dictionary</a></div>';
    captureLandingHtml();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('renders the static landing markup captured from index.html', () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Learn Arabic' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dictionary' })).toHaveAttribute('href', '/words/');
  });

  it('opens sign-in inside the app instead of reloading the page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<p>auth screen</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Sign in' }));
    expect(screen.getByText('auth screen')).toBeInTheDocument();
  });

  it('detects a stored Supabase session', () => {
    expect(hasStoredSession()).toBe(false);
    localStorage.setItem('sb-abc-auth-token', '{}');
    expect(hasStoredSession()).toBe(true);
  });
});
