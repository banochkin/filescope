import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export type SizeUnit = "si" | "iec";

const SIZE_UNITS: Record<SizeUnit, { units: readonly string[]; step: number }> = {
    si: {
        units: ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
        step: 1000,
    },
    iec: {
        units: ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"],
        step: 1024,
    },
};

const S_IFMT = 0o170000;

const FILE_TYPE_CHARS: ReadonlyMap<number, string> = new Map([
    [0o140000, "s"],
    [0o120000, "l"],
    [0o100000, "-"],
    [0o060000, "b"],
    [0o040000, "d"],
    [0o020000, "c"],
    [0o010000, "p"],
]);

export function formatSize(size: number, unit: SizeUnit): string {
    const { units, step } = SIZE_UNITS[unit];

    let value = size;
    let index = 0;
    while (Math.abs(value) >= step && index < units.length - 1) {
        value /= step;
        index++;
    }

    // Bytes are whole by definition; only scaled values earn a fractional part.
    return index === 0 ? `${value} ${units[0]}` : `${value.toFixed(2)} ${units[index]}`;
}

export function formatFileTypeChar(mode: number): string {
    return FILE_TYPE_CHARS.get(mode & S_IFMT) ?? "?";
}

/**
 * Renders the nine permission bits the way `ls -l` does, folding the setuid,
 * setgid and sticky bits into the execute positions they modify.
 */
export function formatPermissions(mode: number): string {
    const bit = (mask: number, char: string): string => (mode & mask ? char : "-");

    const special = (executeMask: number, specialMask: number, specialChar: string): string => {
        if (!(mode & specialMask)) {
            return bit(executeMask, "x");
        }
        return mode & executeMask ? specialChar : specialChar.toUpperCase();
    };

    return [
        bit(0o0400, "r"),
        bit(0o0200, "w"),
        special(0o0100, 0o4000, "s"),
        bit(0o0040, "r"),
        bit(0o0020, "w"),
        special(0o0010, 0o2000, "s"),
        bit(0o0004, "r"),
        bit(0o0002, "w"),
        special(0o0001, 0o1000, "t"),
    ].join("");
}

export function formatMode(mode: number): string {
    return `${formatFileTypeChar(mode)}${formatPermissions(mode)}`;
}

export function formatOctalMode(mode: number): string {
    return (mode & 0o7777).toString(8).padStart(4, "0");
}

export function formatTime(date: Date, format: string, relative: boolean): string {
    const value = dayjs(date);
    return relative ? value.fromNow() : value.format(format);
}

export function formatTimeWithRelative(date: Date, format: string): string {
    const value = dayjs(date);
    return `${value.format(format)} (${value.fromNow()})`;
}
