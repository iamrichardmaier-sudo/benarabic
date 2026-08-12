import { useState, useEffect } from 'react';
import type { BibleBook } from '@/lib/bible-types';

// Module-scoped: the book list is fixed and identical for everyone, so one
// fetch per page load (not per component) is all it ever needs.
let cache: BibleBook[] | null = null;
let inflight: Promise<BibleBook[]> | null = null;

async function loadBooks(): Promise<BibleBook[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch(`${import.meta.env.BASE_URL}bible/books.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load the Bible book list (${res.status})`);
        return res.json() as Promise<BibleBook[]>;
      })
      .then((books) => {
        cache = books;
        return books;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useBibleBooks() {
  const [books, setBooks] = useState<BibleBook[] | null>(cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    loadBooks()
      .then((b) => {
        if (!cancelled) setBooks(b);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { books, loading: !books && !error, error };
}
