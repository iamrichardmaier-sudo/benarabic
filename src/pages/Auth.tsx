import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

type Mode = 'signIn' | 'signUp' | 'forgot' | 'reset';

const Auth = () => {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Supabase sends the user back from the reset email with a recovery session;
  // in that state the only sensible screen is "choose a new password".
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('reset');
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const search = new URLSearchParams(window.location.search);
      const nextParam = search.get('next');
      const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';
      const returnUrl = window.location.origin + safeNext;

      if (mode === 'signUp') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: returnUrl },
        });
        if (error) throw error;
        toast({
          title: 'Check your email',
          description: 'We sent you a confirmation link to verify your account.',
        });
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: returnUrl,
        });
        if (error) throw error;
        toast({
          title: 'Check your email',
          description: `We sent a password reset link to ${email}.`,
        });
        setMode('signIn');
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast({ title: 'Password updated', description: 'You are now signed in.' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast({ title: err.message || 'Authentication error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const subtitle = {
    signIn: 'Sign in to your flashcards',
    signUp: 'Create an account to save your flashcards',
    forgot: 'Enter your email and we will send you a reset link',
    reset: 'Choose a new password',
  }[mode];

  const submitLabel = {
    signIn: 'Sign In',
    signUp: 'Sign Up',
    forgot: 'Send Reset Link',
    reset: 'Update Password',
  }[mode];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-2">
          <BookOpen className="w-10 h-10 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">بطاقات</h1>
          <p className="text-sm text-muted-foreground text-center">{subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode !== 'reset' && (
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
          {mode !== 'forgot' && (
            <Input
              type="password"
              placeholder={mode === 'reset' ? 'New password' : 'Password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {submitLabel}
          </Button>
        </form>

        {mode === 'signIn' && (
          <div className="space-y-2 text-center text-sm text-muted-foreground">
            <p>
              <button
                onClick={() => setMode('forgot')}
                className="text-primary font-medium hover:underline"
              >
                Forgot your password?
              </button>
            </p>
            <p>
              Don't have an account?{' '}
              <button
                onClick={() => setMode('signUp')}
                className="text-primary font-medium hover:underline"
              >
                Sign Up
              </button>
            </p>
          </div>
        )}

        {(mode === 'signUp' || mode === 'forgot') && (
          <p className="text-center text-sm text-muted-foreground">
            <button
              onClick={() => setMode('signIn')}
              className="text-primary font-medium hover:underline"
            >
              Back to sign in
            </button>
          </p>
        )}
      </div>
    </div>
  );
};

export default Auth;
