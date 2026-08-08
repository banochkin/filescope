import * as vscode from "vscode";
import { Configuration, StatusBarItemKind } from "./configuration";
import { FileInfo, FileType } from "./fileInfo";
import {
    formatFileTypeChar,
    formatMode,
    formatOctalMode,
    formatPermissions,
    formatSize,
    formatTime,
    formatTimeWithRelative,
} from "./format";

export interface DetailRow {
    label: string;
    value: string;
}

const TYPE_ICONS: Record<FileType, string> = {
    [FileType.directory]: "$(folder)",
    [FileType.symlink]: "$(file-symlink-file)",
    [FileType.regular]: "$(file)",
    [FileType.blockDevice]: "$(circuit-board)",
    [FileType.characterDevice]: "$(circuit-board)",
    [FileType.fifo]: "$(arrow-swap)",
    [FileType.socket]: "$(plug)",
    [FileType.unknown]: "$(question)",
};

const TIME_LABELS: Record<string, string> = {
    atime: "A",
    mtime: "M",
    ctime: "C",
    birthtime: "B",
};

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
        switch (character) {
            case "&":
                return "&amp;";
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case '"':
                return "&quot;";
            default:
                return "&#39;";
        }
    });
}

/**
 * File names may legally contain newlines, pipes and emphasis characters, any of
 * which would break out of a Markdown table cell or silently restyle the text.
 */
function escapeMarkdownCell(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/[\r\n]+/g, " ")
        .replace(/([|*_`~[\]<>])/g, "\\$1");
}

function ownerText(info: FileInfo): string | undefined {
    const ownership = info.ownership;
    if (!ownership) {
        return undefined;
    }
    return ownership.user ? `${ownership.user} (${ownership.uid})` : String(ownership.uid);
}

function groupText(info: FileInfo): string | undefined {
    const ownership = info.ownership;
    if (!ownership) {
        return undefined;
    }
    return ownership.group ? `${ownership.group} (${ownership.gid})` : String(ownership.gid);
}

function timeOf(info: FileInfo, kind: StatusBarItemKind): Date | undefined {
    switch (kind) {
        case "atime":
            return info.atime;
        case "mtime":
            return info.mtime;
        case "ctime":
            return info.ctime;
        case "birthtime":
            return info.birthtime;
        default:
            return undefined;
    }
}

function renderStatusBarItem(
    info: FileInfo,
    configuration: Configuration,
    kind: StatusBarItemKind,
): string | undefined {
    switch (kind) {
        case "type":
            return info.mode === undefined ? undefined : formatFileTypeChar(info.mode);
        case "permissions":
            return info.mode === undefined ? undefined : formatPermissions(info.mode);
        case "owner":
            return info.ownership?.user ?? info.ownership?.uid.toString();
        case "group":
            return info.ownership?.group ?? info.ownership?.gid.toString();
        case "size":
            return formatSize(info.size, configuration.sizeUnit);
        default: {
            const date = timeOf(info, kind);
            if (!date) {
                return undefined;
            }
            const text = formatTime(date, configuration.timeFormat, configuration.relativeTime);
            return configuration.statusBarShowLabels ? `${text} (${TIME_LABELS[kind]})` : text;
        }
    }
}

export function statusBarText(info: FileInfo, configuration: Configuration): string {
    const parts = configuration.statusBarItems
        .map((kind) => renderStatusBarItem(info, configuration, kind))
        .filter((part): part is string => part !== undefined);

    const icon = TYPE_ICONS[info.type];
    return parts.length > 0 ? `${icon} ${parts.join(configuration.statusBarSeparator)}` : icon;
}

function timeRow(label: string, date: Date | undefined, configuration: Configuration): DetailRow | undefined {
    if (!date) {
        return undefined;
    }
    return { label, value: formatTimeWithRelative(date, configuration.timeFormat) };
}

export function detailRows(info: FileInfo, configuration: Configuration): DetailRow[] {
    const rows: (DetailRow | undefined)[] = [
        { label: "Name", value: info.name },
        { label: "Location", value: info.location },
        {
            label: "Type",
            value: info.symlink
                ? `${info.type} → ${info.symlink.target}${info.symlink.broken ? " (broken)" : ""}`
                : info.type,
        },
        {
            label: "Size",
            value: `${formatSize(info.size, configuration.sizeUnit)} (${info.size} bytes)`,
        },
    ];

    // Windows reports a synthesised POSIX mode that says nothing about the NTFS
    // ACL, so rendering it as permissions would be a confident falsehood.
    if (info.mode !== undefined && process.platform !== "win32") {
        rows.push({
            label: "Permissions",
            value: `${formatMode(info.mode)} · ${formatOctalMode(info.mode)}`,
        });
    }
    const writable = info.mode === undefined ? undefined : (info.mode & 0o200) !== 0;
    if (info.readonly) {
        rows.push({ label: "Read-only", value: "yes" });
    } else if (process.platform === "win32" && writable !== undefined) {
        rows.push({ label: "Read-only", value: writable ? "no" : "yes" });
    }

    const owner = ownerText(info);
    const group = groupText(info);
    if (owner) {
        rows.push({ label: "Owner", value: owner });
    }
    if (group) {
        rows.push({ label: "Group", value: group });
    }

    rows.push(
        timeRow("Modified", info.mtime, configuration),
        timeRow("Created", info.birthtime, configuration),
        timeRow("Accessed", info.atime, configuration),
        timeRow("Metadata changed", info.ctime, configuration),
    );

    if (info.nlink !== undefined) {
        rows.push({ label: "Hard links", value: String(info.nlink) });
    }
    if (info.ino !== undefined) {
        rows.push({
            label: process.platform === "win32" ? "File index" : "Inode",
            value: String(info.ino),
        });
    }
    if (info.dev !== undefined) {
        rows.push({ label: "Device", value: String(info.dev) });
    }
    if (info.rdev) {
        rows.push({ label: "Device type", value: String(info.rdev) });
    }
    if (info.blocks !== undefined) {
        rows.push({
            label: "Blocks allocated",
            value: `${info.blocks} (${formatSize(info.blocks * 512, configuration.sizeUnit)} on disk)`,
        });
    }
    if (info.blockSize !== undefined) {
        rows.push({ label: "Preferred I/O block size", value: String(info.blockSize) });
    }

    if (info.source === "provider") {
        rows.push({
            label: "Note",
            value: "Reported by a virtual file system provider; permissions, ownership and inode details are unavailable.",
        });
    }

    return rows.filter((row): row is DetailRow => row !== undefined);
}

const TOOLTIP_LABELS = new Set(["Type", "Size", "Permissions", "Owner", "Group", "Modified", "Created"]);

export function tooltipMarkdown(info: FileInfo, configuration: Configuration): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${escapeMarkdownCell(info.name)}**\n\n`);
    tooltip.appendMarkdown("| | |\n|---|---|\n");

    for (const row of detailRows(info, configuration)) {
        if (!TOOLTIP_LABELS.has(row.label)) {
            continue;
        }
        tooltip.appendMarkdown(
            `| ${escapeMarkdownCell(row.label)} | ${escapeMarkdownCell(row.value)} |\n`,
        );
    }

    tooltip.appendMarkdown("\nClick to open the full properties.");
    return tooltip;
}

function createNonce(): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let nonce = "";
    for (let index = 0; index < 32; index++) {
        nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return nonce;
}

/**
 * `cspSource` must stay in the style directive alongside the nonce: the editor
 * injects its own theme stylesheet into every webview, and a nonce-only policy
 * would block it, leaving the --vscode-* variables undefined.
 */
export function detailsHtml(
    info: FileInfo,
    configuration: Configuration,
    cspSource: string,
): string {
    const nonce = createNonce();
    const rows = detailRows(info, configuration)
        .map(
            (row) =>
                `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td></tr>`,
        )
        .join("\n            ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(info.name)}</title>
    <style nonce="${nonce}">
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            padding: 1rem 1.25rem;
        }
        h1 {
            font-size: 1.2em;
            font-weight: 600;
            margin: 0 0 1rem;
            word-break: break-all;
        }
        table {
            border-collapse: collapse;
            width: 100%;
        }
        th, td {
            border-bottom: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.35));
            padding: 0.4rem 0.6rem;
            text-align: left;
            vertical-align: top;
        }
        th {
            width: 14rem;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            white-space: nowrap;
        }
        td {
            font-family: var(--vscode-editor-font-family);
            word-break: break-all;
        }
    </style>
</head>
<body>
    <h1>${escapeHtml(info.name)}</h1>
    <table>
        <tbody>
            ${rows}
        </tbody>
    </table>
</body>
</html>`;
}
