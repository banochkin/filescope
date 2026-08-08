# FileScope

Inspect file properties without leaving the editor. FileScope keeps a compact summary in the status bar and opens the full `stat` picture in a panel when you ask for it.

![Demo](resources/images/demo.png)

## Features

- **Status bar summary.** Pick which properties to show and in which order: type, permissions, owner, group, size, and any of the four timestamps.
- **Full details panel.** Permissions in both symbolic and octal form, ownership, inode, device, hard link count, allocated blocks and every timestamp the file system records.
- **Names instead of numbers.** `uid` and `gid` are resolved to user and group names, cached per id so the lookup costs one short-lived process, not one per file.
- **Creation time.** `birthtime` is shown as a first-class property wherever the file system actually records one, rather than being conflated with the metadata change time.
- **Remote-aware.** Declared as a workspace extension, so over Remote-SSH, WSL, Dev Containers and Codespaces it reads the file system where the file actually lives.
- **Beyond text editors.** Image previews, notebooks, diffs and custom editors are tracked through the tab API, not just `activeTextEditor`.
- **Live.** The active file is watched, so an external `chmod`, a rebase or a build touching the file updates the display without a click.
- **Symbolic links.** Reported as links, with their target and whether it resolves.

## Requirements

VS Code [`1.96.0`](https://code.visualstudio.com/updates/v1_96) or later.

## Commands

| Command | Description |
| --- | --- |
| `FileScope: Show File Properties` | Open the details panel for the active file. |
| `FileScope: Refresh File Properties` | Re-read the active file. |

Clicking the status bar item runs the first command.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `filescope.statusBar.enabled` | `true` | Show file properties in the status bar. |
| `filescope.statusBar.items` | `["permissions", "size", "mtime"]` | Properties to show, in order. One or more of `type`, `permissions`, `owner`, `group`, `size`, `atime`, `mtime`, `ctime`, `birthtime`. |
| `filescope.statusBar.alignment` | `"right"` | Side of the status bar. |
| `filescope.statusBar.priority` | `100` | Position within that side; higher moves further left. |
| `filescope.statusBar.separator` | `" \| "` | Separator between properties. |
| `filescope.statusBar.showLabels` | `true` | Append `(A)`, `(M)`, `(C)`, `(B)` to timestamps. |
| `filescope.size.unit` | `"iec"` | `iec` for KiB/MiB (1024), `si` for kB/MB (1000). |
| `filescope.time.format` | `"YYYY-MM-DD HH:mm:ss"` | [Day.js format tokens](https://day.js.org/docs/en/display/format). |
| `filescope.time.relative` | `false` | Render status bar timestamps as relative time. |
| `filescope.ownership.resolveNames` | `true` | Resolve `uid`/`gid` to names. |
| `filescope.details.followActiveFile` | `true` | Keep an open details panel in sync with the active file. |

## Platform notes

**Windows.** There are no POSIX permission bits or ownership to report, so the `permissions`, `owner` and `group` entries are skipped automatically. Everything else, including the file index in place of the inode, works as usual.

**Creation time.** Not every file system records one. FileScope shows `birthtime` only when the value is present; where the kernel has nothing to report, the property is omitted rather than filled with the epoch. On some Linux file systems the kernel substitutes the metadata change time, which is indistinguishable from a real creation time at the API level.

**Ownership names.** Resolved by invoking `stat`, which is the only portable lookup that is also correct on macOS, where local accounts live in Directory Services rather than `/etc/passwd`. The result is cached per `uid`/`gid` pair. Set `filescope.ownership.resolveNames` to `false` to keep the raw numbers and skip the process entirely.

**Virtual workspaces.** In a workspace backed by a virtual file system provider — GitHub Repositories, for example — only size, type and the timestamps the provider reports are available. The details panel says so explicitly instead of rendering absent fields as zeroes.

## Contributing

```bash
npm install
npm run watch      # esbuild + tsc in watch mode
npm run lint
npm test
```

Press <kbd>F5</kbd> to launch an Extension Development Host.

## Credits

FileScope is a fork of [dsyx/vsc-file-properties](https://github.com/dsyx/vsc-file-properties) by Yaoxing Shan, and remains MIT licensed. See [CHANGELOG.md](CHANGELOG.md) for what changed after the fork.
