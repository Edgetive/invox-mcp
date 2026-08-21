---
name: invox-invoicing
description: Create and manage Invox clients, invoices, expenses, receipts, and bank statements through the hosted MCP.
---

# Invox invoicing

## Setup

Users create a Solo Plus or Pro API key in Invox → **Settings → Integrations**, then set `INVOX_API_KEY` (or use the Add to Cursor deeplink which embeds the Bearer token).

MCP endpoint: `https://mcp.invox.se/mcp`

## Common flows

### New client + draft invoice

1. `create_client` with name, email, org number if known
2. `create_invoice` with `client_id`, `invoice_number`, `due_date`, and line `items` (`description`, `quantity`, `unit_price`, `vat_rate`)
3. Optionally `send_invoice` when ready

### Mark paid

Use `mark_invoice_paid` with optional `paid_date`.

### Log expense (manual)

Use `create_expense` with `amount`, `expense_date`, optional `vendor` / `category` / `receipt_url`.

### Receipt → expense (OCR)

1. `upload_expense_document` with `file_base64`, `filename`, `content_type`
2. `extract_expense_from_document` with the returned `document_id`
3. Review `suggestedExpense` with the user
4. `confirm_expense_from_document` with final field values (links the receipt by default)

### Bank statement upload

Requires Business or Pro.

1. `upload_bank_statement` with `file_base64`, `filename`, `content_type`, optional `month` (`YYYY-MM`)
2. OCR + AI extraction runs automatically on upload
3. `get_bank_statement_transactions` to review parsed rows
4. Optionally `list_bank_statements` / `list_bank_statement_folders` / `delete_bank_statement`
