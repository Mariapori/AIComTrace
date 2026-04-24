/**
 * AIComTrace – Extension Entry Point
 *
 * Activates the extension, initializes all services, and registers
 * commands, status bar items, and event listeners.
 */

import * as vscode from "vscode";
import { CoAuthorManager } from "./coAuthorManager";
import { GitService } from "./gitService";
import { StatusBarManager } from "./statusBar";
import { CommandManager } from "./commands";

let commandManager: CommandManager | undefined;
let statusBar: StatusBarManager | undefined;
let gitService: GitService | undefined;

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  console.log("AIComTrace: Activating extension...");

  // Initialize services
  const coAuthorManager = new CoAuthorManager();
  gitService = new GitService();
  statusBar = new StatusBarManager();

  // Initialize Git API
  const gitReady = await gitService.initialize();
  if (!gitReady) {
    console.warn(
      "AIComTrace: Git API not available. Some features may be limited."
    );
  }

  // Create command manager and register commands
  commandManager = new CommandManager(
    context,
    coAuthorManager,
    gitService,
    statusBar
  );
  commandManager.registerCommands();

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("aicomtrace")) {
        // Re-read the state and update status bar
        const state = commandManager!.getState();
        statusBar!.update(state.enabled, state.selectedTool);
      }
    })
  );

  // Register disposables
  context.subscriptions.push({
    dispose: () => {
      commandManager?.dispose();
      statusBar?.dispose();
    },
  });

  // If the extension was previously enabled, set the commit template on startup
  const state = commandManager.getState();
  if (state.enabled && state.selectedTool) {
    const trailer = coAuthorManager.formatTrailer(state.selectedTool);
    gitService.setCommitTemplate(trailer);
  }

  console.log("AIComTrace: Extension activated successfully");
}

export function deactivate(): void {
  console.log("AIComTrace: Extension deactivating...");

  // Clean up commit templates from all repositories
  gitService?.clearAllCommitTemplates();

  commandManager?.dispose();
  statusBar?.dispose();
}
