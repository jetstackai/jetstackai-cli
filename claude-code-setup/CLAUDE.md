# JetStack AI — Claude Code Integration

This project uses JetStack AI for HubSpot asset management. The `jetstackai` CLI provides programmatic access to portals, assets, modules, import/deploy operations, and mapping.

## CLI Reference

### Authentication
```bash
jetstackai auth login      # Authenticate with Instance ID + Access Token
jetstackai auth status     # Verify connection, show scopes
jetstackai auth whoami     # Show current config
jetstackai auth logout     # Remove credentials
```

### Portals (Connected HubSpot Accounts)
```bash
jetstackai portals list                  # JSON output (default)
jetstackai portals list --format table   # Human-readable table
```

### Assets (Imported HubSpot Assets)
```bash
jetstackai assets list                          # List all assets
jetstackai assets list --type workflows         # Filter by type
jetstackai assets list --portal <portalId>      # Filter by portal
jetstackai assets get <id>                      # Get asset details + dependencies
jetstackai assets schema <id>                   # View raw HubSpot JSON schema
jetstackai assets rename <id> "New Name"        # Rename an asset
jetstackai assets delete <id>                   # Delete an asset
```

### Modules (Implementation Templates)
```bash
jetstackai modules list                  # List all modules
jetstackai modules get <id>              # Get module details (assets, deps)
jetstackai modules index <id>            # View structured module index
jetstackai modules create <name>         # Create a new module
jetstackai modules delete <id>           # Delete a module
```

### HubSpot (Browse Connected Portals)
```bash
jetstackai hubspot browse <portalId> workflows    # List workflows in a portal
jetstackai hubspot browse <portalId> forms        # List forms
jetstackai hubspot browse <portalId> emails       # List emails
jetstackai hubspot browse <portalId> lists        # List lists
jetstackai hubspot browse <portalId> pipelines    # List pipelines
jetstackai hubspot browse <portalId> pages        # List CMS pages
jetstackai hubspot browse <portalId> templates    # List CMS templates
jetstackai hubspot browse <portalId> blogPosts    # List blog posts
jetstackai hubspot browse <portalId> hubdbTables  # List HubDB tables
```

### Import (From HubSpot → Library)
```bash
jetstackai import start --portal <portalId> --assets '{"workflows":["id1","id2"]}'
jetstackai import status <taskId>        # Check progress
jetstackai import watch <taskId>         # Poll until complete
```

### Deploy (From Library → HubSpot)
```bash
jetstackai deploy start --source <portalId> --target <portalId> --assets <json> [--mappings <json>]
jetstackai deploy status <taskId>        # Check progress
jetstackai deploy watch <taskId>         # Poll until complete
```

### Mapping (For Deployment)
```bash
jetstackai mapping structure --source <portalId> --target <portalId> --assets <json>
jetstackai mapping destinations --portal <portalId> --type <assetType>
jetstackai mapping validate --source <portalId> --target <portalId> --mappings <json>
```

### Tasks (Background Jobs)
```bash
jetstackai tasks list                    # List all tasks
jetstackai tasks list --status running   # Filter by status
jetstackai tasks get <id>                # Get task details
```

### Audits (HubSpot Portal Health Assessment)
```bash
jetstackai audits list-blocks --format table                    # List all 28 audit blocks
jetstackai audits list-blocks --report-type SIMPLE              # Blocks for public API audits
jetstackai audits list-templates --format table                 # List available templates
jetstackai audits get-template <id>                             # Get template details
jetstackai audits create-template --name "My Audit" --blocks DEAL_PIPELINE,EMAIL_MARKETING --report-type SIMPLE
                                                                # Create a custom template
jetstackai audits run --name "Q1 Audit" --template <id> --portal <id>
                                                                # Start an audit
jetstackai audits run --name "Q1 Audit" --template <id> --portal <id> --watch
                                                                # Start and watch until complete
jetstackai audits status <auditRunId>                           # Check audit progress
jetstackai audits status <auditRunId> --watch                   # Poll until complete
jetstackai audits data <auditRunId>                             # Fetch full audit results
```

**MCP Tools (for Claude integration):**
If connected via MCP server, the following tools are available:
- `list_audit_blocks` — discover available blocks for template creation
- `list_audit_templates` / `get_audit_template` — browse and inspect templates
- `create_audit_template` — create a template from block IDs
- `run_audit` — start an audit (portal name/tier auto-resolved)
- `get_audit_status` — poll audit progress (created → processing → completed)
- `get_audit_data` — fetch full report with block definitions, data points, health scores

## Audit Block Categories
The 28 audit blocks are organized into 6 categories:
- **General** (6): Executive Dashboard, Portal Overview, User Management, Data Quality, Property Management, Integration Health
- **Sales** (5): Deal Pipeline, Deal Performance, Sales Activity, Lead Management, Quotes & Products
- **Marketing** (6): Email Marketing, Forms & Conversion, Content Performance, Campaign Management, List Segmentation, Social Media
- **Service** (4): Ticket Pipeline, Resolution Metrics, Customer Feedback, Knowledge Base
- **Automation** (3): Workflow Health, Sequence Performance, Lead Scoring
- **Reporting** (3): Dashboard Health, Report Quality, Analytics Config

## Asset Types
The following HubSpot asset types are supported:

**CRM Assets:** workflows, lists, forms, emails, pipelines
**CMS Assets:** pages, templates, blogPosts, hubdbTables

## Output Formats
- Default output is **JSON** — ideal for programmatic parsing
- Use `--format table` for human-readable output
- JSON output can be piped to other tools: `jetstackai assets list | jq '.items[].name'`

## Common Workflows

### Check what's available
1. `jetstackai portals list --format table` — see connected portals
2. `jetstackai assets list --format table` — see what's in the library
3. `jetstackai modules list --format table` — see available modules

### Import assets from HubSpot
1. `jetstackai hubspot browse <portalId> workflows` — find assets to import
2. `jetstackai import start --portal <portalId> --assets '{"workflows":["id1"]}'`
3. `jetstackai import watch <taskId>` — wait for completion

### Deploy assets to a target portal
1. `jetstackai mapping structure --source <src> --target <tgt> --assets <json>` — check what needs mapping
2. `jetstackai mapping destinations --portal <tgt> --type properties` — get mapping options
3. `jetstackai deploy start --source <src> --target <tgt> --assets <json> --mappings <json>`
4. `jetstackai deploy watch <taskId>` — wait for completion

### Run an audit and build a report
1. `jetstackai audits list-blocks --report-type SIMPLE --format table` — see available blocks
2. `jetstackai audits list-templates --format table` — see existing templates (or create one)
3. `jetstackai audits run --name "Q1 Audit" --template <id> --portal <id> --watch` — run and wait
4. `jetstackai audits data <auditRunId>` — fetch results
5. Use `/jetstack-audit-report` to build a McKinsey-level report from the data

**Via MCP tools:** Use `list_audit_blocks` → `run_audit` → `get_audit_status` (poll) → `get_audit_data` → build report.

## Tips
- Always verify connectivity first: `jetstackai auth status`
- Use `--format table` when exploring, default JSON when automating
- Import and deploy are async — always check status or use `watch`
- Asset IDs from `assets list` are Firestore IDs; HubSpot IDs are in the details
- For audits, only SIMPLE report type works via API/CLI — ADVANCED requires the Chrome extension
