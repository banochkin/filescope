import * as vscode from "vscode";
import { SizeUnit } from "./format";

export const CONFIGURATION_SECTION = "filescope";

export const STATUS_BAR_ITEM_KINDS = [
    "type",
    "permissions",
    "owner",
    "group",
    "size",
    "atime",
    "mtime",
    "ctime",
    "birthtime",
] as const;

export type StatusBarItemKind = (typeof STATUS_BAR_ITEM_KINDS)[number];

const POSIX_ONLY_KINDS: ReadonlySet<StatusBarItemKind> = new Set([
    "permissions",
    "owner",
    "group",
]);

export interface Configuration {
    readonly statusBarEnabled: boolean;
    readonly statusBarItems: readonly StatusBarItemKind[];
    readonly statusBarAlignment: vscode.StatusBarAlignment;
    readonly statusBarPriority: number;
    readonly statusBarSeparator: string;
    readonly statusBarShowLabels: boolean;
    readonly sizeUnit: SizeUnit;
    readonly timeFormat: string;
    readonly relativeTime: boolean;
    readonly resolveOwnershipNames: boolean;
    readonly followActiveFile: boolean;
}

const DEFAULT_ITEMS: readonly StatusBarItemKind[] = ["permissions", "size", "mtime"];

function readItems(config: vscode.WorkspaceConfiguration): readonly StatusBarItemKind[] {
    const raw = config.get<string[]>("statusBar.items");
    const configured = Array.isArray(raw) ? raw : [...DEFAULT_ITEMS];

    const known = configured.filter((item): item is StatusBarItemKind =>
        (STATUS_BAR_ITEM_KINDS as readonly string[]).includes(item),
    );

    // Windows has no POSIX mode or ownership to report, so those entries would
    // only ever render as placeholders.
    return process.platform === "win32"
        ? known.filter((item) => !POSIX_ONLY_KINDS.has(item))
        : known;
}

function readConfiguration(): Configuration {
    const config = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);

    return {
        statusBarEnabled: config.get<boolean>("statusBar.enabled") ?? true,
        statusBarItems: readItems(config),
        statusBarAlignment:
            config.get<string>("statusBar.alignment") === "left"
                ? vscode.StatusBarAlignment.Left
                : vscode.StatusBarAlignment.Right,
        statusBarPriority: config.get<number>("statusBar.priority") ?? 100,
        statusBarSeparator: config.get<string>("statusBar.separator") ?? " | ",
        statusBarShowLabels: config.get<boolean>("statusBar.showLabels") ?? true,
        sizeUnit: config.get<string>("size.unit") === "si" ? "si" : "iec",
        timeFormat: config.get<string>("time.format") || "YYYY-MM-DD HH:mm:ss",
        relativeTime: config.get<boolean>("time.relative") ?? false,
        resolveOwnershipNames: config.get<boolean>("ownership.resolveNames") ?? true,
        followActiveFile: config.get<boolean>("details.followActiveFile") ?? true,
    };
}

/**
 * Hands out an immutable snapshot rather than a long-lived object mutated in
 * place, so a stale read is a visible bug instead of a silent one.
 */
export class ConfigurationStore implements vscode.Disposable {
    public constructor() {
        this.current = readConfiguration();
        this.emitter = new vscode.EventEmitter<Configuration>();
        this.onDidChange = this.emitter.event;
        this.subscription = vscode.workspace.onDidChangeConfiguration((event) => {
            if (!event.affectsConfiguration(CONFIGURATION_SECTION)) {
                return;
            }
            this.current = readConfiguration();
            this.emitter.fire(this.current);
        });
    }

    public get configuration(): Configuration {
        return this.current;
    }

    public readonly onDidChange: vscode.Event<Configuration>;

    public dispose(): void {
        this.subscription.dispose();
        this.emitter.dispose();
    }

    private current: Configuration;
    private readonly emitter: vscode.EventEmitter<Configuration>;
    private readonly subscription: vscode.Disposable;
}
