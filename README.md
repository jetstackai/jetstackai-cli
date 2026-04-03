# JetStack AI CLI

Manage HubSpot assets programmatically via the command line.

## Installation

```bash
npm install -g @jetstackai/cli
```

## Quick Start

1. Go to your **JetStack AI dashboard** > **Settings** > **API Keys**
2. Generate a new token and copy both the **Instance ID** and **Access Token**
3. Run the login command:

```bash
jetstackai auth login
```

You will be prompted to enter your Instance ID and Access Token:

```
JetStack AI - Authentication

Enter your Instance ID: <paste Instance ID from dashboard>
Enter your Access Token: <paste Access Token from dashboard>

Validating credentials...
✓ Connected successfully
  Organization: org_xxx
  Scopes: portals:read, assets:read, ...
```

## Command Reference

### Authentication

| Command | Description |
|---------|-------------|
| `jetstackai auth login` | Authenticate with JetStack AI |
| `jetstackai auth logout` | Remove stored credentials |
| `jetstackai auth status` | Check authentication and connection status |
| `jetstackai auth whoami` | Show current authentication details |

### Portals

| Command | Description |
|---------|-------------|
| `jetstackai portals list` | List connected HubSpot portals |

### HubSpot Browse

| Command | Description |
|---------|-------------|
| `jetstackai hubspot browse <portalId> <assetType>` | Browse assets in a HubSpot portal |

Supported asset types: `workflows`, `forms`, `emails`, `lists`, `pipelines`, `pages`, `templates`, `blogPosts`, `hubdbTables`, `properties`, `propertyGroups`, `customObjects`

```bash
jetstackai hubspot browse abc123 workflows --format table
jetstackai hubspot browse abc123 properties --object-type contacts
```

### Import

| Command | Description |
|---------|-------------|
| `jetstackai import start --portal <id> --assets <type:id,...> --name <name>` | Import assets from HubSpot |
| `jetstackai import status <taskId> [--watch]` | Check/watch import progress |

```bash
jetstackai import start --portal abc123 --assets workflows:101,forms:202 --name "Q1 Import"
jetstackai import status task123 --watch
```

### Assets

| Command | Description |
|---------|-------------|
| `jetstackai assets list [--type <type>] [--portal <id>] [--limit <n>]` | List imported library assets |

```bash
jetstackai assets list --type workflows --format table
jetstackai assets list --portal abc123 --limit 50
```

### Modules

| Command | Description |
|---------|-------------|
| `jetstackai modules list` | List modules (playbooks) |
| `jetstackai modules get <id>` | Get module details |

### Deploy

| Command | Description |
|---------|-------------|
| `jetstackai deploy start --name <name> --source <id> --target <id> --assets <type:id,...> [--mapping <json>]` | Deploy assets to target portal |
| `jetstackai deploy status <taskId> [--watch]` | Check/watch deployment progress |

```bash
jetstackai deploy start --name "Prod Deploy" --source abc --target def --assets workflows:fsId1
jetstackai deploy status task123 --watch
```

### Mapping

| Command | Description |
|---------|-------------|
| `jetstackai mapping structure --source <id> --target <id> --assets <type:id,...>` | Get mapping requirements |
| `jetstackai mapping destinations --target <id> --type <assetType> [--object-type <type>]` | Get mapping targets in destination portal |

### Tasks

| Command | Description |
|---------|-------------|
| `jetstackai tasks list [--type <type>] [--status <status>]` | List background tasks |
| `jetstackai tasks get <id>` | Get task details |

### Audits

| Command | Description |
|---------|-------------|
| `jetstackai audits list-blocks [--report-type <type>] [--category <cat>]` | List available audit blocks |
| `jetstackai audits list-templates` | List audit templates |
| `jetstackai audits get-template <id>` | Get audit template details |
| `jetstackai audits create-template --name <name> --blocks <id,...> --report-type <type>` | Create audit template |
| `jetstackai audits run --name <name> --template <id> --portal <id> [--watch]` | Run an audit |
| `jetstackai audits status <auditRunId> [--watch]` | Check/watch audit progress |
| `jetstackai audits data <auditRunId>` | Fetch audit results |

```bash
jetstackai audits list-blocks --report-type SIMPLE --format table
jetstackai audits run --name "Q1 Audit" --template tpl123 --portal abc123 --watch
```

### Profiles

Search, scan, and inspect asset profiles for AI-driven matching and discovery.

| Command | Description |
|---------|-------------|
| `jetstackai profiles search [--type <type>] [--object-type <type>] [--portal <id>]` | Search library asset profiles |
| `jetstackai profiles scan <portalId> <assetType> [--fresh]` | Scan a HubSpot portal for profiles (cached 24h) |
| `jetstackai profiles scan-all <assetType> [--fresh]` | Scan all portals for profiles |
| `jetstackai profiles detail <type> <id>` | Get full raw asset data from MongoDB |
| `jetstackai profiles mermaid <id>` | Get Mermaid flowchart for an imported workflow |
| `jetstackai profiles preview-mermaid <portalId> <workflowId>` | Preview Mermaid flowchart without importing |

```bash
# Search for workflow profiles across your library
jetstackai profiles search --type workflows --object-type Contact --format table

# Scan a portal for workflow profiles (fresh from HubSpot)
jetstackai profiles scan abc123 workflows --fresh --format table

# Scan ALL portals for the best workflow match
jetstackai profiles scan-all workflows --format json

# Get Mermaid diagram for an imported workflow
jetstackai profiles mermaid workflow-doc-id

# Preview a workflow from HubSpot without importing
jetstackai profiles preview-mermaid abc123 12345
```

### Salesforce

| Command | Description |
|---------|-------------|
| `jetstackai salesforce list` | List Salesforce connections |

## Output Formats

Most commands support `--format` to control output:

```bash
# JSON output (default)
jetstackai portals list

# Table output
jetstackai portals list --format table
```

Set the default format during login, or by editing `~/.jetstackai/config.json`:

```json
{
  "instanceId": "...",
  "accessToken": "jsai_...",
  "defaultFormat": "table"
}
```

## Claude Code Integration

JetStack AI CLI works with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) for AI-assisted HubSpot asset management. After authenticating, Claude Code can use the CLI to browse portals, search asset profiles, generate workflow diagrams, and manage deployments.

## MCP Server

For direct AI integration via the Model Context Protocol, connect to `https://mcp.jetstack.ai` in Claude, ChatGPT, or other MCP-compatible AI assistants.

## Configuration

Credentials are stored locally at `~/.jetstackai/config.json`. Use `jetstackai auth logout` to remove them.

## Documentation

- Full docs: [https://jetstack.ai/docs](https://jetstack.ai/docs)
- API Reference: [https://jetstack.ai/api](https://jetstack.ai/api)

## License

MIT
