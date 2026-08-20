# Invox MCP

Hosted [Model Context Protocol](https://modelcontextprotocol.io) server for [Invox](https://invox.se).

Connect Cursor, Claude, and other MCP clients to create and manage clients, invoices, and expenses with your Invox API key.

## Connect

1. In Invox, open **Settings → Integrations** (Pro).
2. Create an API key.
3. Click **Add to Cursor**, or add this to your MCP client config:

```json
{
  "mcpServers": {
    "invox": {
      "url": "https://mcp.invox.se/mcp",
      "headers": {
        "Authorization": "Bearer invox_YOUR_KEY"
      }
    }
  }
}
```

| | |
|--|--|
| MCP URL | `https://mcp.invox.se/mcp` |
| Auth | `Authorization: Bearer invox_…` |

Keep your API key secret. Revoke it anytime in Invox Settings.

## What you can do

Ask your agent to, for example:

- Add or update clients
- Draft, send, or cancel invoices
- Mark invoices as paid
- Log and list expenses

## Cursor plugin

This repository also ships a [Cursor plugin](https://github.com/cursor/plugin-template) under `plugins/invox` (marketplace metadata, `mcp.json`, rules, and skills). Set `INVOX_API_KEY` in your environment, or use the in-app install link from Invox.

Validate the plugin package:

```bash
node scripts/validate-template.mjs
```

## License

Proprietary — Edgetive AB. See [invox.se](https://invox.se).
