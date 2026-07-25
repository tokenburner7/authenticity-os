// Browser stub for node:module — never called at runtime in the browser.
// The protocol's sqlite-store uses createRequire at module load time,
// but the brand portal never constructs a SqliteStore.

const InertCtor = function Noop(): unknown {
  throw new Error("node:module is not available in the browser");
};

export function createRequire(): (id: string) => unknown {
  return () => InertCtor;
}

export default InertCtor;