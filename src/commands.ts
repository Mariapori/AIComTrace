/**
 * AIComTrace – Commands
 *
 * All command handlers for the extension.
 */

import * as vscode from "vscode";
import { CoAuthorManager, BUILTIN_AI_TOOLS } from "./coAuthorManager";
import { GitService } from "./gitService";
import { StatusBarManager } from "./statusBar";
import { AITool, ExtensionState } from "./types";

/**
 * Manages all commands and coordinates between modules.
 */
export class CommandManager {
  private state: ExtensionState;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private context: vscode.ExtensionContext,
    private coAuthorManager: CoAuthorManager,
    private gitService: GitService,
    private statusBar: StatusBarManager
  ) {
    // Restore persisted state
    this.state = {
      enabled: context.globalState.get<boolean>("enabled", false),
      selectedTool: context.globalState.get<AITool | null>("selectedTool", null),
    };

    // Set context for when-clauses
    vscode.commands.executeCommand(
      "setContext",
      "aicomtrace.enabled",
      this.state.enabled
    );

    // If enabled but no tool, check default
    if (this.state.enabled && !this.state.selectedTool) {
      const defaultToolName = vscode.workspace
        .getConfiguration("aicomtrace")
        .get<string>("defaultTool", "");
      if (defaultToolName) {
        const tools = this.coAuthorManager.getAllTools();
        this.state.selectedTool =
          tools.find((t) => t.name === defaultToolName) ?? null;
      }
    }

    // Update status bar with restored state
    this.statusBar.update(this.state.enabled, this.state.selectedTool);
  }

  /**
   * Registers all commands with VS Code.
   */
  registerCommands(): void {
    this.disposables.push(
      vscode.commands.registerCommand("aicomtrace.toggle", () =>
        this.toggleCoAuthor()
      ),
      vscode.commands.registerCommand("aicomtrace.selectTool", () =>
        this.selectAITool()
      ),
      vscode.commands.registerCommand("aicomtrace.commitWithCoAuthor", () =>
        this.commitWithCoAuthor()
      ),
      vscode.commands.registerCommand("aicomtrace.addCustomTool", () =>
        this.addCustomTool()
      ),
      vscode.commands.registerCommand("aicomtrace.removeTrailer", () =>
        this.removeTrailer()
      )
    );
  }

  /**
   * Toggles AI co-author mode on/off.
   * When turning on, prompts for tool selection if none is set.
   */
  async toggleCoAuthor(): Promise<void> {
    if (!this.state.enabled) {
      // Turning ON – select a tool if needed
      if (!this.state.selectedTool) {
        const tool = await this.promptToolSelection();
        if (!tool) {
          return; // User cancelled
        }
        this.state.selectedTool = tool;
      }

      this.state.enabled = true;

      // Auto-append trailer to current input box
      const autoAppend = vscode.workspace
        .getConfiguration("aicomtrace")
        .get<boolean>("autoAppend", true);

      if (autoAppend && this.state.selectedTool) {
        this.appendTrailerToInputBox();
      }

      vscode.window.showInformationMessage(
        `AIComTrace: AI Co-Author enabled – ${this.state.selectedTool!.name}`
      );
    } else {
      // Turning OFF
      this.state.enabled = false;

      // Remove trailer from current input box
      this.removeTrailerFromInputBox();

      vscode.window.showInformationMessage(
        "AIComTrace: AI Co-Author disabled"
      );
    }

    // Persist state
    await this.persistState();
    this.statusBar.update(this.state.enabled, this.state.selectedTool);
    vscode.commands.executeCommand(
      "setContext",
      "aicomtrace.enabled",
      this.state.enabled
    );
  }

  /**
   * Opens a Quick Pick for selecting an AI tool.
   */
  async selectAITool(): Promise<void> {
    const tool = await this.promptToolSelection();
    if (!tool) {
      return;
    }

    // If there was a previous tool's trailer, swap it
    if (this.state.enabled && this.state.selectedTool) {
      const currentMessage = this.gitService.getInputBoxValue();
      if (this.coAuthorManager.hasTrailer(currentMessage)) {
        const cleaned = this.coAuthorManager.removeTrailer(currentMessage);
        const updated = this.coAuthorManager.appendTrailer(cleaned, tool);
        this.gitService.setInputBoxValue(updated);
      }
    }

    this.state.selectedTool = tool;
    await this.persistState();
    this.statusBar.update(this.state.enabled, this.state.selectedTool);

    // If not enabled yet, enable
    if (!this.state.enabled) {
      this.state.enabled = true;
      await this.persistState();
      vscode.commands.executeCommand("setContext", "aicomtrace.enabled", true);

      const autoAppend = vscode.workspace
        .getConfiguration("aicomtrace")
        .get<boolean>("autoAppend", true);
      if (autoAppend) {
        this.appendTrailerToInputBox();
      }
    }

    vscode.window.showInformationMessage(
      `AIComTrace: Selected ${tool.name} as AI Co-Author`
    );
  }

  /**
   * Commits with the AI co-author trailer appended.
   */
  async commitWithCoAuthor(): Promise<void> {
    if (!this.state.selectedTool) {
      const tool = await this.promptToolSelection();
      if (!tool) {
        return;
      }
      this.state.selectedTool = tool;
      this.state.enabled = true;
      await this.persistState();
    }

    const currentMessage = this.gitService.getInputBoxValue();
    if (!currentMessage.trim()) {
      vscode.window.showWarningMessage(
        "AIComTrace: Please enter a commit message first."
      );
      return;
    }

    const finalMessage = this.coAuthorManager.appendTrailer(
      currentMessage,
      this.state.selectedTool!
    );

    try {
      await this.gitService.commit(finalMessage);
      // Clear the input box after successful commit
      this.gitService.setInputBoxValue("");
      vscode.window.showInformationMessage(
        `AIComTrace: Committed with Co-authored-by: ${this.state.selectedTool!.name}`
      );
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `AIComTrace: Commit failed – ${error.message || error}`
      );
    }
  }

  /**
   * Adds a custom AI tool via input boxes.
   */
  async addCustomTool(): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: "Enter the AI tool name",
      placeHolder: "e.g., My Custom AI",
      validateInput: (value) =>
        value.trim() ? null : "Name cannot be empty",
    });

    if (!name) {
      return;
    }

    const email = await vscode.window.showInputBox({
      prompt: "Enter the email for Co-authored-by trailer",
      placeHolder: "e.g., ai@example.com",
      validateInput: (value) => {
        if (!value.trim()) {
          return "Email cannot be empty";
        }
        if (!value.includes("@")) {
          return "Please enter a valid email address";
        }
        return null;
      },
    });

    if (!email) {
      return;
    }

    const config = vscode.workspace.getConfiguration("aicomtrace");
    const customTools = config.get<Array<{ name: string; email: string }>>(
      "customTools",
      []
    );

    // Check for duplicates
    if (customTools.some((t) => t.name === name || t.email === email)) {
      vscode.window.showWarningMessage(
        `AIComTrace: A custom tool with this name or email already exists.`
      );
      return;
    }

    customTools.push({ name: name.trim(), email: email.trim() });
    await config.update(
      "customTools",
      customTools,
      vscode.ConfigurationTarget.Global
    );

    vscode.window.showInformationMessage(
      `AIComTrace: Added custom AI tool "${name}"`
    );
  }

  /**
   * Removes the Co-authored-by trailer from the current input box.
   */
  removeTrailer(): void {
    this.removeTrailerFromInputBox();
    vscode.window.showInformationMessage(
      "AIComTrace: Co-authored-by trailer removed"
    );
  }

  /**
   * Returns the current extension state.
   */
  getState(): ExtensionState {
    return { ...this.state };
  }

  /**
   * Disposes all registered commands.
   */
  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }

  // ── Private helpers ──────────────────────────────────────

  /**
   * Shows a Quick Pick menu for AI tool selection.
   */
  private async promptToolSelection(): Promise<AITool | null> {
    const tools = this.coAuthorManager.getAllTools();

    const items: vscode.QuickPickItem[] = tools.map((tool) => ({
      label: tool.name,
      description: tool.email,
      detail: `Co-authored-by: ${tool.name} <${tool.email}>`,
    }));

    // Add separator and custom option
    items.push(
      { label: "", kind: vscode.QuickPickItemKind.Separator },
      {
        label: "$(add) Add Custom AI Tool...",
        description: "",
        detail: "Configure a new AI tool with custom name and email",
      }
    );

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select the AI tool used for this code change",
      title: "AIComTrace – Select AI Tool",
    });

    if (!selected) {
      return null;
    }

    // Handle "Add Custom" option
    if (selected.label.includes("Add Custom")) {
      await this.addCustomTool();
      // After adding, let the user pick again
      return this.promptToolSelection();
    }

    return tools.find((t) => t.name === selected.label) ?? null;
  }

  /**
   * Appends the trailer to the current SCM input box.
   */
  private appendTrailerToInputBox(): void {
    if (!this.state.selectedTool) {
      return;
    }

    const currentMessage = this.gitService.getInputBoxValue();
    const updated = this.coAuthorManager.appendTrailer(
      currentMessage,
      this.state.selectedTool
    );
    this.gitService.setInputBoxValue(updated);
  }

  /**
   * Removes the trailer from the current SCM input box.
   */
  private removeTrailerFromInputBox(): void {
    const currentMessage = this.gitService.getInputBoxValue();
    if (this.coAuthorManager.hasTrailer(currentMessage)) {
      const cleaned = this.coAuthorManager.removeTrailer(currentMessage);
      this.gitService.setInputBoxValue(cleaned);
    }
  }

  /**
   * Persists the current state to global storage.
   */
  private async persistState(): Promise<void> {
    await this.context.globalState.update("enabled", this.state.enabled);
    await this.context.globalState.update(
      "selectedTool",
      this.state.selectedTool
    );
  }
}
