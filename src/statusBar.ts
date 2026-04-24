/**
 * AIComTrace – Status Bar Manager
 *
 * Manages the status bar item that shows the current AI co-author state
 * and provides a quick toggle.
 */

import * as vscode from "vscode";
import { AITool } from "./types";

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = "aicomtrace.toggle";
    this.statusBarItem.tooltip = "Click to toggle AI Co-Author";
    this.update(false, null);
    this.statusBarItem.show();
  }

  /**
   * Updates the status bar display based on the current state.
   */
  update(enabled: boolean, tool: AITool | null): void {
    if (enabled && tool) {
      this.statusBarItem.text = `$(hubot) AI: ${tool.name}`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );
      this.statusBarItem.tooltip = `AI Co-Author active: ${tool.name}\nClick to toggle off`;
    } else if (enabled) {
      this.statusBarItem.text = `$(hubot) AI: On`;
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );
      this.statusBarItem.tooltip =
        "AI Co-Author active (no tool selected)\nClick to toggle off";
    } else {
      this.statusBarItem.text = `$(hubot) AI: Off`;
      this.statusBarItem.backgroundColor = undefined;
      this.statusBarItem.tooltip = "AI Co-Author disabled\nClick to toggle on";
    }
  }

  /**
   * Disposes the status bar item.
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}
