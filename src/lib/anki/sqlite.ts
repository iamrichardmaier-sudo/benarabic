import type { SqlJsStatic } from 'sql.js';

let loading: Promise<SqlJsStatic> | null = null;

/**
 * SQLite in the browser, loaded the first time an Anki file is touched.
 *
 * An .apkg is a zip holding a SQLite database, so reading or writing one needs
 * a real SQLite engine. That is a ~600 KB WebAssembly download nobody should
 * pay for on every visit, hence the dynamic imports: the app's main bundle
 * never sees it, and the wasm file is fetched only when someone opens the
 * Anki screen and picks a file.
 */
export function loadSql(): Promise<SqlJsStatic> {
  if (!loading) {
    loading = (async () => {
      const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([
        import('sql.js'),
        import('sql.js/dist/sql-wasm.wasm?url'),
      ]);
      return initSqlJs({ locateFile: () => wasmUrl });
    })();
    // A failed load must be retryable rather than cached forever.
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}
