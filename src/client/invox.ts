import { getAuthorization } from "../context.js";

const DEFAULT_BASE = "https://api.invox.se";

export class InvoxApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "InvoxApiError";
  }
}

type ApiEnvelope<T> = {
  data: T;
  statusCode: number;
  operationId?: string;
  pagination?: unknown;
  timestamp?: string;
};

function baseUrl(): string {
  return (process.env.INVOX_API_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; raw?: boolean } = {},
): Promise<T> {
  const authorization = getAuthorization();
  const headers: Record<string, string> = {
    Authorization: authorization,
    Accept: "application/json",
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (options.raw) {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new InvoxApiError(`Invox API ${res.status}: ${text || res.statusText}`, res.status, text);
    }
    return res as unknown as T;
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const message =
      typeof parsed === "object" && parsed && "message" in parsed
        ? String((parsed as { message: unknown }).message)
        : `Invox API error ${res.status}`;
    throw new InvoxApiError(message, res.status, parsed);
  }

  if (parsed && typeof parsed === "object" && "data" in parsed) {
    return (parsed as ApiEnvelope<T>).data;
  }
  return parsed as T;
}

export const invox = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body: body ?? {} }),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, { body }),
  delete: <T>(path: string) => request<T>("DELETE", path),
  getRaw: (path: string) => request<Response>("GET", path, { raw: true }),
};

export type AuthMe = {
  userId: string;
  authUserId: string;
  email: string;
  fName: string | null;
  lName: string | null;
  companies: Array<{
    companyId: string;
    companyName: string;
    role: string;
    isCreator: boolean | null;
  }>;
};

export type Company = {
  id: string;
  name: string;
  orgNumber: number | null;
  address: string | null;
  zipCode: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  bankAccount: string | null;
  bankgiro: string | null;
  plusgiro: string | null;
  vatNumber: string | null;
  registeredForVat: boolean | null;
};

export type Client = {
  id: string;
  companyId: string;
  name: string;
  orgNumber: number | null;
  contactPerson: string | null;
  address: string | null;
  zipCode: string | null;
  city: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export type InvoiceItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  sortOrder?: number;
};

export type Invoice = {
  id: string;
  companyId: string;
  clientId: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  paidAmount: number;
  paidDate: string | null;
  notes: string | null;
  terms: string | null;
  invoiceItems: Array<Record<string, unknown>>;
};

export type Expense = {
  id: string;
  companyId: string;
  amount: number;
  currency: string;
  expenseDate: string;
  category: string | null;
  description: string | null;
  vendor: string | null;
  vatAmount: number | null;
  vatRate: number | null;
  notes: string | null;
};

/** Resolve the workspace for this API key (keys are company-scoped). */
export async function resolveCompanyId(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  const me = await invox.get<AuthMe>("/api/auth/me");
  if (!me.companies?.length) {
    throw new Error("API key is not associated with any workspace");
  }
  return me.companies[0].companyId;
}
