// The app can be deployed under a sub-path (not the domain root), so any asset path
// built at runtime (template strings, string concatenation) must be resolved against
// Vite's configured `base` instead of assumed to be root-relative. Static references
// that Vite can see at build time (CSS url(), index.html tags, statically-analyzable
// `:src="'/foo.png'"` literals) are already rewritten automatically by Vite's `base`
// handling and don't need this — this is only for paths assembled dynamically in JS.
export function asset(path) {
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : base + '/'
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  return normalizedBase + normalizedPath
}
