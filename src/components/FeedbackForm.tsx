import { useState } from 'react';
import { Check, Loader2, Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import BackButton from '@/components/BackButton';
import { useFeedback } from '@/hooks/useFeedback';

/**
 * The one place to report a problem or ask for something — nowhere else in
 * the app routes a message to a person. Lands in the `feedback` table and
 * nothing is sent automatically; it's read from the Supabase dashboard.
 */
const FeedbackForm = ({ onBack }: { onBack: () => void }) => {
  const { submit } = useFeedback();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await submit(message.trim());
      setMessage('');
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <BackButton onClick={onBack} label="Settings" />
      <h1 className="text-xl font-bold text-foreground">Send feedback</h1>
      <p className="text-sm text-muted-foreground">
        Found a bug, or something confusing? Tell us what happened — this goes straight to the
        people building the app.
      </p>

      {sent && (
        <p className="flex items-center gap-1.5 rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success">
          <Check className="h-4 w-4 shrink-0" />
          Sent — thank you.
        </p>
      )}

      <Textarea
        className="min-h-[160px] bg-card border-border resize-none focus:ring-2 focus:ring-primary/30"
        placeholder="What happened, and what did you expect instead?"
        value={message}
        onChange={(e) => { setMessage(e.target.value); setError(null); }}
        disabled={busy}
      />
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <Button onClick={handleSubmit} className="w-full gap-2" size="lg" disabled={busy || !message.trim()}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Send
      </Button>
    </div>
  );
};

export default FeedbackForm;
