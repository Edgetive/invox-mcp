import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  invox,
  resolveCompanyId,
  type AuthMe,
  type Invoice,
  type InvoiceItemInput,
} from "../client/invox.js";
import { jsonResult, toolError } from "./helpers.js";

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number(),
  vat_rate: z.number().min(0).max(100),
  sort_order: z.number().int().optional(),
});

function toApiItems(items: z.infer<typeof lineItemSchema>[]): InvoiceItemInput[] {
  return items.map((item, index) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    vatRate: item.vat_rate,
    sortOrder: item.sort_order ?? index,
  }));
}

export function registerInvoiceTools(server: McpServer): void {
  server.registerTool(
    "list_invoices",
    {
      description: "List invoices for the workspace.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        page: z.number().int().min(0).optional(),
        size: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ company_id, page = 0, size = 50 }) => {
      try {
        const companyId = await resolveCompanyId(company_id);
        const invoices = await invox.get<Invoice[]>(
          `/api/invoices/company/${companyId}?page=${page}&size=${size}`,
        );
        return jsonResult(invoices);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "get_invoice",
    {
      description: "Get a single invoice by ID, including line items.",
      inputSchema: {
        invoice_id: z.string().uuid(),
      },
    },
    async ({ invoice_id }) => {
      try {
        const invoice = await invox.get<Invoice>(`/api/invoices/${invoice_id}`);
        return jsonResult(invoice);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "create_invoice",
    {
      description:
        "Create an invoice. Provide client_id, due_date, invoice_number, and line items. company_id defaults to the API key workspace.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        client_id: z.string().uuid(),
        invoice_number: z.string().min(1),
        due_date: z.string().describe("ISO date YYYY-MM-DD"),
        issue_date: z.string().optional(),
        currency: z.string().optional(),
        status: z.enum(["DRAFT", "SENT"]).optional(),
        notes: z.string().optional(),
        terms: z.string().optional(),
        items: z.array(lineItemSchema).min(1),
      },
    },
    async (args) => {
      try {
        const companyId = await resolveCompanyId(args.company_id);
        const me = await invox.get<AuthMe>("/api/auth/me");
        const created = await invox.post<Invoice>("/api/invoices", {
          companyId,
          clientId: args.client_id,
          createdByUserId: me.userId,
          invoiceNumber: args.invoice_number,
          dueDate: args.due_date,
          issueDate: args.issue_date,
          currency: args.currency ?? "SEK",
          status: args.status ?? "DRAFT",
          notes: args.notes,
          terms: args.terms,
          invoiceItems: toApiItems(args.items),
        });
        return jsonResult(created);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "update_invoice",
    {
      description: "Update an existing invoice (typically DRAFT). Pass full line items to replace them.",
      inputSchema: {
        invoice_id: z.string().uuid(),
        client_id: z.string().uuid().optional(),
        invoice_number: z.string().optional(),
        due_date: z.string().optional(),
        issue_date: z.string().optional(),
        currency: z.string().optional(),
        status: z.string().optional(),
        notes: z.string().optional().nullable(),
        terms: z.string().optional().nullable(),
        items: z.array(lineItemSchema).optional(),
      },
    },
    async (args) => {
      try {
        const current = await invox.get<Invoice>(`/api/invoices/${args.invoice_id}`);
        const body = {
          ...current,
          clientId: args.client_id ?? current.clientId,
          invoiceNumber: args.invoice_number ?? current.invoiceNumber,
          dueDate: args.due_date ?? current.dueDate,
          issueDate: args.issue_date ?? current.issueDate,
          currency: args.currency ?? current.currency,
          status: args.status ?? current.status,
          notes: args.notes !== undefined ? args.notes : current.notes,
          terms: args.terms !== undefined ? args.terms : current.terms,
          invoiceItems: args.items
            ? toApiItems(args.items)
            : current.invoiceItems,
        };
        const updated = await invox.put<Invoice>(`/api/invoices/${args.invoice_id}`, body);
        return jsonResult(updated);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "delete_invoice",
    {
      description: "Delete an invoice by ID.",
      inputSchema: {
        invoice_id: z.string().uuid(),
      },
    },
    async ({ invoice_id }) => {
      try {
        await invox.delete(`/api/invoices/${invoice_id}`);
        return jsonResult({ deleted: true, invoice_id });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "send_invoice",
    {
      description: "Email the invoice PDF to the client and mark it as SENT.",
      inputSchema: {
        invoice_id: z.string().uuid(),
      },
    },
    async ({ invoice_id }) => {
      try {
        const invoice = await invox.post<Invoice>(`/api/invoices/${invoice_id}/send`);
        return jsonResult(invoice);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "mark_invoice_paid",
    {
      description: "Mark an invoice as PAID. Optionally set paid_date (YYYY-MM-DD).",
      inputSchema: {
        invoice_id: z.string().uuid(),
        paid_date: z.string().optional(),
      },
    },
    async ({ invoice_id, paid_date }) => {
      try {
        const invoice = await invox.post<Invoice>(`/api/invoices/${invoice_id}/mark-paid`, {
          paidDate: paid_date ?? null,
        });
        return jsonResult(invoice);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "cancel_invoice",
    {
      description: "Cancel an invoice.",
      inputSchema: {
        invoice_id: z.string().uuid(),
      },
    },
    async ({ invoice_id }) => {
      try {
        const invoice = await invox.post<Invoice>(`/api/invoices/${invoice_id}/cancel`);
        return jsonResult(invoice);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "get_invoice_pdf",
    {
      description:
        "Download the invoice PDF as base64 (capped). Prefer sharing a short summary unless the user needs the file.",
      inputSchema: {
        invoice_id: z.string().uuid(),
        merge_attachments: z.boolean().optional(),
      },
    },
    async ({ invoice_id, merge_attachments }) => {
      try {
        const qs = merge_attachments ? "?merge=true" : "";
        const res = await invox.getRaw(`/api/invoices/${invoice_id}/pdf${qs}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const maxBytes = 2_000_000;
        if (buf.length > maxBytes) {
          return jsonResult({
            invoice_id,
            too_large: true,
            size_bytes: buf.length,
            message: `PDF is ${buf.length} bytes (>${maxBytes}). Open it in the Invox app instead.`,
          });
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                invoice_id,
                content_type: res.headers.get("content-type") ?? "application/pdf",
                size_bytes: buf.length,
                filename: `invoice-${invoice_id}.pdf`,
              }),
            },
            {
              type: "resource",
              resource: {
                uri: `invox://invoices/${invoice_id}/pdf`,
                mimeType: "application/pdf",
                blob: buf.toString("base64"),
              },
            },
          ],
        };
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
