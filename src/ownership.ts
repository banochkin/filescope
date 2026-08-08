import { execFile } from "child_process";
import * as os from "os";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const EXEC_TIMEOUT_MS = 2000;

export interface Ownership {
    uid: number;
    gid: number;
    user?: string;
    group?: string;
}

const userNames = new Map<number, string | undefined>();
const groupNames = new Map<number, string | undefined>();

let seeded = false;

function seedFromCurrentProcess(): void {
    if (seeded) {
        return;
    }
    seeded = true;
    try {
        const info = os.userInfo();
        if (info.username && info.uid >= 0) {
            userNames.set(info.uid, info.username);
        }
    } catch {
        // userInfo throws when the user has no entry in the password database.
    }
}

/**
 * `stat` is the only ownership lookup that is both POSIX-portable and correct on
 * macOS, where local accounts live in Directory Services rather than /etc/passwd.
 * One call resolves user and group together, so the result seeds both caches.
 */
function statArgs(filePath: string): string[] | undefined {
    switch (os.platform()) {
        case "darwin":
        case "freebsd":
        case "openbsd":
            return ["-f", "%Su:%Sg", "--", filePath];
        case "linux":
        case "aix":
        case "sunos":
            return ["-c", "%U:%G", "--", filePath];
        default:
            return undefined;
    }
}

/**
 * `stat` echoes the numeric id back when it cannot resolve a name, which is not
 * an answer — it is the question restated.
 */
function nameOrUndefined(candidate: string, id: number): string | undefined {
    const trimmed = candidate.trim();
    if (!trimmed || trimmed === String(id)) {
        return undefined;
    }
    return trimmed;
}

function remember(cache: Map<number, string | undefined>, id: number, name: string | undefined): void {
    if (name !== undefined || !cache.has(id)) {
        cache.set(id, name);
    }
}

export async function resolveOwnership(
    filePath: string,
    uid: number,
    gid: number,
    resolveNames: boolean,
): Promise<Ownership> {
    const ownership: Ownership = { uid, gid };
    if (!resolveNames) {
        return ownership;
    }

    seedFromCurrentProcess();

    if (userNames.has(uid) && groupNames.has(gid)) {
        ownership.user = userNames.get(uid);
        ownership.group = groupNames.get(gid);
        return ownership;
    }

    const args = statArgs(filePath);
    if (!args) {
        return ownership;
    }

    try {
        const { stdout } = await execFileAsync("stat", args, {
            timeout: EXEC_TIMEOUT_MS,
            maxBuffer: 4096,
            windowsHide: true,
        });
        const separator = stdout.trim().lastIndexOf(":");
        if (separator > 0) {
            ownership.user = nameOrUndefined(stdout.trim().slice(0, separator), uid);
            ownership.group = nameOrUndefined(stdout.trim().slice(separator + 1), gid);
        }
    } catch {
        // No stat binary, no permission, or a timeout: numeric ids remain the answer.
    }

    // Cached either way, so a failed lookup costs one process per id, not one per
    // file — but a failure must not overwrite a name an earlier lookup did resolve.
    remember(userNames, uid, ownership.user);
    remember(groupNames, gid, ownership.group);

    return ownership;
}

export function clearOwnershipCache(): void {
    userNames.clear();
    groupNames.clear();
    seeded = false;
}
