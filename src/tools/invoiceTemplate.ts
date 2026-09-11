import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  invox,
  resolveCompanyId,
  type InvoicePresetCatalog,
  type InvoiceTemplateConfig,
} from "../client/invox.js";
import { jsonResult, toolError } from "./helpers.js";

const MAX_PREVIEW_BYTES = 2_000_000;

export function registerInvoiceTemplateTools(server: McpServer): void {
  server.registerTool(
    "list_invoice_presets",
    {
      description:
        "List the invoice design presets and the accent palette. Call this before set_invoice_template " +
        "so you use real preset and accent ids: both are closed sets and anything else is rejected. " +
        "Each preset entry carries the paths for rendering it as a thumbnail or a sample PDF.",
      inputSchema: {},
    },
    async () => {
      try {
        const catalog = await invox.get<InvoicePresetCatalog>("/api/invoice-template/presets");
        return jsonResult(catalog);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "get_invoice_template",
    {
      description:
        "Get the workspace's saved invoice design: preset, accent, logo placement and content toggles.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
      },
    },
    async ({ company_id }) => {
      try {
        const companyId = await resolveCompanyId(company_id);
        const config = await invox.get<InvoiceTemplateConfig>(
          `/api/companies/${companyId}/invoice-template`,
        );
        return jsonResult(config);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "set_invoice_template",
    {
      description:
        "Change the workspace's invoice design. Fields left unset keep their current value. " +
        "Requires an owner or admin, and a plan that includes custom branding. " +
        "Use preview_invoice_template first if the user wants to see the result before committing.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        preset_id: z.string().optional().describe("An id from list_invoice_presets"),
        accent_id: z.string().optional().describe("An accent id from list_invoice_presets"),
        logo_position: z.enum(["left", "right", "hidden"]).optional(),
        logo_size: z.enum(["small", "medium", "large"]).optional(),
        show_vat_column: z.boolean().optional(),
        show_qr_code: z.boolean().optional().describe("Adds a Swish or SEPA payment QR code"),
      },
    },
    async (args) => {
      try {
        const companyId = await resolveCompanyId(args.company_id);
        const current = await invox.get<InvoiceTemplateConfig>(
          `/api/companies/${companyId}/invoice-template`,
        );
        const body: InvoiceTemplateConfig = {
          version: current.version,
          presetId: args.preset_id ?? current.presetId,
          accentId: args.accent_id ?? current.accentId,
          logo: {
            position: args.logo_position ?? current.logo.position,
            size: args.logo_size ?? current.logo.size,
          },
          showVatColumn: args.show_vat_column ?? current.showVatColumn,
          showQrCode: args.show_qr_code ?? current.showQrCode,
        };
        const saved = await invox.put<InvoiceTemplateConfig>(
          `/api/companies/${companyId}/invoice-template`,
          body,
        );
        return jsonResult(saved);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "preview_invoice_template",
    {
      description:
        "Render a sample invoice PDF so the user can see a design before saving it. With no preset_id " +
        "this previews the saved design; with one it previews that preset without changing anything.",
      inputSchema: {
        company_id: z.string().uuid().optional(),
        preset_id: z.string().optional().describe("Preview this preset instead of the saved design"),
        language: z.enum(["sv", "en"]).optional(),
      },
    },
    async ({ company_id, preset_id, language }) => {
      try {
        const companyId = await resolveCompanyId(company_id);
        const qs = language ? `?language=${language}` : "";
        const path = preset_id
          ? `/api/companies/${companyId}/invoice-template/presets/${preset_id}/preview${qs}`
          : `/api/companies/${companyId}/invoice-template/preview${qs}`;
        const res = await invox.getRaw(path);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > MAX_PREVIEW_BYTES) {
          return jsonResult({
            too_large: true,
            size_bytes: buf.length,
            message: `Preview is ${buf.length} bytes (>${MAX_PREVIEW_BYTES}). View it in the Invox app instead.`,
          });
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                preset_id: preset_id ?? "saved",
                language: language ?? "workspace default",
                size_bytes: buf.length,
              }),
            },
            {
              type: "resource",
              resource: {
                uri: `invox://companies/${companyId}/invoice-template/preview`,
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
