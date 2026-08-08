import * as vscode from "vscode";

function uriFromTabInput(input: unknown): vscode.Uri | undefined {
    if (input instanceof vscode.TabInputText) {
        return input.uri;
    }
    if (input instanceof vscode.TabInputCustom) {
        return input.uri;
    }
    if (input instanceof vscode.TabInputNotebook) {
        return input.uri;
    }
    if (input instanceof vscode.TabInputTextDiff) {
        return input.modified;
    }
    if (input instanceof vscode.TabInputNotebookDiff) {
        return input.modified;
    }
    return undefined;
}

function isTabOpen(uri: vscode.Uri): boolean {
    const target = uri.toString();
    return vscode.window.tabGroups.all.some((group) =>
        group.tabs.some((tab) => uriFromTabInput(tab.input)?.toString() === target),
    );
}

/**
 * The best guess available when neither the active tab nor the active editor owns
 * a file: another group's active tab, or failing that any open file-backed tab.
 * Without it, activating while a non-file tab happens to be focused would leave
 * the status bar empty until the user clicked a file.
 */
function anyFileBackedUri(): vscode.Uri | undefined {
    for (const group of vscode.window.tabGroups.all) {
        const fromActive = group.activeTab ? uriFromTabInput(group.activeTab.input) : undefined;
        if (fromActive) {
            return fromActive;
        }
    }
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            const uri = uriFromTabInput(tab.input);
            if (uri) {
                return uri;
            }
        }
    }
    return undefined;
}

/**
 * Tracks the resource the user is looking at.
 *
 * `activeTextEditor` is blind to image previews, notebooks and custom editors,
 * so the tab API leads. Tabs that own no file at all — webviews, terminals, the
 * extension's own details panel — must not blank the status bar, so the last
 * known resource survives until every file-backed tab is gone.
 */
export class ActiveResourceTracker implements vscode.Disposable {
    public constructor(onChange: (uri: vscode.Uri | undefined) => void) {
        this.onChange = onChange;
        this.current = this.resolve();

        const notify = () => {
            const next = this.resolve();
            if (next?.toString() === this.current?.toString()) {
                return;
            }
            this.current = next;
            this.onChange(next);
        };

        this.subscriptions.push(
            vscode.window.tabGroups.onDidChangeTabs(notify),
            vscode.window.tabGroups.onDidChangeTabGroups(notify),
            vscode.window.onDidChangeActiveTextEditor(notify),
        );
    }

    public get uri(): vscode.Uri | undefined {
        return this.current;
    }

    public dispose(): void {
        this.subscriptions.forEach((subscription) => subscription.dispose());
        this.subscriptions.length = 0;
    }

    private resolve(): vscode.Uri | undefined {
        const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
        const fromTab = activeTab ? uriFromTabInput(activeTab.input) : undefined;
        if (fromTab) {
            return fromTab;
        }

        const fromEditor = vscode.window.activeTextEditor?.document.uri;
        if (fromEditor) {
            return fromEditor;
        }

        // The focused tab owns no file — a webview, a terminal, this extension's
        // own details panel. Keep reporting the last resource while its tab is
        // still open, and only fall back once it is gone.
        const fallback = anyFileBackedUri();
        if (!fallback) {
            return undefined;
        }
        return this.current && isTabOpen(this.current) ? this.current : fallback;
    }

    private current: vscode.Uri | undefined;
    private readonly onChange: (uri: vscode.Uri | undefined) => void;
    private readonly subscriptions: vscode.Disposable[] = [];
}
