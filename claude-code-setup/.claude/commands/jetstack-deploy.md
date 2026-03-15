Help me deploy assets from the JetStack AI library to a target HubSpot portal.

1. Run `jetstackai portals list --format table` to show available portals.

2. Ask me to identify the **source portal** (where assets were imported from) and the **target portal** (where assets should be deployed to).

3. Ask what I want to deploy:
   - Specific assets: Run `jetstackai assets list --format table` to show available assets
   - A module: Run `jetstackai modules list --format table` to show available modules
   - Let me pick assets or a module

4. Once assets are selected, check the mapping requirements:
   ```
   jetstackai mapping structure --source <srcPortalId> --target <tgtPortalId> --assets <json>
   ```

5. If mappings are needed, help me resolve them:
   - For properties: `jetstackai mapping destinations --portal <tgtPortalId> --type properties --objectTypeId <id>`
   - For pipelines: `jetstackai mapping destinations --portal <tgtPortalId> --type pipelines`
   - For owners: `jetstackai mapping destinations --portal <tgtPortalId> --type owners`
   - Show source → destination options and help me pick

6. Validate the mappings:
   ```
   jetstackai mapping validate --source <srcPortalId> --target <tgtPortalId> --mappings <json>
   ```

7. Build the deploy command and show it for confirmation:
   ```
   jetstackai deploy start --source <srcPortalId> --target <tgtPortalId> --assets <json> --mappings <json>
   ```

8. After confirmation, run the deploy and monitor with `jetstackai deploy watch <taskId>`.

9. Report the final results.
