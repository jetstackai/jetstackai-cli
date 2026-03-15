Help me browse assets in a connected HubSpot portal.

1. First run `jetstackai portals list --format table` to show available portals.

2. Ask me which portal I want to browse (by name or portal ID).

3. Once I pick a portal, fetch all asset types from it:
   - `jetstackai hubspot browse <portalId> workflows`
   - `jetstackai hubspot browse <portalId> forms`
   - `jetstackai hubspot browse <portalId> emails`
   - `jetstackai hubspot browse <portalId> lists`
   - `jetstackai hubspot browse <portalId> pipelines`
   - `jetstackai hubspot browse <portalId> pages`
   - `jetstackai hubspot browse <portalId> blogPosts`

4. Present a summary: total assets per type, names of key assets.

5. Ask if I want to import any of these assets into the library.
