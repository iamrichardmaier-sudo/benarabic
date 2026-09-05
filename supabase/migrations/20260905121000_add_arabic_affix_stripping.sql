-- Two morphological peelings used to carry a root from a form the corpus
-- already knows to one it does not.
--
-- `arabic_base` strips the definite article, including behind a one-letter
-- clitic (وَالْـ, بِالْـ, لِلْـ). It insists on a *bare* alef followed by lam:
-- the article is written اَلْ with no vowel on the alef, whereas إِله and وَالِد
-- carry one. Without that test the rule reads إِلهُنَا as "the ـهنا" and hands
-- هُنا the root of "God".
create or replace function public.arabic_base(t text) returns text language sql immutable as $$
  select case
    when raw ~ '^[وفبك]?[َُِ]?ا(?![ً-ْ])ل'
      then public.normalize_arabic(regexp_replace(raw, '^[وفبك]?[َُِ]?ا(?![ً-ْ])ل', ''))
    when raw ~ '^لِ?ل'
      then public.normalize_arabic(regexp_replace(raw, '^لِ?ل', ''))
    else public.normalize_arabic(raw)
  end
  from (select replace(t, 'ـ', '') as raw) q;
$$;

-- `arabic_stem` goes one further and drops a trailing pronoun suffix, so
-- كَلِماتِهِ reaches كَلِمات. Only ever used to propagate a *root*: the suffix
-- carries none of it, so it cannot change the answer, whereas the vowels it
-- leaves behind separate كَتَبَ from كُتِبَ and must not be borrowed.
create or replace function public.arabic_stem(t text) returns text language sql immutable as $$
  select regexp_replace(public.arabic_base(t), '(هما|كما|ها|هم|هن|كم|كن|نا|ني|ه|ك)$', '');
$$;

