// Browser stub for Node's `node:module` builtin.
// The protocol barrel re-exports SqliteStore, which imports `node:module`
// via `createRequire`. The demo never touches SqliteStore, so we stub the
// builtin to an empty module so Rollup can bundle the browser-safe subset
// of @auth/protocol without pulling in better-sqlite3.
export function createRequire(): unknown {
  return () => {
    throw new Error("createRequire is not available in the browser");
  };
}
