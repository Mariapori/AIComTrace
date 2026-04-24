/**
 * AIComTrace – Git Service
 *
 * Interfaces with the VS Code built-in Git extension to read/write
 * the SCM input box and perform commits.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as cp from "child_process";
import { GitExtensionAPI, GitAPI, Repository } from "./types";

/** Name of the template file stored inside .git */
const TEMPLATE_FILENAME = ".aicomtrace-commit-template";

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
   * Sets the git commit.template for the active repository.
   * Creates a template file inside .git/ and sets the local git config.
   * The template contains a blank line followed by the Co-authored-by trailer,
   * so it automatically appears in the editor when committing from the CLI.
   */
  setCommitTemplate(trailer: string): void {
    const repo = this.getActiveRepository();
    if (!repo) {
      console.warn("AIComTrace: No repository found – cannot set commit template");
      return;
    }

    const repoRoot = repo.rootUri.fsPath;
    const gitDir = path.join(repoRoot, ".git");

    // .git could be a file (worktree) – only handle the directory case
    if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
      console.warn("AIComTrace: .git directory not found – cannot set commit template");
      return;
    }

    const templatePath = path.join(gitDir, TEMPLATE_FILENAME);

    try {
      // Write the template: blank line + trailer (git uses this as default message)
      fs.writeFileSync(templatePath, `\n\n${trailer}\n`, "utf-8");

      // Set local git config to point to the template
      cp.execSync(
        `git config --local commit.template "${templatePath}"`,
        { cwd: repoRoot, stdio: "pipe" }
      );

      console.log(`AIComTrace: Set commit.template → ${templatePath}`);
    } catch (error) {
      console.error("AIComTrace: Failed to set commit.template:", error);
    }
  }

  /**
   * Clears the git commit.template previously set by AIComTrace.
   * Removes the template file and unsets the local git config.
   */
  clearCommitTemplate(): void {
    const repo = this.getActiveRepository();
    if (!repo) {
      return;
    }

    const repoRoot = repo.rootUri.fsPath;
    const gitDir = path.join(repoRoot, ".git");

    if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
      return;
    }

    const templatePath = path.join(gitDir, TEMPLATE_FILENAME);

    try {
      // Only unset if we're the ones who set it
      const currentTemplate = cp.execSync(
        "git config --local --get commit.template",
        { cwd: repoRoot, stdio: "pipe" }
      ).toString().trim();

      if (currentTemplate === templatePath) {
        cp.execSync(
          "git config --local --unset commit.template",
          { cwd: repoRoot, stdio: "pipe" }
        );
      }
    } catch {
      // config key doesn't exist – that's fine
    }

    try {
      if (fs.existsSync(templatePath)) {
        fs.unlinkSync(templatePath);
      }
    } catch (error) {
      console.error("AIComTrace: Failed to remove template file:", error);
    }

    console.log("AIComTrace: Cleared commit.template");
  }

  /**
   * Clears commit templates for ALL known repositories.
   * Used during extension deactivation to clean up.
   */
  clearAllCommitTemplates(): void {
    if (!this.gitApi) {
      return;
    }

    for (const repo of this.gitApi.repositories) {
      const repoRoot = repo.rootUri.fsPath;
      const gitDir = path.join(repoRoot, ".git");

      if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
        continue;
      }

      const templatePath = path.join(gitDir, TEMPLATE_FILENAME);

      try {
        const currentTemplate = cp.execSync(
          "git config --local --get commit.template",
          { cwd: repoRoot, stdio: "pipe" }
        ).toString().trim();

        if (currentTemplate === templatePath) {
          cp.execSync(
            "git config --local --unset commit.template",
            { cwd: repoRoot, stdio: "pipe" }
          );
        }
      } catch {
        // config key doesn't exist
      }

      try {
        if (fs.existsSync(templatePath)) {
          fs.unlinkSync(templatePath);
        }
      } catch {
        // ignore cleanup errors
      }
    }
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
