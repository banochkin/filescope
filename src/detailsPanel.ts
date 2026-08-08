import * as vscode from "vscode";
import { Configuration } from "./configuration";
import { FileInfo } from "./fileInfo";
import { detailsHtml } from "./render";

const VIEW_TYPE = "filescope.details";

/**
 * A single reusable panel. Creating one per click would stack panels the user
 * never asked for, and each would freeze the file it was opened with.
 */
export class DetailsPanel implements vscode.Disposable {
    public reveal(info: FileInfo, configuration: Configuration): void {
        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                VIEW_TYPE,
                "File Properties",
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

    /** Refreshes an already open panel; does nothing when there is none. */
    public update(info: FileInfo, configuration: Configuration): void {
        if (this.panel) {
            this.render(info, configuration);
        }
    }

    public get isOpen(): boolean {
        return this.panel !== undefined;
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
