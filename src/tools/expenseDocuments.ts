import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  currentYearMonth,
  filePartFromBase64,
  invox,
  resolveCompanyId,
  type Expense,
  type ExpenseExtractionDraft,
  type IncomingInvoiceDocument,
} from "../client/invox.js";
import { jsonResult, toolError } from "./helpers.js";

const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function assertUploadable(fileBase64: string, contentType: string): void {
  if (!ALLOWED_CONTENT_TYPES.includes(contentType as (typeof ALLOWED_CONTENT_TYPES)[number])) {
    throw new Error(
      `Unsupported content_type "${contentType}". Allowed: ${ALLOWED_CONTENT_TYPES.join(", ")}.`,
    );
  }
  const buf = Buffer.from(fileBase64, "base64");
  if (!buf.length) {
    throw new Error("file_base64 is empty or not valid base64.");
  }
  if (buf.length > MAX_UPLOAD_BYTES) {
    throw new Error(`File is ${buf.length} bytes; max upload size is ${MAX_UPLOAD_BYTES} bytes (10MB).`);
  }
}

function receiptUrlFor(companyId: string, documentId: string): string {
  return `/api/companies/${companyId}/incoming-invoice-documents/${documentId}/download`;
}

export function registerExpenseDocumentTools(server: McpServer): void {
  server.registerTool(
    "upload_expense_document",
    {
      description:
        "Upload a receipt or incoming invoice (PDF/image) for expense processing. " +
        "After upload, call extract_expense_from_document then confirm_expense_from_document.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional()
          .describe("Folder month as YYYY-MM (defaults to current month)"),
        filename: z.string().min(1).describe("Original filename, e.g. receipt.pdf"),
        content_type: z
          .enum(["application/pdf", "image/png", "image/jpeg", "image/webp"])
          .describe("MIME type of the file"),
        file_base64: z.string().min(1).describe("Base64-encoded file contents (no data: URI prefix)"),
      },
    },
    async ({ company_id, month, filename, content_type, file_base64 }) => {
      try {
        assertUploadable(file_base64, content_type);
        const companyId = await resolveCompanyId(company_id);
        const form = new FormData();
        form.append("month", month ?? currentYearMonth());
        form.append("file", filePartFromBase64(file_base64, filename, content_type));
        const created = await invox.postForm<IncomingInvoiceDocument>(
          `/api/companies/${companyId}/incoming-invoice-documents`,
          form,
        );
        return jsonResult({
          ...created,
          receipt_url: receiptUrlFor(companyId, created.id),
          next_step: "Call extract_expense_from_document with this document id.",
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "list_expense_documents",
    {
      description: "List uploaded receipt / incoming-invoice documents.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional()
          .describe("YYYY-MM"),
        page: z.number().int().min(0).optional(),
        size: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ company_id, month, page, size }) => {
      try {
        const companyId = await resolveCompanyId(company_id);
        const qs = new URLSearchParams();
        if (month) qs.set("month", month);
        if (page !== undefined) qs.set("page", String(page));
        if (size !== undefined) qs.set("size", String(size));
        const q = qs.toString();
        const docs = await invox.get<IncomingInvoiceDocument[]>(
          `/api/companies/${companyId}/incoming-invoice-documents${q ? `?${q}` : ""}`,
        );
        return jsonResult(docs);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "extract_expense_from_document",
    {
      description:
        "Run OCR + AI extraction on an uploaded receipt/incoming invoice and return a review draft. " +
        "Counts against the monthly AI extraction quota.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        document_id: z.string().uuid(),
      },
    },
    async ({ company_id, document_id }) => {
      try {
        const companyId = await resolveCompanyId(company_id);
        const draft = await invox.post<ExpenseExtractionDraft>(
          `/api/companies/${companyId}/incoming-invoice-documents/${document_id}/extract`,
        );
        return jsonResult({
          ...draft,
          next_step:
            "Review suggestedExpense with the user, then call confirm_expense_from_document with final values.",
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "get_expense_extraction",
    {
      description: "Get the latest OCR/AI extraction draft for an uploaded expense document.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        document_id: z.string().uuid(),
      },
    },
    async ({ company_id, document_id }) => {
      try {
        const companyId = await resolveCompanyId(company_id);
        const draft = await invox.get<ExpenseExtractionDraft>(
          `/api/companies/${companyId}/incoming-invoice-documents/${document_id}/extraction`,
        );
        return jsonResult(draft);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "confirm_expense_from_document",
    {
      description:
        "Confirm a reviewed extraction draft and create the expense. Pass final field values after user review.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        document_id: z.string().uuid(),
        amount: z.number(),
        currency: z.string().optional(),
        expense_date: z.string().describe("YYYY-MM-DD"),
        category: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        vendor: z.string().optional().nullable(),
        vat_amount: z.number().optional().nullable(),
        vat_rate: z.number().optional().nullable(),
        notes: z.string().optional().nullable(),
        link_receipt: z
          .boolean()
          .optional()
          .describe("If true (default), set expense.receiptUrl to the uploaded document download path"),
      },
    },
    async (args) => {
      try {
        const companyId = await resolveCompanyId(args.company_id);
        const expense = await invox.post<Expense>(
          `/api/companies/${companyId}/incoming-invoice-documents/${args.document_id}/confirm-expense`,
          {
            amount: args.amount,
            currency: args.currency ?? "SEK",
            expenseDate: args.expense_date,
            category: args.category,
            description: args.description,
            vendor: args.vendor,
            vatAmount: args.vat_amount,
            vatRate: args.vat_rate,
            notes: args.notes,
          },
        );

        const shouldLink = args.link_receipt !== false;
        if (shouldLink && expense?.id) {
          const receiptUrl = receiptUrlFor(companyId, args.document_id);
          const linked = await invox.put<Expense>(`/api/expenses/${expense.id}`, {
            ...expense,
            receiptUrl,
          });
          return jsonResult(linked);
        }
        return jsonResult(expense);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "delete_expense_document",
    {
      description: "Delete an uploaded receipt / incoming-invoice document.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        document_id: z.string().uuid(),
      },
    },
    async ({ company_id, document_id }) => {
      try {
        const companyId = await resolveCompanyId(company_id);
        await invox.delete(`/api/companies/${companyId}/incoming-invoice-documents/${document_id}`);
        return jsonResult({ deleted: true, document_id });
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
