import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWorkspaceTools } from "./tools/workspace.js";
import { registerClientTools } from "./tools/clients.js";
import { registerInvoiceTools } from "./tools/invoices.js";
import { registerExpenseTools } from "./tools/expenses.js";

export function createInvoxMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "invox",
      version: "1.0.0",
    },
    {
      instructions:
        "Invox MCP: manage Swedish invoicing workspaces — clients, invoices (create/send/mark paid), and expenses. " +
        "Authenticate with Authorization: Bearer invox_... (Pro plan API key from Invox Settings → Integrations). " +
        "The API key is company-scoped; omit company_id to use that workspace.",
    },
  );

  registerWorkspaceTools(server);
  registerClientTools(server);
  registerInvoiceTools(server);
  registerExpenseTools(server);

  return server;
}
