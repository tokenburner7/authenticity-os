// Browser stub for Node's `node:module` builtin.
//
// The protocol barrel re-exports SqliteStore, whose module has top-level code:
//   const require = createRequire(import.meta.url);
//   const Database = require("better-sqlite3");   // <- called at module load
// The widget never constructs SqliteStore, so we redirect both `node:module`
// and `better-sqlite3` to this stub. `createRequire` returns a function that
// returns a newable constructor, so the top-level `require(...)` call succeeds
// and module loading completes; only an actual `new SqliteStore(...)` would
// throw — which the widget never does.

/** A constructor that throws the moment anyone instantiates it. */
const InertCtor = function Noop(): unknown {
  throw new Error("SqliteStore is not available in the browser");
};

export function createRequire(): (id: string) => unknown {
  return () => InertCtor;
}

// Used when `better-sqlite3` is imported as a default/typeof import.
export default InertCtor;
