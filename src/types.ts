/**
 * AIComTrace – Type definitions
 */

/**
 * Represents an AI tool that can be listed as a co-author.
 */
export interface AITool {
  /** Display name shown in Quick Pick and status bar */
  name: string;
  /** Email used in the Co-authored-by trailer */
  email: string;
}

/**
 * Extension-wide state persisted in workspace storage.
 */
export interface ExtensionState {
  /** Whether AI co-author mode is currently active */
  enabled: boolean;
  /** Currently selected AI tool (null if none) */
  selectedTool: AITool | null;
}

/**
 * Custom tool entry as stored in user settings.
 */
export interface CustomToolConfig {
  name: string;
  email: string;
}

/**
 * Git extension API types (subset of vscode.git).
 * These mirror the built-in Git extension's exported API.
 */
export interface GitExtensionAPI {
  getAPI(version: 1): GitAPI;
}

export interface GitAPI {
  repositories: Repository[];
  onDidOpenRepository: (handler: (repo: Repository) => void) => { dispose(): void };
  onDidCloseRepository: (handler: (repo: Repository) => void) => { dispose(): void };
}

export interface Repository {
  inputBox: InputBox;
  state: RepositoryState;
  commit(message: string, opts?: CommitOptions): Promise<void>;
  rootUri: { fsPath: string };
}

export interface InputBox {
  value: string;
}

export interface RepositoryState {
  HEAD: Ref | undefined;
  indexChanges: Change[];
  workingTreeChanges: Change[];
}

export interface Ref {
  name?: string;
  commit?: string;
}

export interface Change {
  uri: { fsPath: string };
  status: number;
}

export interface CommitOptions {
  all?: boolean;
  empty?: boolean;
}
