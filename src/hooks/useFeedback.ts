import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Sends a message to the `feedback` table — nowhere else in the app routes
 * to a person, so this is the one path a reader has to report a problem or
 * ask for something. Nothing here is auto-processed: it's read from the
 * Supabase dashboard, the same way a deletion request is.
 */
export function useFeedback() {
  const { user } = useAuth();

  const submit = useCallback(
    async (message: string) => {
      if (!user) throw new Error('Sign in to send feedback.');
      const { error } = await supabase
        .from('feedback')
        .insert({ user_id: user.id, email: user.email ?? null, message } as never);
      if (error) throw error;
    },
    [user],
  );

  return { submit };
}
