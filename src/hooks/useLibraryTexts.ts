import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface LibraryText {
  id: string;
  title: string;
  body: string;
  coverUrl: string | null;
  updatedAt: string;
}

interface Row {
  id: string;
  title: string | null;
  body: string | null;
  cover_url: string | null;
  updated_at: string | null;
  created_at: string;
}

function rowToText(row: Row): LibraryText {
  return {
    id: row.id,
    title: row.title ?? 'Untitled',
    body: row.body ?? '',
    coverUrl: row.cover_url,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

/**
 * The reader's own saved texts — the ones they pasted in and kept.
 *
 * These live in private_texts, which row-level security scopes to the reader
 * who wrote them. Nothing here is shipped with the app: a saved text is
 * usually someone else's writing, kept for study, and the app's own build is
 * published for anyone to download.
 */
export function useLibraryTexts() {
  const { user } = useAuth();
  const [texts, setTexts] = useState<LibraryText[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setTexts([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('private_texts')
      .select('id,title,body,cover_url,updated_at,created_at')
      .eq('kind', 'text')
      .order('updated_at', { ascending: false });
    if (error) {
      console.error('Could not load your library:', error);
      setTexts([]);
    } else {
      setTexts((data as unknown as Row[]).map(rowToText));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (entry: { id?: string; title: string; body: string; coverUrl: string | null }) => {
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
        cover_url: entry.coverUrl,
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

  return { texts, loading, save, remove, refresh };
}
