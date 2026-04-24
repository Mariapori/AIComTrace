/**
 * AIComTrace – Git Service
 *
 * Interfaces with the VS Code built-in Git extension to read/write
 * the SCM input box and perform commits.
 */

import * as vscode from "vscode";
import { GitExtensionAPI, GitAPI, Repository } from "./types";

export class GitService {
  private gitApi: GitAPI | null = null;

  /**
   * Initializes the Git service by acquiring the built-in Git extension API.
   * Returns true if the Git API is available.
   */
  async initialize(): Promise<boolean> {
    try {
      const gitExtension =
        vscode.extensions.getExtension<GitExtensionAPI>("vscode.git");

      if (!gitExtension) {
        vscode.window.showWarningMessage(
          "AIComTrace: Git extension not found. Please install the built-in Git extension."
        );
        return false;
      }

      if (!gitExtension.isActive) {
        await gitExtension.activate();
      }

      this.gitApi = gitExtension.exports.getAPI(1);
      return true;
    } catch (error) {
      console.error("AIComTrace: Failed to initialize Git API:", error);
      return false;
    }
  }

  /**
   * Returns the Git API instance. Throws if not initialized.
   */
  getApi(): GitAPI {
    if (!this.gitApi) {
      throw new Error("AIComTrace: Git API not initialized");
    }
    return this.gitApi;
  }

  /**
   * Returns the active repository (first one, or the one matching the active editor).
   */
  getActiveRepository(): Repository | null {
    if (!this.gitApi) {
      return null;
    }

    const repos = this.gitApi.repositories;
    if (repos.length === 0) {
      return null;
    }

    // If there's only one repo, return it
    if (repos.length === 1) {
      return repos[0];
    }

    // Try to find the repo matching the active editor's file
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const filePath = activeEditor.document.uri.fsPath;
      for (const repo of repos) {
        if (filePath.startsWith(repo.rootUri.fsPath)) {
          return repo;
        }
      }
    }

    // Fallback to the first repo
    return repos[0];
  }

  /**
   * Gets the current SCM input box value for the active repository.
   */
  getInputBoxValue(): string {
    const repo = this.getActiveRepository();
    return repo?.inputBox.value ?? "";
  }

  /**
   * Sets the SCM input box value for the active repository.
   */
  setInputBoxValue(value: string): void {
    const repo = this.getActiveRepository();
    if (repo) {
      repo.inputBox.value = value;
    }
  }

  /**
   * Performs a git commit using the built-in Git extension.
   * The message should already include any trailers.
   */
  async commit(message: string): Promise<void> {
    const repo = this.getActiveRepository();
    if (!repo) {
      throw new Error("No Git repository found");
    }

    if (!message.trim()) {
      throw new Error("Commit message cannot be empty");
    }

    // Check if there are staged changes
    if (repo.state.indexChanges.length === 0) {
      // No staged changes – ask the user if they want to stage all
      const answer = await vscode.window.showWarningMessage(
        "No staged changes. Do you want to stage all changes and commit?",
        "Stage All & Commit",
        "Cancel"
      );

      if (answer === "Stage All & Commit") {
        await repo.commit(message, { all: true });
      }
      return;
    }

    await repo.commit(message);
  }

  /**
   * Registers a callback for when repositories change.
   */
  onDidChangeRepositories(
    callback: (repos: Repository[]) => void
  ): vscode.Disposable | null {
    if (!this.gitApi) {
      return null;
    }

    const disposables: vscode.Disposable[] = [];

    disposables.push(
      this.gitApi.onDidOpenRepository(() => {
        callback(this.gitApi!.repositories);
      })
    );

    disposables.push(
      this.gitApi.onDidCloseRepository(() => {
        callback(this.gitApi!.repositories);
      })
    );

    return vscode.Disposable.from(...disposables);
  }
}
