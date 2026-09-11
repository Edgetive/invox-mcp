---
name: invox-invoicing
description: Create and manage Invox clients, invoices, invoice design, expenses, receipts, and bank statements through the hosted MCP.
---

# Invox invoicing

## Setup

Users create a Solo Plus or Pro API key in Invox → **Settings → Integrations**, then set `INVOX_API_KEY` (or use the Add to Cursor deeplink which embeds the Bearer token).

MCP endpoint: `https://mcp.invox.se/mcp`

## Common flows

### New client + draft invoice

1. `create_client` with name, email, org number if known, and `invoice_language` if they should be billed in English
2. `create_invoice` with `client_id`, `invoice_number`, and line `items` (`description`, `quantity`, `unit_price`, `vat_rate`). `due_date` is optional and defaults to the workspace payment terms
3. Optionally `send_invoice` when ready

### Mark paid

Use `mark_invoice_paid` with optional `paid_date`.

### Payment details and the How to pay section

The invoice's **How to pay** section is generated from the payment methods stored on the
workspace, so an invoice that does not tell the recipient how to pay is almost always a
workspace with nothing filled in. Check `get_workspace` before looking at the template.

Set them with `update_workspace`: `bankgiro`, `plusgiro`, `bank_account`, `swish_number`,
`iban` and `bic` for international transfers, `bank_name`.

`payment_reference_mode` turns on Swedish OCR references, which let the bank match an incoming
payment to an invoice automatically:

- `NONE` — the invoice number is used as the reference
- `OCR_SOFT` — digits plus a Luhn check digit
- `OCR_HARD` — digits plus a length digit plus a check digit

Which one is correct depends on the workspace's Bankgirot agreement, so ask rather than guess.
A reference in the wrong format is rejected by the bank and the payment lands unmatched.

### Language

Invoices render in Swedish or English. Language resolves in this order: the invoice, then the
client's `invoice_language` override, then the workspace `default_invoice_language`, then Swedish.

It is decided when the invoice is created and then frozen, so `update_invoice` will not change
the language of an invoice that has already been sent — the recipient is holding a document that
says otherwise. Set it on `create_invoice`, or on the client so future invoices inherit it.

### Invoice design

1. `list_invoice_presets` for the valid preset and accent ids — both are closed sets
2. `preview_invoice_template` to render a real sample PDF, optionally for a specific `preset_id`
   and `language`, without changing anything
3. `set_invoice_template` to save the preset, accent, logo position and size, and content toggles

Requires an owner or admin and a plan that includes custom branding. There are no free-form
colour or font controls: the presets are designed, and picking one is the whole job.

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
