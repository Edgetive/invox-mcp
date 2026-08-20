import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = {
  authorization: string;
  companyId?: string;
};

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  const ctx = requestContext.getStore();
  if (!ctx?.authorization) {
    throw new Error("Missing Authorization context. Configure your MCP client with Authorization: Bearer invox_...");
  }
  return ctx;
}

export function getAuthorization(): string {
  return getRequestContext().authorization;
}
