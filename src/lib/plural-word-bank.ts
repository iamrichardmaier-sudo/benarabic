export type CategoryId =
  | 'sound-masc'
  | 'sound-fem'
  | 'broken-human'
  | 'broken-nonhuman'
  | 'collective'
  | 'irregular'
  | 'shaami';

export type Dialect = 'fusha' | 'shaami' | 'both';
export type QuizDirection = 'singular_to_plural' | 'collective';

export interface PluralWord {
  singular: string;
  plural: string[];
  english: string;
  category: CategoryId;
  dialect: Dialect;
  pattern: string;
  grammar_note: string;
  quiz_direction: QuizDirection;
}

export interface CategoryInfo {
  id: CategoryId;
  nameEn: string;
  nameAr: string;
  description: string;
  example: string;
}

export const CATEGORIES: CategoryInfo[] = [
  {
    id: 'sound-masc',
    nameEn: 'Sound Masculine Plural',
    nameAr: 'جمع مذكر سالم',
    description: 'Suffix ـون/ـين added to unchanged masculine singular. For human-referring nouns: professions, nationalities, active participles.',
    example: 'مُعَلِّم → مُعَلِّمُون',
  },
  {
    id: 'sound-fem',
    nameEn: 'Sound Feminine Plural',
    nameAr: 'جمع مؤنث سالم',
    description: 'Drop ة if present, add ـات. Used for feminine nouns, abstracts, and loanwords in both Fusha and Shaami.',
    example: 'سَيَّارَة → سَيَّارَات',
  },
  {
    id: 'broken-human',
    nameEn: 'Broken Plural – Human',
    nameAr: 'جمع تكسير عاقل',
    description: 'Internal vowel pattern changes for human nouns. Takes masculine plural agreement (هم, كانوا).',
    example: 'رَجُل → رِجَال',
  },
  {
    id: 'broken-nonhuman',
    nameEn: 'Broken Plural – Non-human',
    nameAr: 'جمع تكسير غير عاقل',
    description: 'Internal vowel changes for non-human nouns. CRITICAL: takes feminine singular agreement. هذه الكتب جميلة ✓',
    example: 'كِتَاب → كُتُب',
  },
  {
    id: 'collective',
    nameEn: 'Collective Nouns',
    nameAr: 'اسم الجنس الجمعي',
    description: 'Nouns inherently plural/mass. Add ة for one item (singulative). Quiz: given singulative, provide collective.',
    example: 'شَجَرَة → شَجَر',
  },
  {
    id: 'irregular',
    nameEn: 'Irregular / Suppletive',
    nameAr: 'جمع غير قياسي',
    description: 'Plurals from a completely different root. No pattern predicts them — must be memorized.',
    example: 'امْرَأَة → نِسَاء',
  },
  {
    id: 'shaami',
    nameEn: 'Shaami-Specific',
    nameAr: 'جمع شامي خاص',
    description: 'Levantine dialect forms: always ـين for sound masc (no ـون). Loanwords take broken plurals. Colloquial vocabulary.',
    example: 'كَارْت → كُرُوت',
  },
];

export const WORD_BANK: PluralWord[] = [
  // ═══════════ Category A: Sound Masculine Plural (sound-masc) ═══════════
  { singular: 'مُعَلِّم', plural: ['مُعَلِّمُون', 'مُعَلِّمِين'], english: 'teacher', category: 'sound-masc', dialect: 'both', pattern: 'فاعِل → فاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُهَنْدِس', plural: ['مُهَنْدِسُون', 'مُهَنْدِسِين'], english: 'engineer', category: 'sound-masc', dialect: 'both', pattern: 'مُفَعِّل → مُفَعِّلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُوَظَّف', plural: ['مُوَظَّفُون', 'مُوَظَّفِين'], english: 'employee', category: 'sound-masc', dialect: 'both', pattern: 'مُفَعَّل → مُفَعَّلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'لَاعِب', plural: ['لَاعِبُون', 'لَاعِبِين'], english: 'player', category: 'sound-masc', dialect: 'both', pattern: 'فاعِل → فاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُسْلِم', plural: ['مُسْلِمُون', 'مُسْلِمِين'], english: 'Muslim', category: 'sound-masc', dialect: 'both', pattern: 'مُفْعِل → مُفْعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'طَالِب', plural: ['طَالِبُون', 'طَالِبِين'], english: 'student', category: 'sound-masc', dialect: 'both', pattern: 'فاعِل → فاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُحَاسِب', plural: ['مُحَاسِبُون', 'مُحَاسِبِين'], english: 'accountant', category: 'sound-masc', dialect: 'both', pattern: 'مُفاعِل → مُفاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُسَافِر', plural: ['مُسَافِرُون', 'مُسَافِرِين'], english: 'traveler', category: 'sound-masc', dialect: 'both', pattern: 'مُفاعِل → مُفاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُدَرِّس', plural: ['مُدَرِّسُون', 'مُدَرِّسِين'], english: 'instructor', category: 'sound-masc', dialect: 'both', pattern: 'مُفَعِّل → مُفَعِّلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُمَرِّض', plural: ['مُمَرِّضُون', 'مُمَرِّضِين'], english: 'male nurse', category: 'sound-masc', dialect: 'both', pattern: 'مُفَعِّل → مُفَعِّلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُحَامٍ', plural: ['مُحَامُون', 'مُحَامِين'], english: 'lawyer', category: 'sound-masc', dialect: 'both', pattern: 'مُفاعِل → مُفاعُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُدِير', plural: ['مُدِيرُون', 'مُدِيرِين'], english: 'manager', category: 'sound-masc', dialect: 'both', pattern: 'مُفِيل → مُفِيلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُنَظِّم', plural: ['مُنَظِّمُون', 'مُنَظِّمِين'], english: 'organizer', category: 'sound-masc', dialect: 'both', pattern: 'مُفَعِّل → مُفَعِّلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُرَاقِب', plural: ['مُرَاقِبُون', 'مُرَاقِبِين'], english: 'monitor/observer', category: 'sound-masc', dialect: 'both', pattern: 'مُفاعِل → مُفاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'فَلَّاح', plural: ['فَلَّاحُون', 'فَلَّاحِين'], english: 'farmer', category: 'sound-masc', dialect: 'both', pattern: 'فَعَّال → فَعَّالُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'نَجَّار', plural: ['نَجَّارُون', 'نَجَّارِين'], english: 'carpenter', category: 'sound-masc', dialect: 'both', pattern: 'فَعَّال → فَعَّالُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'حَدَّاد', plural: ['حَدَّادُون', 'حَدَّادِين'], english: 'blacksmith', category: 'sound-masc', dialect: 'both', pattern: 'فَعَّال → فَعَّالُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'خَبَّاز', plural: ['خَبَّازُون', 'خَبَّازِين'], english: 'baker', category: 'sound-masc', dialect: 'both', pattern: 'فَعَّال → فَعَّالُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُتَرْجِم', plural: ['مُتَرْجِمُون', 'مُتَرْجِمِين'], english: 'translator', category: 'sound-masc', dialect: 'both', pattern: 'مُتَفْعِل → مُتَفْعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُخْلِص', plural: ['مُخْلِصُون', 'مُخْلِصِين'], english: 'sincere person', category: 'sound-masc', dialect: 'both', pattern: 'مُفْعِل → مُفْعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُؤْمِن', plural: ['مُؤْمِنُون', 'مُؤْمِنِين'], english: 'believer', category: 'sound-masc', dialect: 'both', pattern: 'مُفْعِل → مُفْعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُتَطَوِّع', plural: ['مُتَطَوِّعُون', 'مُتَطَوِّعِين'], english: 'volunteer', category: 'sound-masc', dialect: 'both', pattern: 'مُتَفَعِّل → مُتَفَعِّلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُشْرِف', plural: ['مُشْرِفُون', 'مُشْرِفِين'], english: 'supervisor', category: 'sound-masc', dialect: 'both', pattern: 'مُفْعِل → مُفْعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُفَتِّش', plural: ['مُفَتِّشُون', 'مُفَتِّشِين'], english: 'inspector', category: 'sound-masc', dialect: 'both', pattern: 'مُفَعِّل → مُفَعِّلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُحَرِّر', plural: ['مُحَرِّرُون', 'مُحَرِّرِين'], english: 'editor', category: 'sound-masc', dialect: 'both', pattern: 'مُفَعِّل → مُفَعِّلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُغَنٍّ', plural: ['مُغَنُّون', 'مُغَنِّين'], english: 'singer', category: 'sound-masc', dialect: 'both', pattern: 'مُفَعِّل → مُفَعِّلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُصَوِّر', plural: ['مُصَوِّرُون', 'مُصَوِّرِين'], english: 'photographer', category: 'sound-masc', dialect: 'both', pattern: 'مُفَعِّل → مُفَعِّلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُعَاوِن', plural: ['مُعَاوِنُون', 'مُعَاوِنِين'], english: 'assistant', category: 'sound-masc', dialect: 'both', pattern: 'مُفاعِل → مُفاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُقَاتِل', plural: ['مُقَاتِلُون', 'مُقَاتِلِين'], english: 'fighter', category: 'sound-masc', dialect: 'both', pattern: 'مُفاعِل → مُفاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُنَاضِل', plural: ['مُنَاضِلُون', 'مُنَاضِلِين'], english: 'activist', category: 'sound-masc', dialect: 'both', pattern: 'مُفاعِل → مُفاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُحَلِّل', plural: ['مُحَلِّلُون', 'مُحَلِّلِين'], english: 'analyst', category: 'sound-masc', dialect: 'both', pattern: 'مُفَعِّل → مُفَعِّلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُصَمِّم', plural: ['مُصَمِّمُون', 'مُصَمِّمِين'], english: 'designer', category: 'sound-masc', dialect: 'both', pattern: 'مُفَعِّل → مُفَعِّلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُبَرْمِج', plural: ['مُبَرْمِجُون', 'مُبَرْمِجِين'], english: 'programmer', category: 'sound-masc', dialect: 'both', pattern: 'مُفَعْلِل → مُفَعْلِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'رَاكِب', plural: ['رَاكِبُون', 'رَاكِبِين'], english: 'rider/passenger', category: 'sound-masc', dialect: 'both', pattern: 'فاعِل → فاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'سَائِق', plural: ['سَائِقُون', 'سَائِقِين'], english: 'driver', category: 'sound-masc', dialect: 'both', pattern: 'فاعِل → فاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'عَامِل', plural: ['عَامِلُون', 'عَامِلِين'], english: 'worker', category: 'sound-masc', dialect: 'both', pattern: 'فاعِل → فاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'حَارِس', plural: ['حَارِسُون', 'حَارِسِين'], english: 'guard', category: 'sound-masc', dialect: 'both', pattern: 'فاعِل → فاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'بَائِع', plural: ['بَائِعُون', 'بَائِعِين'], english: 'seller', category: 'sound-masc', dialect: 'both', pattern: 'فاعِل → فاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'صَائِم', plural: ['صَائِمُون', 'صَائِمِين'], english: 'fasting person', category: 'sound-masc', dialect: 'both', pattern: 'فاعِل → فاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'قَائِد', plural: ['قَائِدُون', 'قَائِدِين'], english: 'leader', category: 'sound-masc', dialect: 'both', pattern: 'فاعِل → فاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'زَائِر', plural: ['زَائِرُون', 'زَائِرِين'], english: 'visitor', category: 'sound-masc', dialect: 'both', pattern: 'فاعِل → فاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'سَاكِن', plural: ['سَاكِنُون', 'سَاكِنِين'], english: 'resident', category: 'sound-masc', dialect: 'both', pattern: 'فاعِل → فاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'حَاضِر', plural: ['حَاضِرُون', 'حَاضِرِين'], english: 'present/attendee', category: 'sound-masc', dialect: 'both', pattern: 'فاعِل → فاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'نَاجِح', plural: ['نَاجِحُون', 'نَاجِحِين'], english: 'successful person', category: 'sound-masc', dialect: 'both', pattern: 'فاعِل → فاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُتَقَاعِد', plural: ['مُتَقَاعِدُون', 'مُتَقَاعِدِين'], english: 'retiree', category: 'sound-masc', dialect: 'both', pattern: 'مُتَفاعِل → مُتَفاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُمَثِّل', plural: ['مُمَثِّلُون', 'مُمَثِّلِين'], english: 'actor/representative', category: 'sound-masc', dialect: 'both', pattern: 'مُفَعِّل → مُفَعِّلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُعَلِّق', plural: ['مُعَلِّقُون', 'مُعَلِّقِين'], english: 'commentator', category: 'sound-masc', dialect: 'both', pattern: 'مُفَعِّل → مُفَعِّلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُرَاسِل', plural: ['مُرَاسِلُون', 'مُرَاسِلِين'], english: 'correspondent', category: 'sound-masc', dialect: 'both', pattern: 'مُفاعِل → مُفاعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُسْتَشَار', plural: ['مُسْتَشَارُون', 'مُسْتَشَارِين'], english: 'advisor', category: 'sound-masc', dialect: 'both', pattern: 'مُسْتَفْعَل → مُسْتَفْعَلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُسْتَثْمِر', plural: ['مُسْتَثْمِرُون', 'مُسْتَثْمِرِين'], english: 'investor', category: 'sound-masc', dialect: 'both', pattern: 'مُسْتَفْعِل → مُسْتَفْعِلُون', grammar_note: 'Sound masculine plural — suffix added to unchanged singular.', quiz_direction: 'singular_to_plural' },

  // ═══════════ Category B: Sound Feminine Plural (sound-fem) ═══════════
  { singular: 'سَيَّارَة', plural: ['سَيَّارَات'], english: 'car', category: 'sound-fem', dialect: 'both', pattern: 'فَعَّالَة → فَعَّالَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'جَامِعَة', plural: ['جَامِعَات'], english: 'university', category: 'sound-fem', dialect: 'both', pattern: 'فاعِلَة → فاعِلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'حُكُومَة', plural: ['حُكُومَات'], english: 'government', category: 'sound-fem', dialect: 'both', pattern: 'فُعُولَة → فُعُولَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'وَزَارَة', plural: ['وَزَارَات'], english: 'ministry', category: 'sound-fem', dialect: 'both', pattern: 'فَعالَة → فَعالَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'ثَلَّاجَة', plural: ['ثَلَّاجَات'], english: 'refrigerator', category: 'sound-fem', dialect: 'both', pattern: 'فَعَّالَة → فَعَّالَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'طَائِرَة', plural: ['طَائِرَات'], english: 'airplane', category: 'sound-fem', dialect: 'both', pattern: 'فاعِلَة → فاعِلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'غَسَّالَة', plural: ['غَسَّالَات'], english: 'washing machine', category: 'sound-fem', dialect: 'both', pattern: 'فَعَّالَة → فَعَّالَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'شَاشَة', plural: ['شَاشَات'], english: 'screen', category: 'sound-fem', dialect: 'both', pattern: 'فاعَلَة → فاعَلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُسْتَشْفَى', plural: ['مُسْتَشْفَيَات'], english: 'hospital', category: 'sound-fem', dialect: 'both', pattern: 'مُسْتَفْعَل → مُسْتَفْعَلَات', grammar_note: 'Sound feminine plural — ـات added directly when no ة.', quiz_direction: 'singular_to_plural' },
  { singular: 'إِمْتِحَان', plural: ['إِمْتِحَانَات'], english: 'exam', category: 'sound-fem', dialect: 'both', pattern: 'إِفْتِعال → إِفْتِعالَات', grammar_note: 'Sound feminine plural — ـات added to masculine masdar.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُحَاضَرَة', plural: ['مُحَاضَرَات'], english: 'lecture', category: 'sound-fem', dialect: 'both', pattern: 'مُفاعَلَة → مُفاعَلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُقَابَلَة', plural: ['مُقَابَلَات'], english: 'interview', category: 'sound-fem', dialect: 'both', pattern: 'مُفاعَلَة → مُفاعَلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُبَارَاة', plural: ['مُبَارَيَات'], english: 'match/game', category: 'sound-fem', dialect: 'both', pattern: 'مُفاعَلَة → مُفاعَلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'تَمْرِين', plural: ['تَمْرِينَات'], english: 'exercise', category: 'sound-fem', dialect: 'both', pattern: 'تَفْعِيل → تَفْعِيلَات', grammar_note: 'Sound feminine plural — ـات added to masculine noun.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُعَامَلَة', plural: ['مُعَامَلَات'], english: 'transaction', category: 'sound-fem', dialect: 'both', pattern: 'مُفاعَلَة → مُفاعَلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'حَافِلَة', plural: ['حَافِلَات'], english: 'bus', category: 'sound-fem', dialect: 'both', pattern: 'فاعِلَة → فاعِلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'دَرَّاجَة', plural: ['دَرَّاجَات'], english: 'bicycle', category: 'sound-fem', dialect: 'both', pattern: 'فَعَّالَة → فَعَّالَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'مَعْلُومَة', plural: ['مَعْلُومَات'], english: 'piece of information', category: 'sound-fem', dialect: 'both', pattern: 'مَفْعُولَة → مَفْعُولَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'حَيَوَان', plural: ['حَيَوَانَات'], english: 'animal', category: 'sound-fem', dialect: 'both', pattern: 'فَعَلان → فَعَلانَات', grammar_note: 'Sound feminine plural — ـات added to masculine noun.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُنَاسَبَة', plural: ['مُنَاسَبَات'], english: 'occasion', category: 'sound-fem', dialect: 'both', pattern: 'مُفاعَلَة → مُفاعَلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'قَنَاة', plural: ['قَنَوَات'], english: 'channel', category: 'sound-fem', dialect: 'both', pattern: 'فَعَالَة → فَعَوَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'أَدَاة', plural: ['أَدَوَات'], english: 'tool', category: 'sound-fem', dialect: 'both', pattern: 'أَفَالَة → أَفَوَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'مَكْتَبَة', plural: ['مَكْتَبَات'], english: 'library', category: 'sound-fem', dialect: 'both', pattern: 'مَفْعَلَة → مَفْعَلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'وَجْبَة', plural: ['وَجْبَات'], english: 'meal', category: 'sound-fem', dialect: 'both', pattern: 'فَعْلَة → فَعْلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُسْتَوْصَفَة', plural: ['مُسْتَوْصَفَات'], english: 'clinic', category: 'sound-fem', dialect: 'both', pattern: 'مُسْتَفْعَلَة → مُسْتَفْعَلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'كَامِيرَا', plural: ['كَامِيرَات'], english: 'camera', category: 'sound-fem', dialect: 'both', pattern: 'loanword → loanword + ات', grammar_note: 'Sound feminine plural — ـات added to loanword.', quiz_direction: 'singular_to_plural' },
  { singular: 'تِلِفِزْيُون', plural: ['تِلِفِزْيُونَات'], english: 'television', category: 'sound-fem', dialect: 'both', pattern: 'loanword → loanword + ات', grammar_note: 'Sound feminine plural — ـات added to loanword.', quiz_direction: 'singular_to_plural' },
  { singular: 'كُمْبْيُوتِر', plural: ['كُمْبْيُوتِرَات'], english: 'computer', category: 'sound-fem', dialect: 'both', pattern: 'loanword → loanword + ات', grammar_note: 'Sound feminine plural — ـات added to loanword.', quiz_direction: 'singular_to_plural' },
  { singular: 'إِيمِيل', plural: ['إِيمِيلَات'], english: 'email', category: 'sound-fem', dialect: 'both', pattern: 'loanword → loanword + ات', grammar_note: 'Sound feminine plural — ـات added to loanword.', quiz_direction: 'singular_to_plural' },
  { singular: 'فِيزَا', plural: ['فِيزَات'], english: 'visa', category: 'sound-fem', dialect: 'both', pattern: 'loanword → loanword + ات', grammar_note: 'Sound feminine plural — ـات added to loanword.', quiz_direction: 'singular_to_plural' },
  { singular: 'مِنْحَة', plural: ['مِنَح', 'مِنْحَات'], english: 'scholarship', category: 'sound-fem', dialect: 'both', pattern: 'فِعْلَة → فِعَل / فِعْلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'خِدْمَة', plural: ['خِدْمَات', 'خَدَمَات'], english: 'service', category: 'sound-fem', dialect: 'both', pattern: 'فِعْلَة → فِعْلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'رِحْلَة', plural: ['رِحْلَات'], english: 'trip', category: 'sound-fem', dialect: 'both', pattern: 'فِعْلَة → فِعْلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُحَادَثَة', plural: ['مُحَادَثَات'], english: 'conversation', category: 'sound-fem', dialect: 'both', pattern: 'مُفاعَلَة → مُفاعَلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُمَارَسَة', plural: ['مُمَارَسَات'], english: 'practice', category: 'sound-fem', dialect: 'both', pattern: 'مُفاعَلَة → مُفاعَلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'مُلَاحَظَة', plural: ['مُلَاحَظَات'], english: 'observation/note', category: 'sound-fem', dialect: 'both', pattern: 'مُفاعَلَة → مُفاعَلَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'إِجَازَة', plural: ['إِجَازَات'], english: 'vacation', category: 'sound-fem', dialect: 'both', pattern: 'إِفَالَة → إِفَالَات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'عَمَلِيَّة', plural: ['عَمَلِيَّات'], english: 'operation/process', category: 'sound-fem', dialect: 'both', pattern: 'فَعَلِيَّة → فَعَلِيَّات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'مَسْؤُولِيَّة', plural: ['مَسْؤُولِيَّات'], english: 'responsibility', category: 'sound-fem', dialect: 'both', pattern: 'مَفْعُولِيَّة → مَفْعُولِيَّات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'شَخْصِيَّة', plural: ['شَخْصِيَّات'], english: 'personality', category: 'sound-fem', dialect: 'both', pattern: 'فَعْلِيَّة → فَعْلِيَّات', grammar_note: 'Sound feminine plural — ة replaced by ـات.', quiz_direction: 'singular_to_plural' },
  { singular: 'نَشَاط', plural: ['نَشَاطَات'], english: 'activity', category: 'sound-fem', dialect: 'both', pattern: 'فَعَال → فَعَالَات', grammar_note: 'Sound feminine plural — ـات added to masculine noun.', quiz_direction: 'singular_to_plural' },

  // ═══════════ Category C: Broken Plural – Human (broken-human) ═══════════
  { singular: 'رَجُل', plural: ['رِجَال'], english: 'man', category: 'broken-human', dialect: 'both', pattern: 'فَعُل → فِعَال', grammar_note: 'Broken plural for human nouns — internal vowel pattern changes. Takes masc. plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'وَلَد', plural: ['أَوْلَاد'], english: 'boy/child', category: 'broken-human', dialect: 'both', pattern: 'فَعَل → أَفْعَال', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'طِفْل', plural: ['أَطْفَال'], english: 'child', category: 'broken-human', dialect: 'both', pattern: 'فِعْل → أَفْعَال', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'صَدِيق', plural: ['أَصْدِقَاء'], english: 'friend', category: 'broken-human', dialect: 'both', pattern: 'فَعِيل → أَفْعِلَاء', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'طَبِيب', plural: ['أَطِبَّاء'], english: 'doctor', category: 'broken-human', dialect: 'both', pattern: 'فَعِيل → أَفْعِلَاء', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'أَخ', plural: ['إِخْوَة', 'إِخْوَان'], english: 'brother', category: 'broken-human', dialect: 'both', pattern: 'فَعْ → إِفْعَلَة', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'كَاتِب', plural: ['كُتَّاب'], english: 'writer', category: 'broken-human', dialect: 'both', pattern: 'فاعِل → فُعَّال', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'عَالِم', plural: ['عُلَمَاء'], english: 'scholar', category: 'broken-human', dialect: 'both', pattern: 'فاعِل → فُعَلَاء', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'شَاعِر', plural: ['شُعَرَاء'], english: 'poet', category: 'broken-human', dialect: 'both', pattern: 'فاعِل → فُعَلَاء', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'وَزِير', plural: ['وُزَرَاء'], english: 'minister', category: 'broken-human', dialect: 'both', pattern: 'فَعِيل → فُعَلَاء', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'أَمِير', plural: ['أُمَرَاء'], english: 'prince', category: 'broken-human', dialect: 'both', pattern: 'فَعِيل → فُعَلَاء', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'رَئِيس', plural: ['رُؤَسَاء'], english: 'president/boss', category: 'broken-human', dialect: 'both', pattern: 'فَعِيل → فُعَلَاء', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'سَفِير', plural: ['سُفَرَاء'], english: 'ambassador', category: 'broken-human', dialect: 'both', pattern: 'فَعِيل → فُعَلَاء', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'فَقِير', plural: ['فُقَرَاء'], english: 'poor person', category: 'broken-human', dialect: 'both', pattern: 'فَعِيل → فُعَلَاء', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'غَنِيّ', plural: ['أَغْنِيَاء'], english: 'rich person', category: 'broken-human', dialect: 'both', pattern: 'فَعِيّ → أَفْعِيَاء', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'جَار', plural: ['جِيرَان'], english: 'neighbor', category: 'broken-human', dialect: 'both', pattern: 'فَعْل → فِعْلَان', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'شَيْخ', plural: ['شُيُوخ', 'مَشَايِخ'], english: 'sheikh/elder', category: 'broken-human', dialect: 'both', pattern: 'فَعْل → فُعُول', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'مَلِك', plural: ['مُلُوك'], english: 'king', category: 'broken-human', dialect: 'both', pattern: 'فَعِل → فُعُول', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'تَاجِر', plural: ['تُجَّار'], english: 'merchant', category: 'broken-human', dialect: 'both', pattern: 'فاعِل → فُعَّال', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'ضَيْف', plural: ['ضُيُوف'], english: 'guest', category: 'broken-human', dialect: 'both', pattern: 'فَعْل → فُعُول', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'لِصّ', plural: ['لُصُوص'], english: 'thief', category: 'broken-human', dialect: 'both', pattern: 'فِعّ → فُعُول', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'جُنْدِيّ', plural: ['جُنُود'], english: 'soldier', category: 'broken-human', dialect: 'both', pattern: 'فُعْلِيّ → فُعُول', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'عَبْد', plural: ['عَبِيد', 'عِبَاد'], english: 'servant/worshiper', category: 'broken-human', dialect: 'both', pattern: 'فَعْل → فَعِيل', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'أُسْتَاذ', plural: ['أَسَاتِذَة', 'أَسَاتِيذ'], english: 'professor', category: 'broken-human', dialect: 'both', pattern: 'أُفْعَال → أَفَاعِلَة', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'تِلْمِيذ', plural: ['تَلَامِيذ', 'تَلَامِذَة'], english: 'pupil', category: 'broken-human', dialect: 'both', pattern: 'فِعْلِيل → فَعَالِيل', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'طَبَّاخ', plural: ['طَبَّاخُون', 'طُبَّاخ'], english: 'cook', category: 'broken-human', dialect: 'both', pattern: 'فَعَّال → فُعَّال', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'سَائِح', plural: ['سُيَّاح'], english: 'tourist', category: 'broken-human', dialect: 'both', pattern: 'فاعِل → فُعَّال', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'رَاكِب', plural: ['رُكَّاب'], english: 'passenger', category: 'broken-human', dialect: 'both', pattern: 'فاعِل → فُعَّال', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'نَبِيّ', plural: ['أَنْبِيَاء'], english: 'prophet', category: 'broken-human', dialect: 'both', pattern: 'فَعِيّ → أَفْعِيَاء', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'بَطَل', plural: ['أَبْطَال'], english: 'hero', category: 'broken-human', dialect: 'both', pattern: 'فَعَل → أَفْعَال', grammar_note: 'Broken plural for human nouns — takes masculine plural agreement.', quiz_direction: 'singular_to_plural' },

  // ═══════════ Category D: Broken Plural – Non-human (broken-nonhuman) ═══════════
  { singular: 'كِتَاب', plural: ['كُتُب'], english: 'book', category: 'broken-nonhuman', dialect: 'both', pattern: 'فِعَال → فُعُل', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement. هذه الكتب جميلة ✓', quiz_direction: 'singular_to_plural' },
  { singular: 'قَلَم', plural: ['أَقْلَام'], english: 'pen', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعَل → أَفْعَال', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'بَيْت', plural: ['بُيُوت'], english: 'house', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعْل → فُعُول', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'قَلْب', plural: ['قُلُوب'], english: 'heart', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعْل → فُعُول', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'غُرْفَة', plural: ['غُرَف'], english: 'room', category: 'broken-nonhuman', dialect: 'both', pattern: 'فُعْلَة → فُعَل', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'صُورَة', plural: ['صُوَر'], english: 'picture', category: 'broken-nonhuman', dialect: 'both', pattern: 'فُعْلَة → فُعَل', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'شَارِع', plural: ['شَوَارِع'], english: 'street', category: 'broken-nonhuman', dialect: 'both', pattern: 'فاعِل → فَوَاعِل', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'مَدْرَسَة', plural: ['مَدَارِس'], english: 'school', category: 'broken-nonhuman', dialect: 'both', pattern: 'مَفْعَلَة → مَفَاعِل', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'مَكْتَب', plural: ['مَكَاتِب'], english: 'office/desk', category: 'broken-nonhuman', dialect: 'both', pattern: 'مَفْعَل → مَفَاعِل', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'سِلَاح', plural: ['أَسْلِحَة'], english: 'weapon', category: 'broken-nonhuman', dialect: 'both', pattern: 'فِعَال → أَفْعِلَة', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'بَاب', plural: ['أَبْوَاب'], english: 'door', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعْل → أَفْعَال', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'لَوْن', plural: ['أَلْوَان'], english: 'color', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعْل → أَفْعَال', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'عَيْن', plural: ['عُيُون'], english: 'eye', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعْل → فُعُول', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'جِسْم', plural: ['أَجْسَام'], english: 'body', category: 'broken-nonhuman', dialect: 'both', pattern: 'فِعْل → أَفْعَال', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'نَهْر', plural: ['أَنْهَار'], english: 'river', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعْل → أَفْعَال', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'جَبَل', plural: ['جِبَال'], english: 'mountain', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعَل → فِعَال', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'بَحْر', plural: ['بِحَار', 'أَبْحُر'], english: 'sea', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعْل → فِعَال', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'دَرْس', plural: ['دُرُوس'], english: 'lesson', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعْل → فُعُول', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'فَصْل', plural: ['فُصُول'], english: 'season/chapter', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعْل → فُعُول', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'عَقْل', plural: ['عُقُول'], english: 'mind', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعْل → فُعُول', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'حَقّ', plural: ['حُقُوق'], english: 'right/truth', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعّ → فُعُول', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'شَكْل', plural: ['أَشْكَال'], english: 'shape/form', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعْل → أَفْعَال', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'مَسْجِد', plural: ['مَسَاجِد'], english: 'mosque', category: 'broken-nonhuman', dialect: 'both', pattern: 'مَفْعِل → مَفَاعِل', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'مَفْتَاح', plural: ['مَفَاتِيح'], english: 'key', category: 'broken-nonhuman', dialect: 'both', pattern: 'مِفْعَال → مَفَاعِيل', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'رِسَالَة', plural: ['رَسَائِل'], english: 'letter/message', category: 'broken-nonhuman', dialect: 'both', pattern: 'فِعَالَة → فَعَائِل', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'جَرِيدَة', plural: ['جَرَائِد'], english: 'newspaper', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعِيلَة → فَعَائِل', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'مَدِينَة', plural: ['مُدُن'], english: 'city', category: 'broken-nonhuman', dialect: 'both', pattern: 'مَفِيلَة → فُعُل', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'سُوق', plural: ['أَسْوَاق'], english: 'market', category: 'broken-nonhuman', dialect: 'both', pattern: 'فُعْل → أَفْعَال', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'طَرِيق', plural: ['طُرُق'], english: 'road', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعِيل → فُعُل', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'سَبَب', plural: ['أَسْبَاب'], english: 'reason', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعَل → أَفْعَال', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'ثَوْب', plural: ['ثِيَاب'], english: 'garment', category: 'broken-nonhuman', dialect: 'both', pattern: 'فَعْل → فِيَال', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },
  { singular: 'حِزْب', plural: ['أَحْزَاب'], english: 'party (political)', category: 'broken-nonhuman', dialect: 'both', pattern: 'فِعْل → أَفْعَال', grammar_note: 'Non-human broken plural — takes FEMININE SINGULAR agreement.', quiz_direction: 'singular_to_plural' },

  // ═══════════ Category E: Collective Nouns (collective) ═══════════
  { singular: 'شَجَرَة', plural: ['شَجَر'], english: 'tree', category: 'collective', dialect: 'both', pattern: 'فَعَلَة → فَعَل', grammar_note: 'Collective noun — remove ة to get the collective. شَجَرَة (one tree) → شَجَر (trees).', quiz_direction: 'collective' },
  { singular: 'بَقَرَة', plural: ['بَقَر'], english: 'cow', category: 'collective', dialect: 'both', pattern: 'فَعَلَة → فَعَل', grammar_note: 'Collective noun — remove ة. بَقَرَة (one cow) → بَقَر (cattle).', quiz_direction: 'collective' },
  { singular: 'دَجَاجَة', plural: ['دَجَاج'], english: 'chicken', category: 'collective', dialect: 'both', pattern: 'فَعَالَة → فَعَال', grammar_note: 'Collective noun — remove ة. دَجَاجَة (one chicken) → دَجَاج (poultry).', quiz_direction: 'collective' },
  { singular: 'تُفَّاحَة', plural: ['تُفَّاح'], english: 'apple', category: 'collective', dialect: 'both', pattern: 'فُعَّالَة → فُعَّال', grammar_note: 'Collective noun — remove ة. تُفَّاحَة (one apple) → تُفَّاح (apples).', quiz_direction: 'collective' },
  { singular: 'بَصَلَة', plural: ['بَصَل'], english: 'onion', category: 'collective', dialect: 'both', pattern: 'فَعَلَة → فَعَل', grammar_note: 'Collective noun — remove ة. بَصَلَة (one onion) → بَصَل (onions).', quiz_direction: 'collective' },
  { singular: 'وَرَقَة', plural: ['وَرَق'], english: 'leaf/paper', category: 'collective', dialect: 'both', pattern: 'فَعَلَة → فَعَل', grammar_note: 'Collective noun — remove ة. وَرَقَة (one leaf) → وَرَق (leaves).', quiz_direction: 'collective' },
  { singular: 'زَيْتُونَة', plural: ['زَيْتُون'], english: 'olive', category: 'collective', dialect: 'both', pattern: 'فَعْلُونَة → فَعْلُون', grammar_note: 'Collective noun — remove ة. زَيْتُونَة (one olive) → زَيْتُون (olives).', quiz_direction: 'collective' },
  { singular: 'نَخْلَة', plural: ['نَخْل', 'نَخِيل'], english: 'palm tree', category: 'collective', dialect: 'both', pattern: 'فَعْلَة → فَعْل', grammar_note: 'Collective noun — remove ة. نَخْلَة (one palm) → نَخْل (palms).', quiz_direction: 'collective' },
  { singular: 'سَمَكَة', plural: ['سَمَك'], english: 'fish', category: 'collective', dialect: 'both', pattern: 'فَعَلَة → فَعَل', grammar_note: 'Collective noun — remove ة. سَمَكَة (one fish) → سَمَك (fish).', quiz_direction: 'collective' },
  { singular: 'نَحْلَة', plural: ['نَحْل'], english: 'bee', category: 'collective', dialect: 'both', pattern: 'فَعْلَة → فَعْل', grammar_note: 'Collective noun — remove ة. نَحْلَة (one bee) → نَحْل (bees).', quiz_direction: 'collective' },
  { singular: 'نَمْلَة', plural: ['نَمْل'], english: 'ant', category: 'collective', dialect: 'both', pattern: 'فَعْلَة → فَعْل', grammar_note: 'Collective noun — remove ة. نَمْلَة (one ant) → نَمْل (ants).', quiz_direction: 'collective' },
  { singular: 'حَمَامَة', plural: ['حَمَام'], english: 'pigeon', category: 'collective', dialect: 'both', pattern: 'فَعَالَة → فَعَال', grammar_note: 'Collective noun — remove ة. حَمَامَة (one pigeon) → حَمَام (pigeons).', quiz_direction: 'collective' },
  { singular: 'بَطَّة', plural: ['بَطّ'], english: 'duck', category: 'collective', dialect: 'both', pattern: 'فَعَّة → فَعّ', grammar_note: 'Collective noun — remove ة. بَطَّة (one duck) → بَطّ (ducks).', quiz_direction: 'collective' },
  { singular: 'بُرْتُقَالَة', plural: ['بُرْتُقَال'], english: 'orange', category: 'collective', dialect: 'both', pattern: 'loanword + ة → loanword', grammar_note: 'Collective noun — remove ة. بُرْتُقَالَة (one orange) → بُرْتُقَال (oranges).', quiz_direction: 'collective' },
  { singular: 'مَوْزَة', plural: ['مَوْز'], english: 'banana', category: 'collective', dialect: 'both', pattern: 'فَعْلَة → فَعْل', grammar_note: 'Collective noun — remove ة. مَوْزَة (one banana) → مَوْز (bananas).', quiz_direction: 'collective' },
  { singular: 'عِنَبَة', plural: ['عِنَب'], english: 'grape', category: 'collective', dialect: 'both', pattern: 'فِعَلَة → فِعَل', grammar_note: 'Collective noun — remove ة. عِنَبَة (one grape) → عِنَب (grapes).', quiz_direction: 'collective' },
  { singular: 'تِينَة', plural: ['تِين'], english: 'fig', category: 'collective', dialect: 'both', pattern: 'فِيلَة → فِيل', grammar_note: 'Collective noun — remove ة. تِينَة (one fig) → تِين (figs).', quiz_direction: 'collective' },
  { singular: 'تَمْرَة', plural: ['تَمْر'], english: 'date fruit', category: 'collective', dialect: 'both', pattern: 'فَعْلَة → فَعْل', grammar_note: 'Collective noun — remove ة. تَمْرَة (one date) → تَمْر (dates).', quiz_direction: 'collective' },
  { singular: 'جَوْزَة', plural: ['جَوْز'], english: 'walnut', category: 'collective', dialect: 'both', pattern: 'فَعْلَة → فَعْل', grammar_note: 'Collective noun — remove ة. جَوْزَة (one walnut) → جَوْز (walnuts).', quiz_direction: 'collective' },
  { singular: 'لَوْزَة', plural: ['لَوْز'], english: 'almond', category: 'collective', dialect: 'both', pattern: 'فَعْلَة → فَعْل', grammar_note: 'Collective noun — remove ة. لَوْزَة (one almond) → لَوْز (almonds).', quiz_direction: 'collective' },
  { singular: 'بَيْضَة', plural: ['بَيْض'], english: 'egg', category: 'collective', dialect: 'both', pattern: 'فَعْلَة → فَعْل', grammar_note: 'Collective noun — remove ة. بَيْضَة (one egg) → بَيْض (eggs).', quiz_direction: 'collective' },
  { singular: 'حَبَّة', plural: ['حَبّ'], english: 'grain/seed', category: 'collective', dialect: 'both', pattern: 'فَعَّة → فَعّ', grammar_note: 'Collective noun — remove ة. حَبَّة (one grain) → حَبّ (grain).', quiz_direction: 'collective' },
  { singular: 'قَمْحَة', plural: ['قَمْح'], english: 'wheat grain', category: 'collective', dialect: 'both', pattern: 'فَعْلَة → فَعْل', grammar_note: 'Collective noun — remove ة. قَمْحَة (one grain) → قَمْح (wheat).', quiz_direction: 'collective' },
  { singular: 'ذُرَة', plural: ['ذُرّ'], english: 'corn/maize', category: 'collective', dialect: 'both', pattern: 'فُعَلَة → فُعّ', grammar_note: 'Collective noun — remove ة. ذُرَة (one corn) → ذُرّ (corn).', quiz_direction: 'collective' },
  { singular: 'رُمَّانَة', plural: ['رُمَّان'], english: 'pomegranate', category: 'collective', dialect: 'both', pattern: 'فُعَّالَة → فُعَّال', grammar_note: 'Collective noun — remove ة. رُمَّانَة (one pomegranate) → رُمَّان (pomegranates).', quiz_direction: 'collective' },
  { singular: 'تُوتَة', plural: ['تُوت'], english: 'mulberry', category: 'collective', dialect: 'both', pattern: 'فُولَة → فُول', grammar_note: 'Collective noun — remove ة. تُوتَة (one mulberry) → تُوت (mulberries).', quiz_direction: 'collective' },
  { singular: 'فُولَة', plural: ['فُول'], english: 'fava bean', category: 'collective', dialect: 'both', pattern: 'فُولَة → فُول', grammar_note: 'Collective noun — remove ة. فُولَة (one bean) → فُول (beans).', quiz_direction: 'collective' },
  { singular: 'حُمُّصَة', plural: ['حُمُّص'], english: 'chickpea', category: 'collective', dialect: 'both', pattern: 'فُعُّلَة → فُعُّل', grammar_note: 'Collective noun — remove ة. حُمُّصَة (one chickpea) → حُمُّص (chickpeas).', quiz_direction: 'collective' },
  { singular: 'عَدَسَة', plural: ['عَدَس'], english: 'lentil', category: 'collective', dialect: 'both', pattern: 'فَعَلَة → فَعَل', grammar_note: 'Collective noun — remove ة. عَدَسَة (one lentil) → عَدَس (lentils).', quiz_direction: 'collective' },
  { singular: 'خَوْخَة', plural: ['خَوْخ'], english: 'peach', category: 'collective', dialect: 'both', pattern: 'فَعْلَة → فَعْل', grammar_note: 'Collective noun — remove ة. خَوْخَة (one peach) → خَوْخ (peaches).', quiz_direction: 'collective' },

  // ═══════════ Category F: Irregular / Suppletive (irregular) ═══════════
  { singular: 'امْرَأَة', plural: ['نِسَاء'], english: 'woman', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — completely different root. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'إِنْسَان', plural: ['نَاس', 'بَشَر'], english: 'human', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — completely different root. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'أَب', plural: ['آبَاء'], english: 'father', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — completely different root. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'أُمّ', plural: ['أُمَّهَات'], english: 'mother', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — completely different root. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'ابْن', plural: ['أَبْنَاء'], english: 'son', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — completely different root. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'ابْنَة', plural: ['بَنَات'], english: 'daughter', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — completely different root. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'فَم', plural: ['أَفْوَاه'], english: 'mouth', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — completely different root. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'يَد', plural: ['أَيْدٍ', 'أَيَادٍ'], english: 'hand', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — completely different root. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'مَاء', plural: ['مِيَاه'], english: 'water', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — completely different root. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'أُخْت', plural: ['أَخَوَات'], english: 'sister', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — completely different root. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'شَفَة', plural: ['شِفَاه'], english: 'lip', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — completely different root. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'ذُو', plural: ['أُولُو', 'ذَوُو'], english: 'possessor of', category: 'irregular', dialect: 'fusha', pattern: 'suppletive', grammar_note: 'Suppletive plural — completely different root. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'امْرُؤ', plural: ['رِجَال'], english: 'man (formal)', category: 'irregular', dialect: 'fusha', pattern: 'suppletive', grammar_note: 'Suppletive plural — completely different root. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'حِصَان', plural: ['خُيُول', 'أَحْصِنَة'], english: 'horse', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — خُيُول from different root خ-ي-ل. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'عَرُوس', plural: ['عَرَائِس'], english: 'bride/groom', category: 'irregular', dialect: 'both', pattern: 'فَعُول → فَعائِل', grammar_note: 'Suppletive plural — irregular pattern shift. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'أَرْض', plural: ['أَرَاضٍ'], english: 'land/earth', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — unusual pattern. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'سَمَاء', plural: ['سَمَاوَات', 'سَمَوَات'], english: 'sky', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — unusual pattern. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'لَيْلَة', plural: ['لَيَالٍ'], english: 'night', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — unusual pattern. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'سَنَة', plural: ['سَنَوَات', 'سِنُون', 'سِنِين'], english: 'year', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — multiple accepted forms. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'شَيْء', plural: ['أَشْيَاء'], english: 'thing', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — unusual diptote form. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'اِسْم', plural: ['أَسْمَاء'], english: 'name', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — unusual pattern. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'عُضْو', plural: ['أَعْضَاء'], english: 'member/organ', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — unusual pattern. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'أَسَاس', plural: ['أُسُس'], english: 'foundation', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — shortened form. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'حَدِيث', plural: ['أَحَادِيث'], english: 'narration/talk', category: 'irregular', dialect: 'both', pattern: 'فَعِيل → أَفَاعِيل', grammar_note: 'Suppletive plural — unusual extended pattern. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'مِفْتَاح', plural: ['مَفَاتِيح'], english: 'key', category: 'irregular', dialect: 'both', pattern: 'مِفْعال → مَفاعِيل', grammar_note: 'Suppletive plural — unusual extended pattern. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'عَنْكَبُوت', plural: ['عَنَاكِب'], english: 'spider', category: 'irregular', dialect: 'both', pattern: 'فَعْلَلُوت → فَعَالِل', grammar_note: 'Suppletive plural — quadriliteral root truncation. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'تِلْفَاز', plural: ['تَلَافِيز'], english: 'TV (colloquial)', category: 'irregular', dialect: 'both', pattern: 'loanword → broken plural', grammar_note: 'Suppletive plural — loanword with broken plural. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'فِلْم', plural: ['أَفْلَام'], english: 'film', category: 'irregular', dialect: 'both', pattern: 'loanword → أَفْعَال', grammar_note: 'Loanword taking Arabic broken plural pattern. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'بِنْت', plural: ['بَنَات'], english: 'girl', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — sound fem plural from different base. Must be memorized.', quiz_direction: 'singular_to_plural' },
  { singular: 'أَخ', plural: ['إِخْوَة', 'إِخْوَان'], english: 'brother', category: 'irregular', dialect: 'both', pattern: 'suppletive', grammar_note: 'Suppletive plural — unusual pattern. Must be memorized.', quiz_direction: 'singular_to_plural' },

  // ═══════════ Category G: Shaami-Specific (shaami) ═══════════
  { singular: 'زَلَمَة', plural: ['زَلَم'], english: 'man (colloquial)', category: 'shaami', dialect: 'shaami', pattern: 'Shaami collective', grammar_note: 'Levantine — colloquial vocabulary with unique plural. Always ـين for sound masc.', quiz_direction: 'singular_to_plural' },
  { singular: 'شَبّ', plural: ['شَبَاب'], english: 'young man', category: 'shaami', dialect: 'shaami', pattern: 'فَعّ → فَعَال', grammar_note: 'Levantine — colloquial vocabulary with unique plural.', quiz_direction: 'singular_to_plural' },
  { singular: 'صَبِيّ', plural: ['صُبْيَان'], english: 'boy', category: 'shaami', dialect: 'shaami', pattern: 'فَعِيّ → فُعْلَان', grammar_note: 'Levantine — always ـين for sound masc (no ـون).', quiz_direction: 'singular_to_plural' },
  { singular: 'كَارْت', plural: ['كُرُوت'], english: 'card', category: 'shaami', dialect: 'shaami', pattern: 'loanword → broken plural', grammar_note: 'Levantine — short loanwords take broken plurals.', quiz_direction: 'singular_to_plural' },
  { singular: 'بَنْك', plural: ['بُنُوك'], english: 'bank', category: 'shaami', dialect: 'shaami', pattern: 'loanword → فُعُول', grammar_note: 'Levantine — short loanwords take broken plurals.', quiz_direction: 'singular_to_plural' },
  { singular: 'دُكَّان', plural: ['دَكَاكِين'], english: 'shop', category: 'shaami', dialect: 'shaami', pattern: 'فُعَّال → فَعَاعِيل', grammar_note: 'Levantine — common Shaami broken plural.', quiz_direction: 'singular_to_plural' },
  { singular: 'بَلَد', plural: ['بِلَاد'], english: 'country', category: 'shaami', dialect: 'shaami', pattern: 'فَعَل → فِعَال', grammar_note: 'Levantine — used in both Fusha and Shaami but common in dialect.', quiz_direction: 'singular_to_plural' },
  { singular: 'جَامِع', plural: ['جَوَامِع'], english: 'mosque (Shaami)', category: 'shaami', dialect: 'shaami', pattern: 'فاعِل → فَوَاعِل', grammar_note: 'Levantine — broken plural borrowed from Fusha with vowel shifts.', quiz_direction: 'singular_to_plural' },
  { singular: 'بَيَّاع', plural: ['بَيَّاعِين'], english: 'vendor', category: 'shaami', dialect: 'shaami', pattern: 'فَعَّال → فَعَّالِين', grammar_note: 'Levantine — always ـين for sound masc (no ـون).', quiz_direction: 'singular_to_plural' },
  { singular: 'أُسْتَاز', plural: ['أَسَاتْزِه'], english: 'teacher (Shaami)', category: 'shaami', dialect: 'shaami', pattern: 'Shaami variant', grammar_note: 'Levantine — Shaami pronunciation variant with broken plural.', quiz_direction: 'singular_to_plural' },
  { singular: 'حَارَة', plural: ['حَارَات'], english: 'alley/neighborhood', category: 'shaami', dialect: 'shaami', pattern: 'فاعَلَة → فاعَلَات', grammar_note: 'Levantine — common Shaami vocabulary.', quiz_direction: 'singular_to_plural' },
  { singular: 'كَنِيسَة', plural: ['كَنَايِس'], english: 'church', category: 'shaami', dialect: 'shaami', pattern: 'فَعِيلَة → فَعايِل', grammar_note: 'Levantine — broken plural common in Shaami.', quiz_direction: 'singular_to_plural' },
  { singular: 'مِشْوَار', plural: ['مَشَاوِير'], english: 'errand/trip', category: 'shaami', dialect: 'shaami', pattern: 'مِفْعال → مَفاعِيل', grammar_note: 'Levantine — Shaami-specific vocabulary.', quiz_direction: 'singular_to_plural' },
  { singular: 'طَبْخَة', plural: ['طَبْخَات'], english: 'dish/recipe', category: 'shaami', dialect: 'shaami', pattern: 'فَعْلَة → فَعْلَات', grammar_note: 'Levantine — Shaami culinary vocabulary.', quiz_direction: 'singular_to_plural' },
  { singular: 'بَسْطَة', plural: ['بَسْطَات'], english: 'stall/stand', category: 'shaami', dialect: 'shaami', pattern: 'فَعْلَة → فَعْلَات', grammar_note: 'Levantine — Shaami marketplace vocabulary.', quiz_direction: 'singular_to_plural' },
  { singular: 'جَزْمَة', plural: ['جَزْمَات'], english: 'shoe (Shaami)', category: 'shaami', dialect: 'shaami', pattern: 'فَعْلَة → فَعْلَات', grammar_note: 'Levantine — Shaami-only vocabulary.', quiz_direction: 'singular_to_plural' },
  { singular: 'بَرَّاد', plural: ['بَرَّادَات'], english: 'fridge (Shaami)', category: 'shaami', dialect: 'shaami', pattern: 'فَعَّال → فَعَّالَات', grammar_note: 'Levantine — Shaami household vocabulary.', quiz_direction: 'singular_to_plural' },
  { singular: 'طَنْجَرَة', plural: ['طَنَاجِر'], english: 'pot/pan', category: 'shaami', dialect: 'shaami', pattern: 'فَعْلَلَة → فَعالِل', grammar_note: 'Levantine — Shaami cooking vocabulary.', quiz_direction: 'singular_to_plural' },
  { singular: 'سَكِّين', plural: ['سَكَاكِين'], english: 'knife', category: 'shaami', dialect: 'shaami', pattern: 'فَعِّيل → فَعاعِيل', grammar_note: 'Levantine — common in Shaami kitchen vocabulary.', quiz_direction: 'singular_to_plural' },
  { singular: 'فَنْجَان', plural: ['فَنَاجِين'], english: 'cup', category: 'shaami', dialect: 'shaami', pattern: 'فَعْلَان → فَعالِين', grammar_note: 'Levantine — Shaami household vocabulary.', quiz_direction: 'singular_to_plural' },
  { singular: 'كَبَّايَة', plural: ['كَبَّايَات'], english: 'glass/cup', category: 'shaami', dialect: 'shaami', pattern: 'فَعَّالَة → فَعَّالَات', grammar_note: 'Levantine — Shaami household vocabulary.', quiz_direction: 'singular_to_plural' },
  { singular: 'بَاص', plural: ['بَاصَات'], english: 'bus (Shaami)', category: 'shaami', dialect: 'shaami', pattern: 'loanword → loanword + ات', grammar_note: 'Levantine — loanword with sound feminine plural.', quiz_direction: 'singular_to_plural' },
  { singular: 'سِرْفِيس', plural: ['سِرْفِيسَات', 'سَرَافِيس'], english: 'shared taxi', category: 'shaami', dialect: 'shaami', pattern: 'loanword → mixed', grammar_note: 'Levantine — loanword unique to Shaami transport.', quiz_direction: 'singular_to_plural' },
  { singular: 'دَفْتَر', plural: ['دَفَاتِر'], english: 'notebook', category: 'shaami', dialect: 'shaami', pattern: 'فَعْلَل → فَعالِل', grammar_note: 'Levantine — common in Shaami school vocabulary.', quiz_direction: 'singular_to_plural' },
  { singular: 'خِزَانَة', plural: ['خَزَانَات', 'خَزَاين'], english: 'wardrobe', category: 'shaami', dialect: 'shaami', pattern: 'فِعالَة → فَعالات', grammar_note: 'Levantine — Shaami household vocabulary.', quiz_direction: 'singular_to_plural' },
  { singular: 'سَنْدَوِيشَة', plural: ['سَنْدَوِيشَات'], english: 'sandwich', category: 'shaami', dialect: 'shaami', pattern: 'loanword + ة → loanword + ات', grammar_note: 'Levantine — Shaami food loanword.', quiz_direction: 'singular_to_plural' },
  { singular: 'مَعْلَمِيَّة', plural: ['مَعْلَمِيَّات'], english: 'female teacher (Shaami)', category: 'shaami', dialect: 'shaami', pattern: 'فَعْلَلِيَّة → فَعْلَلِيَّات', grammar_note: 'Levantine — Shaami profession vocabulary.', quiz_direction: 'singular_to_plural' },
  { singular: 'زَنْقَة', plural: ['زْنَاقَات', 'زَنَاقِي'], english: 'narrow alley', category: 'shaami', dialect: 'shaami', pattern: 'فَعْلَة → فَعَاقَات', grammar_note: 'Levantine — Shaami urban vocabulary.', quiz_direction: 'singular_to_plural' },
  { singular: 'بُسْطَار', plural: ['بَسَاطِير'], english: 'boot', category: 'shaami', dialect: 'shaami', pattern: 'فُعْلَار → فَعالِير', grammar_note: 'Levantine — Shaami clothing vocabulary.', quiz_direction: 'singular_to_plural' },
  { singular: 'كَعْكَة', plural: ['كَعْكَات', 'كَعْك'], english: 'cake/cookie', category: 'shaami', dialect: 'shaami', pattern: 'فَعْلَة → فَعْلَات', grammar_note: 'Levantine — Shaami food vocabulary.', quiz_direction: 'singular_to_plural' },
];

/** Get words filtered by selected categories and dialect */
export function getFilteredWords(
  selectedCategories: CategoryId[],
  dialect: 'fusha' | 'shaami' | 'both'
): PluralWord[] {
  return WORD_BANK.filter(w => {
    if (!selectedCategories.includes(w.category)) return false;
    if (dialect === 'both') return true;
    return w.dialect === dialect || w.dialect === 'both';
  });
}

/** Shuffle array in place (Fisher-Yates) */
export function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
