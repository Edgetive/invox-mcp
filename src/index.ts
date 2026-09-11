import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createInvoxMcpServer } from "./server.js";
import { requestContext } from "./context.js";

const PORT = Number(process.env.PORT || 3000);
const MCP_PATH = "/mcp";

const app = express();
app.use(express.json({ limit: "16mb" }));

type Session = {
  transport: StreamableHTTPServerTransport;
  authorization: string;
};

const sessions = new Map<string, Session>();

function extractAuthorization(req: Request): string | null {
  const header = req.header("authorization") || req.header("Authorization");
  if (!header?.trim()) return null;
  return header.trim();
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "invox-mcp",
    version: "1.2.0",
    mcp: MCP_PATH,
  });
});

// Cursor prefers OAuth when discovery endpoints exist; we use API-key headers only.
// Return 404 so clients fall back to configured Authorization headers.
for (const path of [
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-protected-resource",
  "/.well-known/openid-configuration",
  "/.well-known/oauth-authorization-server/mcp",
  "/.well-known/oauth-protected-resource/mcp",
]) {
  app.get(path, (_req, res) => {
    res.status(404).json({ error: "not_found" });
  });
}

app.post(MCP_PATH, async (req: Request, res: Response) => {
  const authorization = extractAuthorization(req);
  if (!authorization?.toLowerCase().startsWith("bearer invox_")) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Unauthorized: set Authorization: Bearer invox_<your-api-key>",
      },
      id: null,
    });
    return;
  }

  const sessionId = req.header("mcp-session-id") ?? undefined;

  try {
    await requestContext.run({ authorization }, async () => {
      let session = sessionId ? sessions.get(sessionId) : undefined;

      if (session && session.authorization !== authorization) {
        res.status(401).json({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Session API key mismatch" },
          id: null,
        });
        return;
      }

      if (!session) {
        if (sessionId || !isInitializeRequest(req.body)) {
          res.status(400).json({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Bad Request: missing or unknown MCP session. Send initialize first.",
            },
            id: null,
          });
          return;
        }

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            sessions.set(id, { transport, authorization });
          },
        });

        transport.onclose = () => {
          const id = transport.sessionId;
          if (id) sessions.delete(id);
        };

        const server = createInvoxMcpServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      await session.transport.handleRequest(req, res, req.body);
    });
  } catch (err) {
    console.error("MCP POST error", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get(MCP_PATH, async (req: Request, res: Response) => {
  const authorization = extractAuthorization(req);
  const sessionId = req.header("mcp-session-id");
  if (!authorization || !sessionId) {
    res.status(400).send("Missing Authorization or mcp-session-id");
    return;
  }
  const session = sessions.get(sessionId);
  if (!session || session.authorization !== authorization) {
    res.status(404).send("Unknown session");
    return;
  }
  await requestContext.run({ authorization }, async () => {
    await session.transport.handleRequest(req, res);
  });
});

app.delete(MCP_PATH, async (req: Request, res: Response) => {
  const authorization = extractAuthorization(req);
  const sessionId = req.header("mcp-session-id");
  if (!authorization || !sessionId) {
    res.status(400).send("Missing Authorization or mcp-session-id");
    return;
  }
  const session = sessions.get(sessionId);
  if (!session || session.authorization !== authorization) {
    res.status(404).send("Unknown session");
    return;
  }
  await requestContext.run({ authorization }, async () => {
    await session.transport.handleRequest(req, res);
  });
  sessions.delete(sessionId);
});

app.listen(PORT, () => {
  console.log(`invox-mcp listening on :${PORT} (POST ${MCP_PATH})`);
});
