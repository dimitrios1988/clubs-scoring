/**
 * Static "about" metadata shown in the About dialog. Kept here as a single
 * source of truth so strings aren't scattered across templates.
 *
 * NOTE: `version` mirrors the "version" field in package.json — update both
 * together (the package.json value isn't imported to keep it out of the bundle).
 */
export const appInfo = {
  name: 'Clubs Scoring',
  version: '2026.07.08',
  year: 2026,
  creator: 'Dimitrios Chondrokoukis',
  email: 'dimitrios1988@msn.com',
  website: 'https://weallrun.gr',
} as const;
