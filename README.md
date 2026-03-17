# JetStack AI CLI

Manage HubSpot assets programmatically via the command line.

## Installation

```bash
npm install -g @jetstackai/cli
```

## Quick Start

1. Go to your **JetStack AI dashboard** > **Settings** > **Access Tokens**
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

| Command                  | Description                              |
| ------------------------ | ---------------------------------------- |
| `jetstackai auth login`  | Authenticate with JetStack AI            |
| `jetstackai auth logout` | Remove stored credentials                |
| `jetstackai auth status` | Check authentication and connection status |
| `jetstackai auth whoami` | Show current authentication details      |

### Portals

| Command                  | Description                    |
| ------------------------ | ------------------------------ |
| `jetstackai portals list`| List connected HubSpot portals |

### Assets

| Command                              | Description                           |
| ------------------------------------ | ------------------------------------- |
| `jetstackai assets list`             | List all imported assets              |
| `jetstackai assets get <id>`         | Get asset details by ID               |
| `jetstackai assets schema <id>`      | View raw HubSpot schema for an asset  |
| `jetstackai assets rename <id> <name>` | Rename an asset                     |
| `jetstackai assets delete <id>`      | Delete an asset                       |

### Modules

| Command                              | Description                     |
| ------------------------------------ | ------------------------------- |
| `jetstackai modules list`            | List all modules                |
| `jetstackai modules get <id>`        | Get module details by ID        |
| `jetstackai modules index <id>`      | View module index structure     |
| `jetstackai modules create <name>`   | Create a new module             |
| `jetstackai modules delete <id>`     | Delete a module                 |

### HubSpot

| Command                    | Description                        |
| -------------------------- | ---------------------------------- |
| `jetstackai hubspot browse`| Browse HubSpot assets in a portal  |

### Import

| Command                              | Description                              |
| ------------------------------------ | ---------------------------------------- |
| `jetstackai import start`            | Start importing assets from HubSpot      |
| `jetstackai import status <taskId>`  | Check import task progress               |
| `jetstackai import watch <taskId>`   | Watch import progress in real-time       |

### Deploy

| Command                              | Description                              |
| ------------------------------------ | ---------------------------------------- |
| `jetstackai deploy start`            | Start deploying assets to target portal  |
| `jetstackai deploy status <taskId>`  | Check deployment task progress           |
| `jetstackai deploy watch <taskId>`   | Watch deployment progress in real-time   |

### Mapping

| Command                              | Description                         |
| ------------------------------------ | ----------------------------------- |
| `jetstackai mapping structure`       | View mapping structure overview     |
| `jetstackai mapping destinations`    | View or set mapping destinations    |
| `jetstackai mapping validate`        | Validate mapping configuration      |

### Tasks

| Command                      | Description                |
| ---------------------------- | -------------------------- |
| `jetstackai tasks list`      | List all tasks             |
| `jetstackai tasks get <id>`  | Get task details by ID     |

## Output Formats

Most list commands support `--format` to control output:

```bash
# JSON output (default)
jetstackai portals list

# Table output
jetstackai portals list --format table
```

You can also set the default format during login, or by editing `~/.jetstackai/config.json`:

```json
{
  "instanceId": "...",
  "accessToken": "jsai_...",
  "defaultFormat": "table"
}
```

## Claude Code Integration

JetStack AI CLI works with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) for AI-assisted HubSpot asset management. After authenticating, Claude Code can use the CLI to list portals, inspect assets, and manage deployments on your behalf.

```bash
# Example: Let Claude Code list your portals
jetstackai portals list --format json
```

## Configuration

Credentials are stored locally at `~/.jetstackai/config.json`. Use `jetstackai auth logout` to remove them.

## Documentation

For full documentation, visit [https://jetstack.ai/docs](https://jetstack.ai/docs).

## License

MIT
