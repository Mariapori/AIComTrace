# AIComTrace

> Add **Co-authored-by** trailers to your git commits when code changes are made with AI assistance.

![VS Code](https://img.shields.io/badge/VS%20Code-^1.85.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- 🤖 **One-click toggle** – Enable/disable AI co-author attribution from the status bar
- 🔧 **Multiple AI tools** – Built-in support for GitHub Copilot, Claude, ChatGPT, Gemini, Cursor, and Windsurf
- ✏️ **Custom tools** – Add your own AI tools with custom names and emails
- 📝 **Auto-append** – Automatically adds the `Co-authored-by` trailer to your commit message
- 🎯 **Commit command** – Dedicated "Commit with AI Co-Author" command in the SCM title bar
- 💾 **Persistent state** – Remembers your selection across VS Code sessions

## How It Works

When enabled, AIComTrace appends a standard Git `Co-authored-by` trailer to your commit messages:

```
feat: add new login component

Co-authored-by: Claude (Anthropic) <claude@anthropic.com>
```

This follows the [Git trailer convention](https://git-scm.com/docs/git-interpret-trailers) recognized by GitHub, GitLab, and other platforms.

## Usage

### Quick Start

1. Click the **`$(hubot) AI: Off`** button in the status bar
2. Select the AI tool you used (e.g., Claude, ChatGPT, Copilot)
3. The status bar shows **`$(hubot) AI: Claude (Anthropic)`** when active
4. Write your commit message and commit as usual – the trailer is added automatically

### Commands

Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and type "AIComTrace":

| Command | Description |
|---------|-------------|
| `AIComTrace: Toggle AI Co-Author` | Turn AI co-author on/off |
| `AIComTrace: Select AI Tool` | Choose which AI tool to attribute |
| `AIComTrace: Commit with AI Co-Author` | Commit with the trailer appended |
| `AIComTrace: Add Custom AI Tool` | Add a new AI tool to the list |
| `AIComTrace: Remove Co-authored-by Trailer` | Remove the trailer from the current commit message |

### Built-in AI Tools

| Tool | Email |
|------|-------|
| GitHub Copilot | `copilot@github.com` |
| Claude (Anthropic) | `claude@anthropic.com` |
| ChatGPT (OpenAI) | `chatgpt@openai.com` |
| Google Gemini | `gemini@google.com` |
| Cursor AI | `cursor@cursor.com` |
| Windsurf (Codeium) | `windsurf@codeium.com` |

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `aicomtrace.enabled` | boolean | `false` | Enable AI Co-authored-by trailer |
| `aicomtrace.defaultTool` | string | `""` | Default AI tool (skip selection dialog) |
| `aicomtrace.customTools` | array | `[]` | Custom AI tools `[{name, email}]` |
| `aicomtrace.autoAppend` | boolean | `true` | Auto-append trailer to the SCM input box |

### Example: Adding a Custom Tool via Settings

```json
{
  "aicomtrace.customTools": [
    {
      "name": "My Local LLM",
      "email": "llm@local.dev"
    }
  ]
}
```

## Installation

### From VSIX (Local)

1. Build the extension: `npm run package`
2. Install: `code --install-extension aicomtrace-0.1.0.vsix`

### From Source

```bash
git clone https://github.com/mariapori/AIComTrace.git
cd AIComTrace
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

## Development

```bash
npm install          # Install dependencies
npm run compile      # Build once
npm run watch        # Build and watch for changes
npm run lint         # Run ESLint
npm run package      # Production build
```

## License

MIT
