-- Carry roots from forms the corpus already knows to forms it does not.
--
-- The Book of Mormon brought 30,760 distinct surface forms, of which the
-- tagged Bible knew a fifth outright. Most of the rest are the same words
-- wearing a clitic: the definite article, a conjunction, a pronoun suffix.
-- Peeling those off reaches a form that is already tagged, and the root — the
-- one property a clitic cannot change — carries across.
--
-- Only the root. pos, verb_form and gloss are deliberately left null: the
-- vowels the peeling leaves behind are what separate كَتَبَ from كُتِبَ, and a
-- borrowed gloss would be a guess wearing the same clothes as a fact.
--
-- Three guards keep it honest:
--   * the base must be at least four letters, so three-letter skeletons —
--     where مِنّا collides with الْمَنَا — never match;
--   * every tagged form sharing that base must agree on the root, so an
--     ambiguous skeleton propagates nothing;
--   * the conjunction strip only runs on a word that carries no article, so
--     وَالْوَصايا is never read as و + الوصايا + و.
--
-- Re-runnable, and worth re-running: each pass tags forms that become the
-- evidence for the next, which is why it loops until it stops finding any.
do $$
declare n int; i int;
begin
  for i in 1..8 loop
    with tagged as (
      select public.arabic_base(surface) as base, root
      from public.bible_word_tags where root is not null
    ),
    map as (
      select base, min(root) as root from tagged
      where length(base) >= 4 group by base having count(distinct root) = 1
    ),
    cand as (
      select surface, unnest(array[
        public.arabic_base(surface),
        public.arabic_stem(surface),
        case when public.arabic_base(surface) = public.normalize_arabic(surface)
              and public.normalize_arabic(surface) ~ '^[وف]'
             then regexp_replace(public.arabic_stem(surface), '^[وف]', '') end
      ]) as key
      from public.bible_word_tags where in_bom and root is null and pos is null
    ),
    pick as (
      select c.surface, min(m.root) as root
      from cand c join map m on m.base = c.key
      where length(c.key) >= 4
      group by c.surface having count(distinct m.root) = 1
    )
    update public.bible_word_tags t set root = p.root, tagged_at = now()
    from pick p where t.surface = p.surface and t.root is null and t.pos is null;
    get diagnostics n = row_count;
    raise notice 'pass %: % forms', i, n;
    exit when n = 0;
  end loop;
end $$;

-- How far the corpus is tagged, by running text rather than by form: the
-- number that says what a reader actually meets on the page.
select count(*) filter (where root is not null or pos is not null) as forms_tagged,
       round(100.0 * sum(bom_count) filter (where root is not null or pos is not null)
             / sum(bom_count), 1) as pct_of_tokens
from public.bible_word_tags where in_bom;
