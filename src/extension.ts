import * as vscode from "vscode";
import { dirname } from "path";
import { ActiveResourceTracker } from "./activeResource";
import { ConfigurationStore } from "./configuration";
import { DETAILS_VIEW_TYPE, DetailsPanel } from "./detailsPanel";
import { FileInfo, readFileInfo } from "./fileInfo";
import { clearOwnershipCache } from "./ownership";
import { statusBarText, tooltipMarkdown } from "./render";
import { StatusBar } from "./statusBar";

const SHOW_DETAILS_COMMAND = "filescope.showDetails";
const REFRESH_COMMAND = "filescope.refresh";
const WATCH_DEBOUNCE_MS = 150;

class FileScope implements vscode.Disposable {
    public constructor() {
        this.configurationStore = new ConfigurationStore();
        this.statusBar = new StatusBar(this.configurationStore.configuration, SHOW_DETAILS_COMMAND);
        this.detailsPanel = new DetailsPanel();
        this.tracker = new ActiveResourceTracker(() => {
            this.watchActiveResource();
            void this.refresh();
        });

        this.subscriptions.push(
            this.configurationStore,
            this.statusBar,
            this.detailsPanel,
            this.tracker,
            vscode.commands.registerCommand(SHOW_DETAILS_COMMAND, () => this.showDetails()),
            vscode.commands.registerCommand(REFRESH_COMMAND, () => this.refresh()),
            this.configurationStore.onDidChange(() => {
                clearOwnershipCache();
                this.statusBar.applyConfiguration(this.configurationStore.configuration);
                void this.refresh();
            }),
            vscode.window.registerWebviewPanelSerializer(DETAILS_VIEW_TYPE, {
                deserializeWebviewPanel: async (panel) => {
                    this.detailsPanel.adopt(panel);
                    const configuration = this.configurationStore.configuration;
                    const info =
                        this.lastInfo ??
                        (await this.readActiveInfo(configuration.resolveOwnershipNames));
                    if (info) {
                        this.detailsPanel.update(info, configuration);
                    }
                },
            }),
            vscode.workspace.onDidSaveTextDocument((document) => {
                if (document.uri.toString() === this.tracker.uri?.toString()) {
                    void this.refresh();
                }
            }),
        );

        this.watchActiveResource();
        void this.refresh();
    }

    public dispose(): void {
        this.clearWatcher();
        this.subscriptions.forEach((subscription) => subscription.dispose());
        this.subscriptions.length = 0;
    }

    private async refresh(): Promise<void> {
        // Claimed before anything else: a refresh that resolves to no file still
        // has to invalidate a slower one already in flight, or that one will
        // resurrect the status bar for a file the user has closed.
        const generation = ++this.generation;
        const uri = this.tracker.uri;
        const configuration = this.configurationStore.configuration;

        if (!uri) {
            this.lastInfo = undefined;
            this.statusBar.hide();
            return;
        }

        let info: FileInfo;
        try {
            info = await readFileInfo(uri, configuration.resolveOwnershipNames);
        } catch (error) {
            if (generation === this.generation) {
                this.lastInfo = undefined;
                this.statusBar.hide();
                this.log(error);
            }
            return;
        }

        if (generation !== this.generation) {
            return;
        }

        this.lastInfo = info;

        if (configuration.statusBarEnabled) {
            this.statusBar.setContent(
                statusBarText(info, configuration),
                tooltipMarkdown(info, configuration),
            );
            this.statusBar.show();
        } else {
            this.statusBar.hide();
        }

        if (configuration.followActiveFile) {
            this.detailsPanel.update(info, configuration);
        }
    }

    private async showDetails(): Promise<void> {
        const configuration = this.configurationStore.configuration;
        // Reads its own copy rather than waiting on refresh(): a concurrent
        // refresh would discard this one's result as stale, and an explicit
        // request must not fail because something else was in flight.
        const info = this.lastInfo ?? (await this.readActiveInfo(configuration.resolveOwnershipNames));

        if (!info) {
            void vscode.window.showInformationMessage("FileScope: no file is currently active.");
            return;
        }
        this.detailsPanel.reveal(info, configuration);
    }

    private async readActiveInfo(resolveNames: boolean): Promise<FileInfo | undefined> {
        const uri = this.tracker.uri;
        if (!uri) {
            return undefined;
        }
        try {
            return await readFileInfo(uri, resolveNames);
        } catch (error) {
            this.log(error);
            return undefined;
        }
    }

    /**
     * Saving is only one of the ways a file changes. A watcher scoped to the
     * single active file catches the rest — a build touching it, a rebase, chmod
     * from a terminal — without watching the whole workspace.
     */
    private watchActiveResource(): void {
        this.clearWatcher();

        const uri = this.tracker.uri;
        if (!uri || uri.scheme !== "file") {
            return;
        }

        // The file name cannot go into the pattern: it is read as a glob, and a
        // name like `[id].tsx` would become a character class matching anything
        // but itself. Watch the directory and compare paths by hand instead.
        const watched = uri.fsPath;
        const pattern = new vscode.RelativePattern(vscode.Uri.file(dirname(watched)), "*");
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        const onEvent = (changed: vscode.Uri) => {
            if (changed.fsPath !== watched) {
                return;
            }
            if (this.watchTimer) {
                clearTimeout(this.watchTimer);
            }
            this.watchTimer = setTimeout(() => {
                this.watchTimer = undefined;
                void this.refresh();
            }, WATCH_DEBOUNCE_MS);
        };

        this.watcherSubscriptions.push(
            watcher,
            watcher.onDidChange(onEvent),
            watcher.onDidCreate(onEvent),
            watcher.onDidDelete(onEvent),
        );
    }

    private clearWatcher(): void {
        if (this.watchTimer) {
            clearTimeout(this.watchTimer);
            this.watchTimer = undefined;
        }
        this.watcherSubscriptions.forEach((subscription) => subscription.dispose());
        this.watcherSubscriptions.length = 0;
    }

    private log(error: unknown): void {
        const message = error instanceof Error ? error.message : "an unknown error occurred";
        console.error(`[FileScope] ${message}`);
    }

    private readonly configurationStore: ConfigurationStore;
    private readonly statusBar: StatusBar;
    private readonly detailsPanel: DetailsPanel;
    private readonly tracker: ActiveResourceTracker;
    private readonly subscriptions: vscode.Disposable[] = [];
    private lastInfo: FileInfo | undefined;
    private generation = 0;
    private readonly watcherSubscriptions: vscode.Disposable[] = [];
    private watchTimer: NodeJS.Timeout | undefined;
}

export function activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(new FileScope());
}

export function deactivate(): void {
    // Everything is disposed through the extension context subscriptions.
}
