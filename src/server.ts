import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWorkspaceTools } from "./tools/workspace.js";
import { registerClientTools } from "./tools/clients.js";
import { registerInvoiceTools } from "./tools/invoices.js";
import { registerInvoiceTemplateTools } from "./tools/invoiceTemplate.js";
import { registerExpenseTools } from "./tools/expenses.js";
import { registerExpenseDocumentTools } from "./tools/expenseDocuments.js";
import { registerBankStatementTools } from "./tools/bankStatements.js";

export function createInvoxMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "invox",
      version: "1.2.0",
    },
    {
      instructions:
        "Invox MCP: manage Swedish invoicing workspaces — clients, invoices (create/send/mark paid), " +
        "invoice design presets, expenses (manual entry or receipt OCR), and bank statement upload with " +
        "AI transaction extraction. " +
        "Authenticate with Authorization: Bearer invox_... (Solo Plus/Pro API key from Invox Settings → Integrations). " +
        "The API key is company-scoped; omit company_id to use that workspace. " +
        "Bank statements require Business or Pro. File uploads take file_base64 + filename + content_type " +
        "(pdf/png/jpeg/webp, max 10MB). OCR/AI extraction runs on bank-statement upload automatically; " +
        "for receipts use upload_expense_document → extract_expense_from_document → confirm_expense_from_document. " +
        "Invoices render in Swedish or English. The language and the payment reference are resolved when " +
        "the invoice is created (invoice, then client override, then workspace default) and then frozen, " +
        "so a document that has been sent never changes afterwards; set them on create_invoice rather " +
        "than update_invoice. The How to pay section is built from the payment methods on the workspace, " +
        "so an invoice that does not explain how to pay is usually a workspace with no bankgiro, Swish or " +
        "IBAN filled in — check get_workspace before blaming the template. " +
        "Invoice design is a preset plus an accent from a closed set: call list_invoice_presets for the " +
        "valid ids, and preview_invoice_template to show the user a real PDF before saving.",
    },
  );

  registerWorkspaceTools(server);
  registerClientTools(server);
  registerInvoiceTools(server);
  registerInvoiceTemplateTools(server);
  registerExpenseTools(server);
  registerExpenseDocumentTools(server);
  registerBankStatementTools(server);

  return server;
}
