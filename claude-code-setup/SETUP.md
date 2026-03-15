# JetStack AI — Claude Code Setup Guide

This guide explains how to set up your project so your team can use JetStack AI through Claude Code.

## Prerequisites

- Node.js 18+ installed
- Claude Code installed and working
- JetStack AI dashboard access (to generate Access Tokens)

## Step 1: Install the CLI

```bash
npm install -g @jetstackai/cli
```

Verify installation:
```bash
jetstackai --version
```

## Step 2: Authenticate

1. Open the JetStack AI dashboard
2. Go to **Settings → Access Tokens**
3. Click **Generate New Token**
4. Select your scopes (use "Operator" for full import/deploy access)
5. Copy both the **Instance ID** and **Access Token**

Then authenticate:
```bash
jetstackai auth login
```

Paste the Instance ID and Access Token when prompted.

Verify:
```bash
jetstackai auth status
```

## Step 3: Add Claude Code Integration to Your Project

Copy the following files to your project root:

### `CLAUDE.md`

Copy `claude-code-setup/CLAUDE.md` to your project root. This file is automatically loaded by Claude Code and teaches it about the `jetstackai` CLI.

```bash
cp CLAUDE.md /path/to/your/project/CLAUDE.md
```

### `.claude/commands/` (Slash Commands)

Copy the entire `.claude/commands/` directory to your project. These become slash commands you can use in Claude Code.

```bash
cp -r .claude /path/to/your/project/.claude
```

### Quick copy (both at once)

```bash
# From the claude-code-setup directory:
cp CLAUDE.md /path/to/your/project/
cp -r .claude /path/to/your/project/
```

## Step 4: Verify in Claude Code

Open Claude Code in your project and try:

```
/jetstack-setup
```

This will verify your installation and show available portals.

Other available commands:
- `/jetstack-status` — Full status report (portals, assets, modules, tasks)
- `/jetstack-browse` — Browse assets in a HubSpot portal
- `/jetstack-import` — Guided import workflow
- `/jetstack-deploy` — Guided deploy workflow
- `/jetstack-assets` — Explore your asset library
- `/jetstack-modules` — Explore implementation modules

## How It Works

1. **CLAUDE.md** gives Claude Code knowledge of all CLI commands, asset types, and common workflows
2. **Slash commands** provide guided workflows — Claude Code follows the steps and runs CLI commands automatically
3. **The CLI** talks to the JetStack AI REST API using your Access Token
4. **Everything is JSON** by default, so Claude Code can parse and reason about the data

## Team Setup

Each team member needs to:
1. Install the CLI: `npm install -g @jetstackai/cli`
2. Get their own Access Token from the dashboard
3. Run `jetstackai auth login` with their token

The `CLAUDE.md` and `.claude/commands/` files are committed to the repo, so they're shared automatically.

## Example Conversations

### "What portals do we have connected?"
Claude Code will run `jetstackai portals list --format table` and show you the results.

### "Import all workflows from portal 12345"
Claude Code will browse the portal, show available workflows, and guide you through the import.

### "Deploy the attribution module to the client portal"
Claude Code will find the module, check mapping requirements, help you configure mappings, and execute the deployment.

### "Show me the module index for our lead scoring template"
Claude Code will find the module and display its structured index showing all assets, dependencies, and what can be customized.
