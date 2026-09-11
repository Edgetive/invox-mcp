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

function parseJsonBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(parsed: unknown, status: number): string {
  if (typeof parsed === "object" && parsed && "message" in parsed) {
    return String((parsed as { message: unknown }).message);
  }
  return `Invox API error ${status}`;
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
  const parsed = parseJsonBody(text);

  if (!res.ok) {
    throw new InvoxApiError(errorMessage(parsed, res.status), res.status, parsed);
  }

  if (parsed && typeof parsed === "object" && "data" in parsed) {
    return (parsed as ApiEnvelope<T>).data;
  }
  return parsed as T;
}

/**
 * Multipart upload. Do not set Content-Type — fetch must supply the boundary.
 */
async function postForm<T>(path: string, form: FormData): Promise<T> {
  const authorization = getAuthorization();
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      Accept: "application/json",
    },
    body: form,
  });

  const text = await res.text();
  const parsed = parseJsonBody(text);

  if (!res.ok) {
    throw new InvoxApiError(errorMessage(parsed, res.status), res.status, parsed);
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
  postForm: <T>(path: string, form: FormData) => postForm<T>(path, form),
};

/** Build a multipart file part from agent-supplied base64 content. */
export function filePartFromBase64(
  fileBase64: string,
  filename: string,
  contentType: string,
): File {
  const bytes = Buffer.from(fileBase64, "base64");
  return new File([bytes], filename, { type: contentType });
}

export function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

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

/** NONE leaves the invoice number as the payment reference. */
export type PaymentReferenceMode = "NONE" | "OCR_SOFT" | "OCR_HARD";

export type DocumentLanguage = "sv" | "en";

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
  iban: string | null;
  bic: string | null;
  bankName: string | null;
  swishNumber: string | null;
  paymentReferenceMode: PaymentReferenceMode | null;
  defaultInvoiceLanguage: DocumentLanguage | null;
  defaultPaymentTermsDays: number | null;
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
  /** Null means the client inherits the workspace default. */
  invoiceLanguage: DocumentLanguage | null;
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
  invoiceLanguage: DocumentLanguage | null;
  paymentReference: string | null;
  invoiceItems: Array<Record<string, unknown>>;
};

export type InvoicePresetCatalog = {
  version: number;
  defaults: InvoiceTemplateConfig;
  presets: Array<{
    id: string;
    label: string;
    description: string;
    defaultAccentId: string;
    thumbnailPath: string;
    samplePdfPath: string;
  }>;
  accents: Array<{ id: string; label: string; strong: string; soft: string }>;
  logoPositions: string[];
  logoSizes: string[];
};

export type InvoiceTemplateConfig = {
  version: number;
  presetId: string;
  accentId: string;
  logo: { position: string; size: string };
  showVatColumn: boolean;
  showQrCode: boolean;
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
  receiptUrl: string | null;
  vatAmount: number | null;
  vatRate: number | null;
  notes: string | null;
};

export type BankStatementDocument = {
  id: string;
  companyId: string;
  folderYearMonth: string;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  uploadedBy?: string | null;
  uploadedAt?: string;
  createdAt?: string;
};

export type BankStatementTransaction = {
  id: string;
  companyId: string;
  statementId: string;
  bookingDate: string | null;
  valueDate: string | null;
  description: string | null;
  amount: number | null;
  balance: number | null;
  currency: string | null;
  lineNumber: number | null;
  rawLine: string | null;
  createdAt: string;
};

export type IncomingInvoiceDocument = {
  id: string;
  companyId: string;
  folderYearMonth: string;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  createdAt: string;
};

export type ExpenseExtractionDraft = {
  id: string;
  documentId: string;
  companyId: string;
  status: string;
  suggestedExpense: {
    documentId: string;
    vendor: string | null;
    expenseDate: string | null;
    amount: number | null;
    currency: string | null;
    vatAmount: number | null;
    vatRate: number | null;
    category: string | null;
    description: string | null;
    requiredMissingFields: string[];
    confidenceJson: string | null;
  } | null;
  rawText: string | null;
  failureReason: string | null;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
