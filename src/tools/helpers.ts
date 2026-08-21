import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { InvoxApiError } from "../client/invox.js";

export function jsonResult(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function toolError(err: unknown): CallToolResult {
  if (err instanceof InvoxApiError) {
    const hint =
      err.status === 401
        ? " Check that your Invox API key is valid and not revoked."
        : err.status === 403
          ? " API/MCP access requires Solo Plus or Pro. Bank statement import requires Business or Pro, or you lack permission for this action."
          : err.status === 402
            ? " A plan limit was exceeded (clients, invoices, storage, or monthly AI extractions)."
            : "";
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: err.message,
              status: err.status,
              details: err.body,
              hint: hint.trim() || undefined,
            },
            null,
            2,
          ),
        },
      ],
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }],
  };
}
