/**
 * Builds the SQL that fills `verb_conjugations` for the roots the deck holds.
 *
 * Run: npx vite-node scripts/forms/seed.ts > scripts/forms/seed.sql
 *
 * Only (root, form) pairs with evidence get a row: a form in the deck, or a
 * form the scripture dictionary attests. Every other form is simply absent,
 * which the app draws as "not attested" (usage tier 0). The generator writes
 * the paradigm; the SQL then checks it against what the deck and dictionary
 * already hold, and only an exact voweled match earns "high".
 */
import { readFileSync } from 'node:fs';
import { classifyRoot, generateForm, type FormId } from '../../src/lib/verb-forms/generate';

const pairs = readFileSync(new URL('./pairs.txt', import.meta.url), 'utf8')
  .trim()
  .split(',')
  .map((p) => p.split(':') as [string, FormId]);

const q = (s: string | null) => (s === null ? 'null' : `'${s.replace(/'/g, "''")}'`);

const rows = pairs.map(([root, form]) => {
  const weak = classifyRoot(root) ?? 'mixed';
  const g = form === 'I' ? null : generateForm(root, form);
  return `(${q(root)},${q(form)},${q(g?.past ?? null)},${q(g?.present ?? null)},${q(g?.masdar ?? null)},${q(weak)})`;
});

const rk = (x: string) => `pg_temp.rk(${x})`;
const vk = (x: string) => `pg_temp.vk(${x})`;

// Same house style as canon() in generate.ts, applied to stored text.
const helpers = `
create or replace function pg_temp.rk(x text) returns text language sql immutable as
$$ select translate(replace(x,'-',''),'ءأإآٱ','ااااا') $$;
create or replace function pg_temp.vk(x text) returns text language sql immutable as
$$ select regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
     split_part(trim(x),' ',1),'[ْـ]','','g'),'([ًٌٍَُِ])ّ','ّ\\1','g'),'َ(?=ا)','','g'),
     'ِ(?=ي([^ًٌٍَُِّْ]|$))','','g'),'ُ$','') $$;
`;

console.log(helpers + `
with gen(root, form, past, present, masdar, weak) as (values
${rows.join(',\n')}
),
deck as (
  select root, verb_form f, past_tense p, present_tense pr, masdar_form m, english e from words
   where word_type='verb' and verb_form is not null and root<>'' and past_tense is not null
  union
  select root, verb_form, past_tense, present_tense, masdar_form, english from flashcards
   where word_type='verb' and verb_form is not null and root<>'' and past_tense is not null
     and user_id='cb3a602f-04fc-4d68-a0d3-57734ad0edad'
),
dk as (select ${rk('root')} k, f, p, pr, m, e from deck),
dict as (
  select ${rk('root')} k, verb_form f, lemma, max(occurrences) occ from dictionary
   where pos='verb' and verb_form is not null group by 1,2,3
),
meaning as (
  select distinct on (k, f) k, f, trim(regexp_replace(e,'\\s*[(—].*$','')) en
    from dk where e ~* '^to ' order by k, f, length(e)
),
form1 as (
  select distinct on (k) k, p, pr, m from dk where f='I' order by k, (m is not null) desc, length(p)
),
cand as (
  select g.root, g.form, g.weak, ${rk('g.root')} k, g.past gp, g.present gpr, g.masdar gm,
    (select count(*) from dk d where d.k=${rk('g.root')} and d.f=g.form) in_deck,
    (select d.p from dk d where d.k=${rk('g.root')} and d.f=g.form order by length(d.p) limit 1) dp,
    (select d.pr from dk d where d.k=${rk('g.root')} and d.f=g.form order by length(d.p) limit 1) dpr,
    (select d.m from dk d where d.k=${rk('g.root')} and d.f=g.form order by length(d.p) limit 1) dm,
    exists (select 1 from dk d where d.k=${rk('g.root')} and d.f=g.form
             and ${vk('d.p')} = ${vk('g.past')} and ${vk('d.pr')} = ${vk('g.present')}) deck_exact,
    exists (select 1 from dict x where x.k=${rk('g.root')} and x.f=g.form and ${vk('x.lemma')} = ${vk('g.past')}) dict_exact,
    (select max(x.occ) from dict x where x.k=${rk('g.root')} and x.f=g.form) occ
  from gen g where g.form <> 'I' and g.past is not null or (g.form <> 'I' and exists
    (select 1 from dk d where d.k=${rk('g.root')} and d.f=g.form))
),
rows as (
  select root, form, weak,
    case when in_deck>0 and not deck_exact then coalesce(split_part(trim(dp),' ',1), gp) else gp end past,
    case when in_deck>0 and not deck_exact then coalesce(split_part(trim(dpr),' ',1), gpr) else gpr end present,
    coalesce(gm, dm) masdar,
    case when deck_exact then 'high' when dict_exact then 'high'
         when in_deck>0 then 'medium' else 'medium' end confidence,
    case when deck_exact then 'deck + generator agree' when dict_exact then 'dictionary + generator agree'
         when in_deck>0 then 'deck differs from generator' else 'generated, dictionary-attested' end source,
    greatest(case when in_deck>0 then 3 else 0 end,
             case when occ >= 72 then 4 when occ >= 16 then 3 when occ >= 5 then 2 when occ >= 1 then 1 else 0 end) tier,
    k
  from cand where gp is not null or dp is not null
  union all
  select g.root, 'I', g.weak, split_part(trim(f.p),' ',1), split_part(trim(f.pr),' ',1), f.m,
    'high', 'deck', 3, f.k
  from gen g join form1 f on f.k=${rk('g.root')} where g.form='I'
)
insert into verb_conjugations (root, form, past, present, masdar, meaning_en, usage_tier, confidence, weak_type, source)
select r.root, r.form, r.past, r.present, r.masdar, m.en, r.tier, r.confidence, r.weak, r.source
from rows r left join meaning m on m.k=r.k and m.f=r.form
where r.past is not null and r.present is not null
on conflict (root, form) do update set past=excluded.past, present=excluded.present, masdar=excluded.masdar,
  meaning_en=excluded.meaning_en, usage_tier=excluded.usage_tier, confidence=excluded.confidence,
  weak_type=excluded.weak_type, source=excluded.source
where verb_conjugations.reviewed_at is null;
`);
