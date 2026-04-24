/**
 * AIComTrace – Co-Author Manager
 *
 * Manages the Co-authored-by trailer: formatting, appending,
 * removing, and detecting trailers in commit messages.
 */

import * as vscode from "vscode";
import { AITool, CustomToolConfig } from "./types";

/**
 * Built-in AI tools with their standard identities.
 */
export const BUILTIN_AI_TOOLS: ReadonlyArray<AITool> = [
  { name: "GitHub Copilot", email: "copilot@github.com" },
  { name: "Claude (Anthropic)", email: "claude@anthropic.com" },
  { name: "ChatGPT (OpenAI)", email: "chatgpt@openai.com" },
  { name: "Google Gemini", email: "gemini@google.com" },
  { name: "Cursor AI", email: "cursor@cursor.com" },
  { name: "Windsurf (Codeium)", email: "windsurf@codeium.com" },
];

/**
 * Regex pattern matching a Co-authored-by trailer line.
 * Matches: Co-authored-by: Name <email>
 */
const CO_AUTHOR_REGEX = /^Co-authored-by:\s+.+\s+<.+>$/m;

/**
 * Regex pattern matching any AIComTrace-generated Co-authored-by trailer.
 * Uses a global + multiline flag to remove all occurrences.
 */
const CO_AUTHOR_REGEX_GLOBAL = /\n?\nCo-authored-by:\s+.+\s+<.+>/gm;

export class CoAuthorManager {
  /**
   * Returns all available AI tools: built-in + user-configured custom tools.
   */
  getAllTools(): AITool[] {
    const config = vscode.workspace.getConfiguration("aicomtrace");
    const customTools = config.get<CustomToolConfig[]>("customTools", []);

    return [
      ...BUILTIN_AI_TOOLS,
      ...customTools.map((t) => ({ name: t.name, email: t.email })),
    ];
  }

  /**
   * Formats a Co-authored-by trailer string for the given tool.
   */
  formatTrailer(tool: AITool): string {
    return `Co-authored-by: ${tool.name} <${tool.email}>`;
  }

  /**
   * Appends a Co-authored-by trailer to a commit message.
   * If the message already contains a trailer for this tool, it is not duplicated.
   * The trailer is separated from the message body by a blank line (Git convention).
   */
  appendTrailer(message: string, tool: AITool): string {
    const trailer = this.formatTrailer(tool);

    // Don't duplicate
    if (message.includes(trailer)) {
      return message;
    }

    // Remove any existing AI co-author trailers first
    const cleanMessage = this.removeTrailer(message);

    // Ensure proper separation: blank line before trailer
    const trimmed = cleanMessage.trimEnd();
    if (trimmed.length === 0) {
      return trimmed;
    }

    return `${trimmed}\n\n${trailer}`;
  }

  /**
   * Removes all Co-authored-by trailers from a commit message.
   */
  removeTrailer(message: string): string {
    return message.replace(CO_AUTHOR_REGEX_GLOBAL, "").trimEnd();
  }

  /**
   * Checks whether the message already contains a Co-authored-by trailer.
   */
  hasTrailer(message: string): boolean {
    return CO_AUTHOR_REGEX.test(message);
  }

  /**
   * Finds the AI tool matching a trailer in the message, if any.
   */
  findToolInMessage(message: string): AITool | null {
    const tools = this.getAllTools();
    for (const tool of tools) {
      if (message.includes(this.formatTrailer(tool))) {
        return tool;
      }
    }
    return null;
  }
}
