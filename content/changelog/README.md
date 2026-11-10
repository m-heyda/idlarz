# Release notes

One `.md` file per version, named `<version>.md` (`0.1.0.md`). The landing page (`/`) shows them in its Changelog window, newest first by semver (not by file name or date), one collapsible row per version, the newest open. They are read at build time by `src/lib/changelogFiles.ts`; `tests/ui/changelog.test.ts` fails when a file here is malformed, so a typo never reaches the page.

## Format

```md
# 0.2.0 - Short title
date: 2026-11-20

- First change, one short line.
- Second change, with a **bold** word.
```

- Line 1: `# <version> - <title>`. The version is `major.minor.patch` (digits only) and must equal the file name.
- Line 2: `date: YYYY-MM-DD` (a real calendar date).
- Then a blank line and the body: paragraphs (separated by blank lines) and `-` bullet lists, in any mix. The only inline markup is `**bold**`. Nothing else (no headings, links, code, html) is allowed.
- Write for players: what changed in the game, not how.

`README.md` is not a release note and is skipped.

## Who writes them

On request ("write the release notes"), the assistant collects the PRs merged since the last version, drops what players cannot see (refactors, docs, tests), and writes `content/changelog/<next version>.md`.
