import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWorkspaceTools } from "./tools/workspace.js";
import { registerClientTools } from "./tools/clients.js";
import { registerInvoiceTools } from "./tools/invoices.js";
import { registerExpenseTools } from "./tools/expenses.js";
import { registerExpenseDocumentTools } from "./tools/expenseDocuments.js";
import { registerBankStatementTools } from "./tools/bankStatements.js";

export function createInvoxMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "invox",
      version: "1.1.0",
    },
    {
      instructions:
        "Invox MCP: manage Swedish invoicing workspaces — clients, invoices (create/send/mark paid), " +
        "expenses (manual entry or receipt OCR), and bank statement upload with AI transaction extraction. " +
        "Authenticate with Authorization: Bearer invox_... (Solo Plus/Pro API key from Invox Settings → Integrations). " +
        "The API key is company-scoped; omit company_id to use that workspace. " +
        "Bank statements require Business or Pro. File uploads take file_base64 + filename + content_type " +
        "(pdf/png/jpeg/webp, max 10MB). OCR/AI extraction runs on bank-statement upload automatically; " +
        "for receipts use upload_expense_document → extract_expense_from_document → confirm_expense_from_document.",
    },
  );

  registerWorkspaceTools(server);
  registerClientTools(server);
  registerInvoiceTools(server);
  registerExpenseTools(server);
  registerExpenseDocumentTools(server);
  registerBankStatementTools(server);

  return server;
}
