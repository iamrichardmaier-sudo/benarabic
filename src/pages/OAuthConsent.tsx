import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen } from "lucide-react";

// Beta namespace — typed locally so TS is happy.
type AuthorizationDetails = {
  client?: { name?: string; client_name?: string; redirect_uris?: string[] };
  redirect_url?: string;
  redirect_to?: string;
  scopes?: string[];
  requested_scopes?: string[];
};
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id in the request.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      setEmail(sess.session.user.email ?? null);
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-3 text-center">
          <h1 className="text-xl font-semibold text-foreground">Could not load this authorization request</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const clientName = details.client?.name ?? details.client?.client_name ?? "an app";
  const redirectUri = details.client?.redirect_uris?.[0];
  const scopes = details.scopes ?? details.requested_scopes ?? [];

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-card p-6 flashcard-shadow">
        <div className="flex flex-col items-center gap-2 text-center">
          <BookOpen className="w-8 h-8 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Connect {clientName} to بطاقات</h1>
          <p className="text-sm text-muted-foreground">
            This lets {clientName} use this app as you.
          </p>
        </div>

        {email && (
          <div className="text-xs text-muted-foreground text-center">
            Signed in as <span className="text-foreground">{email}</span>
          </div>
        )}

        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">{clientName} will be able to:</p>
          <ul className="list-disc pl-5 space-y-1 text-foreground">
            <li>List and search your flashcards</li>
            <li>See which cards are due for review</li>
            <li>Add new flashcards to your deck</li>
            <li>Delete flashcards from your deck</li>
          </ul>
          {scopes.length > 0 && (
            <p className="text-xs text-muted-foreground pt-2">
              Requested identity: {scopes.join(", ")}
            </p>
          )}
          {redirectUri && (
            <p className="text-xs text-muted-foreground break-all">Returns to: {redirectUri}</p>
          )}
          <p className="text-xs text-muted-foreground pt-2">
            This does not bypass this app's permissions — {clientName} can only see and change your own cards.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
            Cancel connection
          </Button>
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Approve
          </Button>
        </div>
      </div>
    </main>
  );
}
