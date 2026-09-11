import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { requestContext } from "../context.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<CallToolResult>;

type RegisteredTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler;
};

export type RecordedRequest = {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
  headers: Record<string, string>;
};

/**
 * Collects the tools a register function declares so they can be invoked directly, without
 * standing up a transport. The point is to assert on the request bodies the tools build:
 * a misspelt field name is silently dropped by the backend, which is exactly the kind of
 * break that only shows up as a setting that mysteriously will not save.
 */
export function collectTools(register: (server: McpServer) => void): Map<string, RegisteredTool> {
  const tools = new Map<string, RegisteredTool>();
  const fake = {
    registerTool(
      name: string,
      config: { description: string; inputSchema: Record<string, unknown> },
      handler: ToolHandler,
    ) {
      tools.set(name, { name, ...config, handler });
    },
  };
  register(fake as unknown as McpServer);
  return tools;
}

export type StubbedApi = {
  requests: RecordedRequest[];
  restore: () => void;
};

/**
 * Replaces fetch with a table of canned responses keyed by "METHOD /path". Paths are matched
 * exactly so a tool that calls an endpoint the backend does not expose fails loudly here.
 */
export function stubApi(routes: Record<string, unknown>): StubbedApi {
  const requests: RecordedRequest[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname + (new URL(String(url)).search || "");
    const method = init?.method ?? "GET";
    requests.push({
      method,
      path,
      body: init?.body ? JSON.parse(String(init.body)) : null,
      headers: (init?.headers as Record<string, string>) ?? {},
    });

    const key = `${method} ${path}`;
    if (!(key in routes)) {
      return new Response(JSON.stringify({ message: `No stub for ${key}` }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ data: routes[key], statusCode: 200 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  return {
    requests,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

export function callTool(
  tools: Map<string, RegisteredTool>,
  name: string,
  args: Record<string, unknown> = {},
): Promise<CallToolResult> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`Tool ${name} is not registered`);
  return requestContext.run({ authorization: "Bearer invox_test" }, () => tool.handler(args));
}

export function resultJson<T = Record<string, unknown>>(result: CallToolResult): T {
  const first = result.content[0];
  if (first?.type !== "text") throw new Error("Expected a text content block");
  return JSON.parse(first.text) as T;
}

export const AUTH_ME = {
  userId: "11111111-1111-1111-1111-111111111111",
  authUserId: "auth-1",
  email: "owner@example.se",
  fName: "Owner",
  lName: null,
  companies: [
    {
      companyId: "22222222-2222-2222-2222-222222222222",
      companyName: "Nordisk Konsult AB",
      role: "OWNER",
      isCreator: true,
    },
  ],
};

export const COMPANY_ID = AUTH_ME.companies[0].companyId;
