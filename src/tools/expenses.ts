import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { invox, resolveCompanyId, type AuthMe, type Expense } from "../client/invox.js";
import { jsonResult, toolError } from "./helpers.js";

export function registerExpenseTools(server: McpServer): void {
  server.registerTool(
    "list_expenses",
    {
      description: "List expenses for the workspace.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        category: z.string().optional(),
        start_date: z.string().optional().describe("YYYY-MM-DD"),
        end_date: z.string().optional().describe("YYYY-MM-DD"),
      },
    },
    async ({ company_id, category, start_date, end_date }) => {
      try {
        const companyId = await resolveCompanyId(company_id);
        let path = `/api/expenses/company/${companyId}`;
        if (category) {
          path = `/api/expenses/company/${companyId}/category/${encodeURIComponent(category)}`;
        } else if (start_date && end_date) {
          path = `/api/expenses/company/${companyId}/date-range?startDate=${encodeURIComponent(start_date)}&endDate=${encodeURIComponent(end_date)}`;
        }
        const expenses = await invox.get<Expense[]>(path);
        return jsonResult(expenses);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "get_expense",
    {
      description: "Get an expense by ID.",
      inputSchema: {
        expense_id: z.string().uuid(),
      },
    },
    async ({ expense_id }) => {
      try {
        const expense = await invox.get<Expense>(`/api/expenses/${expense_id}`);
        return jsonResult(expense);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "create_expense",
    {
      description: "Create an expense record.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        amount: z.number(),
        currency: z.string().optional(),
        expense_date: z.string().describe("YYYY-MM-DD"),
        category: z.string().optional(),
        description: z.string().optional(),
        vendor: z.string().optional(),
        vat_amount: z.number().optional(),
        vat_rate: z.number().optional(),
        notes: z.string().optional(),
        receipt_url: z
          .string()
          .optional()
          .describe("Optional receipt download path from upload_expense_document"),
      },
    },
    async (args) => {
      try {
        const companyId = await resolveCompanyId(args.company_id);
        const me = await invox.get<AuthMe>("/api/auth/me");
        const created = await invox.post<Expense>("/api/expenses", {
          companyId,
          createdByUserId: me.userId,
          amount: args.amount,
          currency: args.currency ?? "SEK",
          expenseDate: args.expense_date,
          category: args.category,
          description: args.description,
          vendor: args.vendor,
          vatAmount: args.vat_amount,
          vatRate: args.vat_rate,
          notes: args.notes,
          receiptUrl: args.receipt_url,
        });
        return jsonResult(created);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "update_expense",
    {
      description: "Update an existing expense.",
      inputSchema: {
        expense_id: z.string().uuid(),
        amount: z.number().optional(),
        currency: z.string().optional(),
        expense_date: z.string().optional(),
        category: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        vendor: z.string().optional().nullable(),
        vat_amount: z.number().optional().nullable(),
        vat_rate: z.number().optional().nullable(),
        notes: z.string().optional().nullable(),
        receipt_url: z.string().optional().nullable(),
      },
    },
    async (args) => {
      try {
        const current = await invox.get<Expense>(`/api/expenses/${args.expense_id}`);
        const body = {
          ...current,
          amount: args.amount ?? current.amount,
          currency: args.currency ?? current.currency,
          expenseDate: args.expense_date ?? current.expenseDate,
          category: args.category !== undefined ? args.category : current.category,
          description: args.description !== undefined ? args.description : current.description,
          vendor: args.vendor !== undefined ? args.vendor : current.vendor,
          vatAmount: args.vat_amount !== undefined ? args.vat_amount : current.vatAmount,
          vatRate: args.vat_rate !== undefined ? args.vat_rate : current.vatRate,
          notes: args.notes !== undefined ? args.notes : current.notes,
          receiptUrl: args.receipt_url !== undefined ? args.receipt_url : current.receiptUrl,
        };
        const updated = await invox.put<Expense>(`/api/expenses/${args.expense_id}`, body);
        return jsonResult(updated);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "delete_expense",
    {
      description: "Delete an expense by ID.",
      inputSchema: {
        expense_id: z.string().uuid(),
      },
    },
    async ({ expense_id }) => {
      try {
        await invox.delete(`/api/expenses/${expense_id}`);
        return jsonResult({ deleted: true, expense_id });
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
