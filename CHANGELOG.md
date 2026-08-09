# Changelog

All notable changes to FileScope are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.2] - 2026-08-09

The first release of FileScope, forked from
[dsyx/vsc-file-properties](https://github.com/dsyx/vsc-file-properties) 2.0.0 and continuing
its version line. Every setting is renamed, so this release is not configuration-compatible
with the original.

### Added

- Owner and group are resolved to names instead of bare `uid`/`gid`, cached per id
  and switchable via `filescope.ownership.resolveNames`.
- `birthtime` is a first-class property in both the status bar and the details panel,
  and is omitted rather than shown as the epoch where the file system records none.
- The set and order of status bar properties is configurable through
  `filescope.statusBar.items`, replacing one boolean setting per property.
- A Markdown tooltip summarising the file, and a type icon on the status bar item.
- Symbolic links report their target and whether it resolves.
- Relative timestamps via `filescope.time.relative`; the details panel always shows both.
- The active file is watched, so external changes — `chmod`, a rebase, a build — refresh
  the display without a click.
- `FileScope: Refresh File Properties` command, and both commands are now declared in the
  manifest, so they appear in the Command Palette.

### Changed

- Declared `extensionKind: ["workspace"]`, so over Remote-SSH, WSL, Dev Containers and
  Codespaces the extension runs where the file is and reads the remote file system.
- Non-`file` URIs fall back to the workspace file system provider instead of being ignored,
  with the reduced set of available properties stated explicitly.
- The active resource is tracked through `window.tabGroups`, so image previews, notebooks,
  diffs and custom editors are covered — previously only text editors were.
- Permissions render setuid, setgid and sticky bits, alongside the octal form and a type
  character, matching `ls -l`.
- Byte-sized files no longer render a meaningless fractional part (`512 B`, not `512.00 B`).
- The details panel is themed with editor variables rather than fixed borders, and its layout
  adapts to the panel width: label and value stack in a narrow side column, where a fixed label
  column would squeeze paths into a few characters per line, and split into two columns once
  there is room.
- Build moved from webpack to esbuild, linting to ESLint flat config, tests to
  `@vscode/test-cli`. Minimum supported VS Code is now 1.96.

### Fixed

- File names and paths are HTML-escaped in the details panel, and the webview carries a
  restrictive Content-Security-Policy with scripts disabled. Previously a file name
  containing markup was injected into the panel as-is.
- The details panel is a single reused panel that follows the active file, instead of a new
  panel per click, each frozen on the file it was opened with.
- Changing a setting updates the status bar immediately; previously only the alignment was
  applied and the text waited for the next file switch.
- Changing alignment or priority recreates the status bar item, since both are read-only.
- Windows-only `undefined` stat fields no longer produce `NaN` in the details panel, and the
  synthesised POSIX mode is no longer presented as permissions there, since it says nothing
  about the NTFS ACL. A read-only row takes its place.
- The details panel survives a window reload: the restored tab is adopted and refilled
  instead of being left blank while the next click opens a second panel beside it.
- Concurrent reads are generation-checked, so a slow lookup cannot overwrite a newer one.
- The configuration change subscription is disposed with the extension.

### Removed

- Dead `@types/luxon` dependency, left behind by the earlier migration to Day.js.

## [2.0.0] and earlier

See the [original project's releases](https://github.com/dsyx/vsc-file-properties/releases).
