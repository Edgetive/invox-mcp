# Invox Cursor plugin

Marketplace plugin that wires Cursor to the hosted Invox MCP at `https://mcp.invox.se/mcp`.

## Auth

Set environment variable `INVOX_API_KEY` to a key from Invox → Settings → Integrations (Pro), or install via the in-app **Add to Cursor** deeplink.

## Components

- `mcp.json` — remote Streamable HTTP MCP
- `rules/invox-workflow.mdc` — agent guidance
- `skills/invox-invoicing/` — invoicing workflows
