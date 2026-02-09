import { supabase } from '@/integrations/supabase/client';

export async function searchUnsplashImage(query: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('pexels-search', {
      body: { query },
    });

    if (error) {
      console.error('Pexels search error:', error);
      return null;
    }

    return data?.imageUrl || null;
  } catch (err) {
    console.error('Failed to fetch image:', err);
    return null;
  }
}
