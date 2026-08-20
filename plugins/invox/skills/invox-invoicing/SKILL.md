---
name: invox-invoicing
description: Create and manage Invox clients, invoices, and expenses through the hosted MCP.
---

# Invox invoicing

## Setup

Users create a Pro API key in Invox → **Settings → Integrations**, then set `INVOX_API_KEY` (or use the Add to Cursor deeplink which embeds the Bearer token).

MCP endpoint: `https://mcp.invox.se/mcp`

## Common flows

### New client + draft invoice

1. `create_client` with name, email, org number if known
2. `create_invoice` with `client_id`, `invoice_number`, `due_date`, and line `items` (`description`, `quantity`, `unit_price`, `vat_rate`)
3. Optionally `send_invoice` when ready

### Mark paid

Use `mark_invoice_paid` with optional `paid_date`.

### Log expense

Use `create_expense` with `amount`, `expense_date`, optional `vendor` / `category`.
