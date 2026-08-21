import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  currentYearMonth,
  filePartFromBase64,
  invox,
  resolveCompanyId,
  type BankStatementDocument,
  type BankStatementTransaction,
} from "../client/invox.js";
import { jsonResult, toolError } from "./helpers.js";

const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function assertUploadable(fileBase64: string, contentType: string): Buffer {
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
  return buf;
}

export function registerBankStatementTools(server: McpServer): void {
  server.registerTool(
    "upload_bank_statement",
    {
      description:
        "Upload a bank statement PDF/image. OCR + AI extraction runs automatically and " +
        "persists transaction rows. Requires Business or Pro. Counts against the monthly AI extraction quota.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional()
          .describe("Folder month as YYYY-MM (defaults to current month)"),
        filename: z.string().min(1).describe("Original filename, e.g. statement-2026-05.pdf"),
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
        const created = await invox.postForm<BankStatementDocument>(
          `/api/companies/${companyId}/bank-statements`,
          form,
        );
        return jsonResult({
          ...created,
          next_step:
            "Call get_bank_statement_transactions with this statement id to review extracted rows.",
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "list_bank_statements",
    {
      description: "List uploaded bank statements, optionally filtered by month folder.",
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
        const statements = await invox.get<BankStatementDocument[]>(
          `/api/companies/${companyId}/bank-statements${q ? `?${q}` : ""}`,
        );
        return jsonResult(statements);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "list_bank_statement_folders",
    {
      description: "List bank-statement month folders with document counts.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
      },
    },
    async ({ company_id }) => {
      try {
        const companyId = await resolveCompanyId(company_id);
        const folders = await invox.get<Array<{ month: string; documentCount: number }>>(
          `/api/companies/${companyId}/bank-statements/folders`,
        );
        return jsonResult(folders);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "get_bank_statement_transactions",
    {
      description:
        "List AI-parsed transactions for one bank statement. Call after upload_bank_statement.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        statement_id: z.string().uuid(),
        page: z.number().int().min(0).optional(),
        size: z.number().int().min(1).max(200).optional(),
      },
    },
    async ({ company_id, statement_id, page, size }) => {
      try {
        const companyId = await resolveCompanyId(company_id);
        const qs = new URLSearchParams();
        if (page !== undefined) qs.set("page", String(page));
        if (size !== undefined) qs.set("size", String(size));
        const q = qs.toString();
        const transactions = await invox.get<BankStatementTransaction[]>(
          `/api/companies/${companyId}/bank-statements/${statement_id}/transactions${q ? `?${q}` : ""}`,
        );
        return jsonResult({ statement_id, count: transactions.length, transactions });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "delete_bank_statement",
    {
      description: "Delete a bank statement and its extracted transactions.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        statement_id: z.string().uuid(),
      },
    },
    async ({ company_id, statement_id }) => {
      try {
        const companyId = await resolveCompanyId(company_id);
        await invox.delete(`/api/companies/${companyId}/bank-statements/${statement_id}`);
        return jsonResult({ deleted: true, statement_id });
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
