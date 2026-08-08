import * as vscode from "vscode";
import * as fs from "fs/promises";
import type { Stats } from "fs";
import { basename } from "path";
import { Ownership, resolveOwnership } from "./ownership";

export enum FileType {
    blockDevice = "Block Device",
    characterDevice = "Character Device",
    fifo = "FIFO",
    regular = "Regular File",
    directory = "Directory",
    symlink = "Symbolic Link",
    socket = "Socket",
    unknown = "Unknown",
}

/**
 * Where the metadata came from. A virtual file system provider answers a much
 * narrower question than `lstat` does, and the difference is worth surfacing
 * rather than rendering absent fields as zeroes.
 */
export type FileInfoSource = "stat" | "provider";

export interface SymlinkInfo {
    target: string;
    broken: boolean;
}

export interface FileInfo {
    uri: vscode.Uri;
    name: string;
    location: string;
    source: FileInfoSource;
    type: FileType;
    size: number;
    mtime: Date;
    mode?: number;
    ownership?: Ownership;
    atime?: Date;
    ctime?: Date;
    birthtime?: Date;
    dev?: number;
    ino?: number;
    nlink?: number;
    blocks?: number;
    blockSize?: number;
    rdev?: number;
    symlink?: SymlinkInfo;
    readonly?: boolean;
}

function typeFromStats(stats: Stats): FileType {
    switch (true) {
        case stats.isSymbolicLink():
            return FileType.symlink;
        case stats.isDirectory():
            return FileType.directory;
        case stats.isFile():
            return FileType.regular;
        case stats.isBlockDevice():
            return FileType.blockDevice;
        case stats.isCharacterDevice():
            return FileType.characterDevice;
        case stats.isFIFO():
            return FileType.fifo;
        case stats.isSocket():
            return FileType.socket;
        default:
            return FileType.unknown;
    }
}

function typeFromProvider(type: vscode.FileType): FileType {
    if (type & vscode.FileType.SymbolicLink) {
        return FileType.symlink;
    }
    if (type & vscode.FileType.Directory) {
        return FileType.directory;
    }
    if (type & vscode.FileType.File) {
        return FileType.regular;
    }
    return FileType.unknown;
}

/**
 * Not every file system records a creation time. Node reports the epoch when the
 * value is missing, and an epoch birthtime is noise rather than information.
 */
function birthtimeOrUndefined(stats: Stats): Date | undefined {
    return stats.birthtimeMs > 0 ? stats.birthtime : undefined;
}

/** Windows leaves several POSIX-only fields undefined; arithmetic on them yields NaN. */
function numberOrUndefined(value: number | undefined): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

async function readSymlink(path: string): Promise<SymlinkInfo | undefined> {
    try {
        const target = await fs.readlink(path);
        try {
            await fs.stat(path);
            return { target, broken: false };
        } catch {
            return { target, broken: true };
        }
    } catch {
        return undefined;
    }
}

async function fromFileSystem(uri: vscode.Uri, resolveNames: boolean): Promise<FileInfo> {
    const path = uri.fsPath;
    const stats = await fs.lstat(path);
    const type = typeFromStats(stats);

    const info: FileInfo = {
        uri,
        name: basename(path),
        location: path,
        source: "stat",
        type,
        size: stats.size,
        mode: stats.mode,
        atime: stats.atime,
        mtime: stats.mtime,
        ctime: stats.ctime,
        birthtime: birthtimeOrUndefined(stats),
        dev: numberOrUndefined(stats.dev),
        ino: numberOrUndefined(stats.ino),
        nlink: numberOrUndefined(stats.nlink),
        blocks: numberOrUndefined(stats.blocks),
        blockSize: numberOrUndefined(stats.blksize),
        rdev: numberOrUndefined(stats.rdev),
    };

    if (process.platform !== "win32") {
        info.ownership = await resolveOwnership(path, stats.uid, stats.gid, resolveNames);
    }

    if (type === FileType.symlink) {
        info.symlink = await readSymlink(path);
    }

    return info;
}

async function fromProvider(uri: vscode.Uri): Promise<FileInfo> {
    const stat = await vscode.workspace.fs.stat(uri);
    return {
        uri,
        name: basename(uri.path),
        location: uri.toString(true),
        source: "provider",
        type: typeFromProvider(stat.type),
        size: stat.size,
        mtime: new Date(stat.mtime),
        ctime: stat.ctime > 0 ? new Date(stat.ctime) : undefined,
        readonly: (stat.permissions ?? 0) === vscode.FilePermission.Readonly,
    };
}

/**
 * Reads metadata for a resource, preferring `lstat` because it is the only source
 * that carries permissions, ownership and inode details. Non-`file` schemes are
 * served by their file system provider instead, which answers with less.
 */
export async function readFileInfo(uri: vscode.Uri, resolveNames: boolean): Promise<FileInfo> {
    return uri.scheme === "file" ? fromFileSystem(uri, resolveNames) : fromProvider(uri);
}
