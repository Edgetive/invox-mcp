# Invox MCP

Hosted [Model Context Protocol](https://modelcontextprotocol.io) server for [Invox](https://invox.se). AI agents (Cursor, Claude, etc.) can manage workspaces, clients, invoices, and expenses using a long-lived Invox API key.

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

Deeplink format (base64-encode the config object for the `config` query param):

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=invox&config=<BASE64>
```

Config JSON before encoding:

```json
{
  "url": "https://mcp.invox.se/mcp",
  "headers": {
    "Authorization": "Bearer invox_YOUR_KEY"
  }
}
```

## Claude Desktop / other clients

Same remote URL + Bearer header as above (client must support Streamable HTTP MCP).

## Tools (v1)

| Tool | Purpose |
|------|---------|
| `list_workspaces` / `get_workspace` / `update_workspace` | Workspace profile |
| `list_clients` / `get_client` / `create_client` / `update_client` / `delete_client` | Customers |
| `list_invoices` / `get_invoice` / `create_invoice` / `update_invoice` / `delete_invoice` | Invoices |
| `send_invoice` / `mark_invoice_paid` / `cancel_invoice` / `get_invoice_pdf` | Invoice actions |
| `list_expenses` / `get_expense` / `create_expense` / `update_expense` / `delete_expense` | Expenses |

Example prompts: “Add client Acme AB”, “Draft an invoice for Acme with 10h consulting at 900 SEK”, “Mark invoice INV-104 paid”.

## Local development

```bash
cp .env.example .env   # optional
npm install
INVOX_API_BASE_URL=http://localhost:8080 npm run dev
```

```bash
curl -s http://localhost:3000/health
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `INVOX_API_BASE_URL` | `https://api.invox.se` | Invox REST API |

## Security

- Stateless proxy: API keys are only present in request headers; not stored by this service.
- Keys are hashed at rest in the Invox API; revoke anytime in Settings.
- Company RBAC and Pro `apiAccess` are enforced by `api.invox.se`.

## Deploy

Railway (Nixpacks / Dockerfile). Set `INVOX_API_BASE_URL=https://api.invox.se` and map custom domain `mcp.invox.se` to the service.

## License

Proprietary — Edgetive AB.
