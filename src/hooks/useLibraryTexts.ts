import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { TaggedSense } from '@/lib/reader-word';

export interface LibraryText {
  id: string;
  title: string;
  body: string;
  /** The reader's own English, one line per line of the body. */
  english: string;
  coverUrl: string | null;
  updatedAt: string;
  /** Senses for this entry's own words, keyed by consonant skeleton. */
  wordTags: Record<string, TaggedSense[]>;
  /**
   * False for a text someone else published that RLS now lets this reader
   * see too. Shown separately so it never looks like something they saved
   * themselves — see LibraryHome's "Yours" vs "Shared" split.
   */
  isOwn: boolean;
}

interface Row {
  id: string;
  title: string | null;
  body: string | null;
  english: string | null;
  cover_url: string | null;
  updated_at: string | null;
  created_at: string;
  word_tags: unknown;
  user_id: string;
}

function rowToText(row: Row, currentUserId: string): LibraryText {
  return {
    id: row.id,
    title: row.title ?? 'Untitled',
    body: row.body ?? '',
    english: row.english ?? '',
    coverUrl: row.cover_url,
    updatedAt: row.updated_at ?? row.created_at,
    wordTags: (row.word_tags as Record<string, TaggedSense[]>) ?? {},
    isOwn: row.user_id === currentUserId,
  };
}

/**
 * The reader's own saved texts, plus any other reader's text marked public.
 *
 * These live in private_texts, which row-level security scopes to rows the
 * reader wrote or rows marked is_public. Nothing here is shipped with the
 * app: a saved text is usually someone else's writing, kept for study, and
 * the app's own build is published for anyone to download.
 */
export function useLibraryTexts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [texts, setTexts] = useState<LibraryText[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setTexts([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('private_texts')
      .select('id,title,body,english,cover_url,updated_at,created_at,word_tags,user_id')
      .eq('kind', 'text')
      .order('updated_at', { ascending: false });
    if (error) {
      // Whatever was listed stays listed. A failed read means the list could
      // not be refreshed, not that the reader's texts are gone — and showing
      // an empty library for a query error reads as data loss. This is not
      // hypothetical: a column added to the select before its migration had
      // been applied emptied the library on sight.
      console.error('Could not load your library:', error);
      setError(error.message ?? 'Your library could not be loaded.');
      // Not every screen that uses this hook renders `error` itself — the
      // toast is what makes a failed load visible everywhere this is used,
      // not just on the one screen that happens to check for it.
      toast({ title: 'Your saved texts could not be loaded', variant: 'destructive' });
    } else {
      setError(null);
      setTexts((data as unknown as Row[]).map((row) => rowToText(row, user.id)));
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (entry: {
      id?: string;
      title: string;
      body: string;
      english?: string;
      coverUrl: string | null;
      wordTags?: Record<string, TaggedSense[]>;
    }) => {
      if (!user) throw new Error('Sign in to save to your library.');
      const fields = {
        user_id: user.id,
        kind: 'text',
        // work and book_code are what the chapter-and-verse side keys on; a
        // free-form entry still has to fill them, so it names itself.
        work: 'library',
        book_code: entry.id ?? crypto.randomUUID(),
        chapter: 1,
        title: entry.title.trim() || 'Untitled',
        body: entry.body,
        english: entry.english ?? null,
        cover_url: entry.coverUrl,
        word_tags: entry.wordTags ?? {},
        // Required, and meaningless for a pasted entry: the column belongs to
        // the chapter-and-verse side. Sent explicitly rather than relying on
        // the column default, so saving works against either schema.
        verses: [],
        updated_at: new Date().toISOString(),
      };
      const query = entry.id
        ? supabase.from('private_texts').update(fields as never).eq('id', entry.id)
        : supabase.from('private_texts').insert(fields as never);
      const { error } = await query;
      if (error) throw error;
      await refresh();
    },
    [user, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('private_texts').delete().eq('id', id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  return { texts, loading, error, save, remove, refresh };
}
