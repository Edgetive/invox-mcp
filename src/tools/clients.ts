import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { invox, resolveCompanyId, type Client } from "../client/invox.js";
import { jsonResult, toolError } from "./helpers.js";

export function registerClientTools(server: McpServer): void {
  server.registerTool(
    "list_clients",
    {
      description: "List clients (customers) for the workspace.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        page: z.number().int().min(0).optional(),
        size: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ company_id, page = 0, size = 50 }) => {
      try {
        const companyId = await resolveCompanyId(company_id);
        const clients = await invox.get<Client[]>(
          `/api/companies/${companyId}/clients?page=${page}&size=${size}`,
        );
        return jsonResult(clients);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "get_client",
    {
      description: "Get a client by ID.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        client_id: z.string().uuid(),
      },
    },
    async ({ company_id, client_id }) => {
      try {
        const companyId = await resolveCompanyId(company_id);
        const client = await invox.get<Client>(`/api/companies/${companyId}/clients/${client_id}`);
        return jsonResult(client);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "create_client",
    {
      description: "Create a new client (customer) in the workspace.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        name: z.string().min(1),
        org_number: z.union([z.string(), z.number()]).optional(),
        contact_person: z.string().optional(),
        address: z.string().optional(),
        zip_code: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
        invoice_language: z
          .enum(["sv", "en"])
          .optional()
          .describe("Overrides the workspace default for this client's invoices"),
      },
    },
    async (args) => {
      try {
        const companyId = await resolveCompanyId(args.company_id);
        const created = await invox.post<Client>(`/api/companies/${companyId}/clients`, {
          name: args.name,
          orgNumber: args.org_number,
          contactPerson: args.contact_person,
          address: args.address,
          zipCode: args.zip_code,
          city: args.city,
          country: args.country,
          email: args.email,
          phone: args.phone,
          notes: args.notes,
          invoiceLanguage: args.invoice_language,
        });
        return jsonResult(created);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "update_client",
    {
      description: "Update an existing client.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        client_id: z.string().uuid(),
        name: z.string().min(1).optional(),
        org_number: z.union([z.string(), z.number()]).optional().nullable(),
        contact_person: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        zip_code: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
        country: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        invoice_language: z
          .enum(["sv", "en", ""])
          .optional()
          .describe("Empty string clears the override and falls back to the workspace default"),
      },
    },
    async (args) => {
      try {
        const companyId = await resolveCompanyId(args.company_id);
        const current = await invox.get<Client>(`/api/companies/${companyId}/clients/${args.client_id}`);
        const body = {
          ...current,
          name: args.name ?? current.name,
          orgNumber: args.org_number !== undefined ? args.org_number : current.orgNumber,
          contactPerson: args.contact_person !== undefined ? args.contact_person : current.contactPerson,
          address: args.address !== undefined ? args.address : current.address,
          zipCode: args.zip_code !== undefined ? args.zip_code : current.zipCode,
          city: args.city !== undefined ? args.city : current.city,
          country: args.country !== undefined ? args.country : current.country,
          email: args.email !== undefined ? args.email : current.email,
          phone: args.phone !== undefined ? args.phone : current.phone,
          notes: args.notes !== undefined ? args.notes : current.notes,
          invoiceLanguage:
            args.invoice_language !== undefined ? args.invoice_language : current.invoiceLanguage,
        };
        const updated = await invox.put<Client>(
          `/api/companies/${companyId}/clients/${args.client_id}`,
          body,
        );
        return jsonResult(updated);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "delete_client",
    {
      description: "Delete a client by ID.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        client_id: z.string().uuid(),
      },
    },
    async ({ company_id, client_id }) => {
      try {
        const companyId = await resolveCompanyId(company_id);
        await invox.delete(`/api/companies/${companyId}/clients/${client_id}`);
        return jsonResult({ deleted: true, client_id });
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
