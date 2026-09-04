/**
 * The Bible reader's chapter loader.
 *
 * Now a thin re-export: the implementation moved to useChapterText, which
 * serves both the Bible's static JSON and the private texts held per reader in
 * the database. Kept as its own module so the Bible call sites and their tests
 * read the same as they always did.
 */
export { useBibleChapter } from './useChapterText';
