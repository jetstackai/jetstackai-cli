Check the JetStack AI connection status and give me an overview of what's available.

1. Run `jetstackai auth status` to verify the API connection. If not connected, tell me to run `/jetstack-setup` first.

2. Run `jetstackai portals list --format table` to show all connected HubSpot portals.

3. Run `jetstackai assets list` to get the asset library. Summarize: total count, breakdown by type (workflows, forms, emails, lists, pages, etc.).

4. Run `jetstackai modules list` to get available modules. Summarize: total count, list each module name.

5. Run `jetstackai tasks list` to check for any running or recent tasks. Summarize any active imports or deployments.

Present everything as a clean status report.
