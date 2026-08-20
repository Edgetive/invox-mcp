import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { invox, resolveCompanyId, type AuthMe, type Company } from "../client/invox.js";
import { jsonResult, toolError } from "./helpers.js";

export function registerWorkspaceTools(server: McpServer): void {
  server.registerTool(
    "list_workspaces",
    {
      description:
        "List Invox workspaces available to the current API key (usually one company-scoped workspace).",
      inputSchema: {},
    },
    async () => {
      try {
        const me = await invox.get<AuthMe>("/api/auth/me");
        return jsonResult({
          userId: me.userId,
          email: me.email,
          workspaces: me.companies,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "get_workspace",
    {
      description: "Get company/workspace profile details (name, address, bank details, VAT).",
      inputSchema: {
        company_id: z.string().uuid().optional().describe("Defaults to the API key workspace"),
      },
    },
    async ({ company_id }) => {
      try {
        const companyId = await resolveCompanyId(company_id);
        const company = await invox.get<Company>(`/api/companies/${companyId}`);
        return jsonResult(company);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "update_workspace",
    {
      description: "Update company/workspace profile fields (partial update).",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        name: z.string().optional(),
        address: z.string().optional(),
        zip_code: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        bank_account: z.string().optional(),
        bankgiro: z.string().optional(),
        plusgiro: z.string().optional(),
        vat_number: z.string().optional(),
        registered_for_vat: z.boolean().optional(),
      },
    },
    async (args) => {
      try {
        const companyId = await resolveCompanyId(args.company_id);
        const current = await invox.get<Company>(`/api/companies/${companyId}`);
        const body = {
          ...current,
          name: args.name ?? current.name,
          address: args.address ?? current.address,
          zipCode: args.zip_code ?? current.zipCode,
          city: args.city ?? current.city,
          country: args.country ?? current.country,
          phone: args.phone ?? current.phone,
          email: args.email ?? current.email,
          bankAccount: args.bank_account ?? current.bankAccount,
          bankgiro: args.bankgiro ?? current.bankgiro,
          plusgiro: args.plusgiro ?? current.plusgiro,
          vatNumber: args.vat_number ?? current.vatNumber,
          registeredForVat: args.registered_for_vat ?? current.registeredForVat,
        };
        const updated = await invox.put<Company>(`/api/companies/${companyId}`, body);
        return jsonResult(updated);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
