Help me import HubSpot assets into the JetStack AI library.

1. Run `jetstackai portals list --format table` to show available portals.

2. Ask me which portal to import from.

3. Once I pick a portal, ask what types of assets I want to import (workflows, forms, emails, lists, pipelines, pages, templates, blogPosts, hubdbTables).

4. Browse the selected asset types using `jetstackai hubspot browse <portalId> <type>` for each type I selected.

5. Show me the available assets and let me pick which ones to import. I can say "all workflows" or specific ones by name/ID.

6. Build the import command with the selected assets and show it to me for confirmation:
   ```
   jetstackai import start --portal <portalId> --assets '{"workflows":["id1","id2"],"forms":["id3"]}'
   ```

7. After I confirm, run the import command.

8. Monitor progress with `jetstackai import watch <taskId>` until complete.

9. After import completes, run `jetstackai assets list --format table` to show the newly imported assets.

10. Ask if I want to create a module from the imported assets.
