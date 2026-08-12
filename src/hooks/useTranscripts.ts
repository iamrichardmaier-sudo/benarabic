import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Transcript {
  id: string;
  title: string;
  subtitle: string | null;
  content: string;
  videoUrl: string | null;
  createdAt: string;
}

/** "Chapter 12" sorts before "Chapter 9" as plain text; sort by the number instead. */
function chapterNumber(title: string): number | null {
  const m = title.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function sortTranscripts(list: Transcript[]): Transcript[] {
  return [...list].sort((a, b) => {
    const na = chapterNumber(a.title);
    const nb = chapterNumber(b.title);
    if (na !== null && nb !== null) return nb - na; // newest chapter first
    if (na !== null) return -1;
    if (nb !== null) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function useTranscripts() {
  const { user } = useAuth();
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from('transcripts').select('*');
    if (error) {
      console.error('Error fetching transcripts:', error);
      return;
    }
    setTranscripts(
      sortTranscripts(
        data.map((row) => ({
          id: row.id,
          title: row.title,
          subtitle: row.subtitle,
          content: row.content,
          videoUrl: row.video_url,
          createdAt: row.created_at,
        })),
      ),
    );
  }, []);

  useEffect(() => {
    if (!user) {
      setTranscripts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    refetch().finally(() => setLoading(false));
  }, [user, refetch]);

  const addTranscript = useCallback(
    async (title: string, subtitle: string | null, content: string) => {
      const { error } = await supabase.from('transcripts').insert({ title, subtitle, content });
      if (error) throw error;
      await refetch();
    },
    [refetch],
  );

  const deleteTranscript = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('transcripts').delete().eq('id', id);
      if (error) throw error;
      setTranscripts((prev) => prev.filter((t) => t.id !== id));
    },
    [],
  );

  return { transcripts, loading, addTranscript, deleteTranscript, refetch };
}
