import * as vscode from "vscode";
import { Configuration } from "./configuration";
import { FileInfo } from "./fileInfo";
import { detailsHtml } from "./render";

export const DETAILS_VIEW_TYPE = "filescope.details";

/**
 * A single reusable panel. Creating one per click would stack panels the user
 * never asked for, and each would freeze the file it was opened with.
 */
export class DetailsPanel implements vscode.Disposable {
    public reveal(info: FileInfo, configuration: Configuration): void {
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                DETAILS_VIEW_TYPE,
                "FileScope",
                { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
                { enableScripts: false, localResourceRoots: [] },
            );
            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });
        } else {
            this.panel.reveal(this.panel.viewColumn, true);
        }

        this.render(info, configuration);
    }

    /**
     * Takes ownership of a panel VS Code restored after a window reload. Without
     * this the restored tab would stay blank and unowned, and the next reveal()
     * would open a second panel beside it.
     */
    public adopt(panel: vscode.WebviewPanel): void {
        this.panel?.dispose();
        this.panel = panel;
        // A restored panel arrives with whatever options were serialised with it.
        this.panel.webview.options = { enableScripts: false, localResourceRoots: [] };
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    /** Refreshes an already open panel; does nothing when there is none. */
    public update(info: FileInfo, configuration: Configuration): void {
        if (this.panel) {
            this.render(info, configuration);
        }
    }

    public dispose(): void {
        this.panel?.dispose();
        this.panel = undefined;
    }

    private render(info: FileInfo, configuration: Configuration): void {
        if (!this.panel) {
            return;
        }
        this.panel.title = `Properties: ${info.name}`;
        this.panel.webview.html = detailsHtml(info, configuration, this.panel.webview.cspSource);
    }

    private panel: vscode.WebviewPanel | undefined;
}
