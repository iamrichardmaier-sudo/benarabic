import { supabase } from '@/integrations/supabase/client';

/** Which recording, or both one after the other. */
export type Register = 'shaami' | 'fusha' | 'both';

export interface Podcast {
  id: string;
  title: string;
  subtitle: string | null;
  deckId: string | null;
  icon: string;
  iconUrl: string | null;
  shaamiUrl: string | null;
  fushaUrl: string | null;
  shaamiSeconds: number | null;
  fushaSeconds: number | null;
}

interface Row {
  id: string;
  title: string;
  subtitle: string | null;
  deck_id: string | null;
  icon: string;
  icon_url: string | null;
  shaami_url: string | null;
  fusha_url: string | null;
  shaami_seconds: number | null;
  fusha_seconds: number | null;
}

const COLUMNS =
  'id,title,subtitle,deck_id,icon,icon_url,shaami_url,fusha_url,shaami_seconds,fusha_seconds';

function toPodcast(r: Row): Podcast {
  return {
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    deckId: r.deck_id,
    icon: r.icon,
    iconUrl: r.icon_url,
    shaamiUrl: r.shaami_url,
    fushaUrl: r.fusha_url,
    shaamiSeconds: r.shaami_seconds,
    fushaSeconds: r.fusha_seconds,
  };
}

export async function fetchPodcasts(): Promise<Podcast[]> {
  const { data, error } = await supabase
    .from('podcasts')
    .select(COLUMNS)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toPodcast);
}

/** Which registers this podcast actually has audio for. */
export function available(p: Podcast): Register[] {
  const out: Register[] = [];
  if (p.shaamiUrl) out.push('shaami');
  if (p.fushaUrl) out.push('fusha');
  if (p.shaamiUrl && p.fushaUrl) out.push('both');
  return out;
}

/** The files to play, in order, for a choice of register. */
export function tracksFor(p: Podcast, register: Register): { url: string; label: string }[] {
  const shaami = p.shaamiUrl ? [{ url: p.shaamiUrl, label: 'Shaami' }] : [];
  const fusha = p.fushaUrl ? [{ url: p.fushaUrl, label: 'Fuṣḥā' }] : [];
  if (register === 'shaami') return shaami;
  if (register === 'fusha') return fusha;
  return [...shaami, ...fusha];
}

export const REGISTER_LABEL: Record<Register, string> = {
  shaami: 'Shaami',
  fusha: 'Fuṣḥā',
  both: 'Both, back to back',
};

/** mm:ss, or h:mm:ss once it runs past the hour. */
export function clock(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '--:--';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

/** How long a choice of register runs, when the durations are known. */
export function lengthOf(p: Podcast, register: Register): number | null {
  const a = p.shaamiSeconds;
  const b = p.fushaSeconds;
  if (register === 'shaami') return a;
  if (register === 'fusha') return b;
  return a != null && b != null ? a + b : null;
}
