import * as assert from "assert";
import {
    formatFileTypeChar,
    formatMode,
    formatOctalMode,
    formatPermissions,
    formatSize,
} from "../format";

suite("formatSize", () => {
    test("renders bytes without a fractional part", () => {
        assert.strictEqual(formatSize(0, "iec"), "0 B");
        assert.strictEqual(formatSize(512, "iec"), "512 B");
        assert.strictEqual(formatSize(999, "si"), "999 B");
    });

    test("scales by 1024 for iec and by 1000 for si", () => {
        assert.strictEqual(formatSize(1024, "iec"), "1.00 KiB");
        assert.strictEqual(formatSize(1024, "si"), "1.02 kB");
        assert.strictEqual(formatSize(1000, "si"), "1.00 kB");
        assert.strictEqual(formatSize(1536, "iec"), "1.50 KiB");
    });

    test("stops at the largest known unit", () => {
        const yotta = Math.pow(1024, 8);
        assert.strictEqual(formatSize(yotta, "iec"), "1.00 YiB");
        assert.strictEqual(formatSize(yotta * 2048, "iec"), "2048.00 YiB");
    });
});

suite("formatPermissions", () => {
    test("renders the nine permission bits", () => {
        assert.strictEqual(formatPermissions(0o644), "rw-r--r--");
        assert.strictEqual(formatPermissions(0o755), "rwxr-xr-x");
        assert.strictEqual(formatPermissions(0o000), "---------");
    });

    test("folds setuid, setgid and sticky into the execute positions", () => {
        assert.strictEqual(formatPermissions(0o4755), "rwsr-xr-x");
        assert.strictEqual(formatPermissions(0o4644), "rwSr--r--");
        assert.strictEqual(formatPermissions(0o2755), "rwxr-sr-x");
        assert.strictEqual(formatPermissions(0o2745), "rwxr-Sr-x");
        assert.strictEqual(formatPermissions(0o1777), "rwxrwxrwt");
        assert.strictEqual(formatPermissions(0o1666), "rw-rw-rwT");
    });
});

suite("formatFileTypeChar", () => {
    test("maps the file type bits the way ls does", () => {
        assert.strictEqual(formatFileTypeChar(0o100644), "-");
        assert.strictEqual(formatFileTypeChar(0o040755), "d");
        assert.strictEqual(formatFileTypeChar(0o120777), "l");
        assert.strictEqual(formatFileTypeChar(0o010644), "p");
        assert.strictEqual(formatFileTypeChar(0o140755), "s");
        assert.strictEqual(formatFileTypeChar(0), "?");
    });
});

suite("formatMode", () => {
    test("combines type and permissions", () => {
        assert.strictEqual(formatMode(0o100644), "-rw-r--r--");
        assert.strictEqual(formatMode(0o040755), "drwxr-xr-x");
    });

    test("keeps the special bits in the octal form", () => {
        assert.strictEqual(formatOctalMode(0o100644), "0644");
        assert.strictEqual(formatOctalMode(0o104755), "4755");
    });
});
