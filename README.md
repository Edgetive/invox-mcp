# Invox MCP

Hosted [Model Context Protocol](https://modelcontextprotocol.io) server for [Invox](https://invox.se), plus a [Cursor plugin](https://github.com/cursor/plugin-template) package under `plugins/invox`.

AI agents (Cursor, Claude, etc.) can manage workspaces, clients, invoices, and expenses using a long-lived Invox API key.

## Cursor plugin

This repo follows the [Cursor plugin template](https://github.com/cursor/plugin-template) layout:

- [`.cursor-plugin/marketplace.json`](.cursor-plugin/marketplace.json) — marketplace metadata
- [`plugins/invox/`](plugins/invox/) — plugin with `mcp.json`, rules, skills, logo
- Validate: `node scripts/validate-template.mjs`

Plugin MCP config uses `https://mcp.invox.se/mcp` with `Authorization: Bearer ${env:INVOX_API_KEY}`.

## Endpoint

| | |
|--|--|
| MCP URL | `https://mcp.invox.se/mcp` |
| Health | `https://mcp.invox.se/health` |
| Auth | `Authorization: Bearer invox_...` |
| Plan | **Pro** (`apiAccess`) |

Create keys in the Invox app: **Settings → Integrations**.

## Cursor (one-click)

In Invox Settings → Integrations, create a key and click **Add to Cursor**. That opens a deeplink with your URL and API key prefilled.

Manual `~/.cursor/mcp.json`:

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

Or set `INVOX_API_KEY` and install the plugin from this repo (see `plugins/invox/mcp.json`).

## Tools (v1)

| Tool | Purpose |
|------|---------|
| `list_workspaces` / `get_workspace` / `update_workspace` | Workspace profile |
| `list_clients` / `get_client` / `create_client` / `update_client` / `delete_client` | Customers |
| `list_invoices` / `get_invoice` / `create_invoice` / `update_invoice` / `delete_invoice` | Invoices |
| `send_invoice` / `mark_invoice_paid` / `cancel_invoice` / `get_invoice_pdf` | Invoice actions |
| `list_expenses` / `get_expense` / `create_expense` / `update_expense` / `delete_expense` | Expenses |

## Local development

```bash
cp .env.example .env
npm install
INVOX_API_BASE_URL=http://localhost:8080 npm run dev
node scripts/validate-template.mjs
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `INVOX_API_BASE_URL` | `https://api.invox.se` | Invox REST API |

## Security

- Stateless proxy: API keys only in request headers
- Pro `apiAccess` and company RBAC enforced by `api.invox.se`
- OAuth discovery paths return 404 so Cursor uses static Bearer headers

## Deploy

Railway project **invox-mcp**. Custom domain `mcp.invox.se` (Cloudflare → Railway).

## License

Proprietary — Edgetive AB.
