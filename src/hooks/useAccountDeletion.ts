import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Records a request to delete this account into `account_deletion_requests`,
 * rather than deleting anything itself. No table in this schema cascades
 * from auth.users, so actually deleting a reader's data means hand-clearing
 * flashcards/private_texts/transcripts/user_decks for them — this is the
 * queue that work comes from, read from the Supabase dashboard.
 */
export function useAccountDeletion() {
  const { user } = useAuth();

  const request = useCallback(async () => {
    if (!user) throw new Error('Sign in to request account deletion.');
    const { error } = await supabase
      .from('account_deletion_requests')
      .insert({ user_id: user.id, email: user.email ?? null } as never);
    if (error) throw error;
  }, [user]);

  return { request };
}
