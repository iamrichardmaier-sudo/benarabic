import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, Flame, GraduationCap, ChevronRight, ShieldCheck, type LucideIcon } from 'lucide-react';
import BackButton from '@/components/BackButton';
import QuizRunner from '@/components/forms/QuizRunner';
import HeatMapFlow from '@/components/forms/HeatMapFlow';
import FormsReview from '@/components/forms/FormsReview';
import type { FlashCard } from '@/lib/spaced-repetition';
import { isDeckAdmin } from '@/lib/deck-store';
import { loadRootMeanings } from '@/lib/morphology';
import { loadConjugations, dropConjugationCache, type Conjugation } from '@/lib/verb-forms/data';
import { buildIdentify, buildMeanings, LEVELS, quizzable, type Level, type Question } from '@/lib/verb-forms/quiz';
import { rootKey } from '@/lib/word-relations';

interface FormsTabProps {
  cards: FlashCard[];
  onBack: () => void;
}

type Screen =
  | { name: 'home' }
  | { name: 'levels' }
  | { name: 'identify'; level: Level; questions: Question[]; short: boolean }
  | { name: 'meanings'; questions: Question[] }
  | { name: 'heatmap' }
  | { name: 'review' };

const Row = ({ icon: Icon, title, hint, onClick, disabled }: { icon: LucideIcon; title: string; hint: string; onClick: () => void; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-4 text-start transition-colors hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-40"
  >
    <Icon className="h-5 w-5 shrink-0 text-primary" />
    <span className="min-w-0 flex-1">
      <span className="block font-semibold text-foreground">{title}</span>
      <span className="block text-xs text-muted-foreground">{hint}</span>
    </span>
    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
  </button>
);

/**
 * The Forms tab: identify the ten verb forms, tell their meanings apart, and
 * see how much each is used. Everything comes from stored paradigms; nothing
 * is conjugated on the device.
 */
const FormsTab = ({ cards, onBack }: FormsTabProps) => {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [rows, setRows] = useState<Conjugation[] | null>(null);
  const [rootMeanings, setRootMeanings] = useState<Record<string, string>>({});
  const [admin, setAdmin] = useState(false);

  const load = useCallback(async () => {
    setRows(await loadConjugations());
  }, []);

  useEffect(() => {
    void load();
    loadRootMeanings().then(setRootMeanings).catch(() => undefined);
    isDeckAdmin().then(setAdmin).catch(() => undefined);
  }, [load]);

  const trusted = useMemo(() => quizzable(rows ?? []), [rows]);
  const pending = (rows ?? []).filter((r) => r.confidence !== 'high').length;
  const home = () => setScreen({ name: 'home' });

  const startIdentify = (level: Level) => {
    const set = buildIdentify(rows ?? [], level, Math.random, 30, rootMeanings);
    setScreen({ name: 'identify', level, questions: set.questions, short: set.short });
  };

  const startMeanings = () =>
    setScreen({ name: 'meanings', questions: buildMeanings(rows ?? [], { keyOf: rootKey, count: 10, rootMeanings }) });

  const body = () => {
    if (rows === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

    switch (screen.name) {
      case 'levels':
        return (
          <div className="space-y-3">
            <BackButton onClick={home} label="Forms" />
            <h1 className="text-xl font-bold text-foreground">Learn and identify the forms</h1>
            {LEVELS.map((l) => (
              <Row key={l.level} icon={GraduationCap} title={l.title} hint={l.blurb} onClick={() => startIdentify(l.level)} />
            ))}
          </div>
        );
      case 'identify':
        return (
          <div className="space-y-3">
            <BackButton onClick={() => setScreen({ name: 'levels' })} label="Levels" />
            {screen.short && screen.questions.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Only {screen.questions.length} different verbs are ready at this level, so this round is shorter.
              </p>
            )}
            <QuizRunner
              title={LEVELS[screen.level - 1].title}
              mode="identify"
              level={screen.level}
              questions={screen.questions}
              onExit={() => setScreen({ name: 'levels' })}
            />
          </div>
        );
      case 'meanings':
        return (
          <div className="space-y-3">
            <BackButton onClick={home} label="Forms" />
            <QuizRunner
              title="Forms and meanings"
              mode="meanings"
              questions={screen.questions}
              onExit={home}
              note={screen.questions.length === 0 ? 'No root has two checked forms with meanings yet.' : undefined}
            />
          </div>
        );
      case 'heatmap':
        return (
          <div className="space-y-3">
            <BackButton onClick={home} label="Forms" />
            <HeatMapFlow cards={cards} rows={trusted} rootMeanings={rootMeanings} onExit={home} />
          </div>
        );
      case 'review':
        return (
          <div className="space-y-3">
            <BackButton onClick={home} label="Forms" />
            <h1 className="text-xl font-bold text-foreground">Review generated forms</h1>
            <FormsReview
              rows={rows}
              onChanged={() => {
                dropConjugationCache();
                void load();
              }}
            />
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <BackButton onClick={onBack} label="Learn" />
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-foreground">Forms</h1>
              <p className="text-sm text-muted-foreground">
                The ten Arabic verb forms: spot them, understand them, see how much each is used.
              </p>
            </div>
            <div className="space-y-2">
              <Row icon={GraduationCap} title="Learn and identify forms" hint="Three levels of 30 questions" onClick={() => setScreen({ name: 'levels' })} disabled={trusted.length === 0} />
              <Row icon={BookOpenCheck} title="Forms and meanings" hint="Which meaning goes with which form of a root" onClick={startMeanings} disabled={trusted.length === 0} />
              <Row icon={Flame} title="Form usage heat map" hint="Flashcards from your own verbs" onClick={() => setScreen({ name: 'heatmap' })} disabled={trusted.length === 0} />
              {admin && (
                <Row icon={ShieldCheck} title="Review generated forms" hint={`${pending} waiting`} onClick={() => setScreen({ name: 'review' })} />
              )}
            </div>
            {trusted.length === 0 && (
              <p className="text-sm text-muted-foreground">
                The form data could not be loaded. Check your connection and open this tab again.
              </p>
            )}
          </div>
        );
    }
  };

  return <div className="space-y-4">{body()}</div>;
};

export default FormsTab;
