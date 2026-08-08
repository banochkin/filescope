import * as vscode from "vscode";
import { Configuration } from "./configuration";

const ITEM_ID = "filescope.properties";

/**
 * `alignment` and `priority` are read-only on a StatusBarItem, so honouring a
 * change to either means replacing the item rather than mutating it.
 */
export class StatusBar implements vscode.Disposable {
    public constructor(configuration: Configuration, command: string) {
        this.command = command;
        this.alignment = configuration.statusBarAlignment;
        this.priority = configuration.statusBarPriority;
        this.item = this.createItem();
    }

    public applyConfiguration(configuration: Configuration): void {
        if (
            this.alignment === configuration.statusBarAlignment &&
            this.priority === configuration.statusBarPriority
        ) {
            return;
        }

        const { text, tooltip } = this.item;
        this.item.dispose();

        this.alignment = configuration.statusBarAlignment;
        this.priority = configuration.statusBarPriority;
        this.item = this.createItem();
        this.item.text = text;
        this.item.tooltip = tooltip;

        if (this.visible) {
            this.item.show();
        }
    }

    public setContent(text: string, tooltip: vscode.MarkdownString): void {
        this.item.text = text;
        this.item.tooltip = tooltip;
    }

    public show(): void {
        this.visible = true;
        this.item.show();
    }

    public hide(): void {
        this.visible = false;
        this.item.hide();
    }

    public dispose(): void {
        this.item.dispose();
    }

    private createItem(): vscode.StatusBarItem {
        const item = vscode.window.createStatusBarItem(ITEM_ID, this.alignment, this.priority);
        item.name = "File Properties";
        item.command = this.command;
        item.accessibilityInformation = { label: "File properties", role: "button" };
        return item;
    }

    private item: vscode.StatusBarItem;
    private alignment: vscode.StatusBarAlignment;
    private priority: number;
    private visible = false;
    private readonly command: string;
}
