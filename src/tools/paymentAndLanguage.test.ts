import { afterEach, describe, expect, it } from "vitest";
import { registerWorkspaceTools } from "./workspace.js";
import { registerClientTools } from "./clients.js";
import { registerInvoiceTools } from "./invoices.js";
import {
  AUTH_ME,
  COMPANY_ID,
  callTool,
  collectTools,
  stubApi,
  type StubbedApi,
} from "./toolTestHarness.js";

const COMPANY = {
  id: COMPANY_ID,
  name: "Nordisk Konsult AB",
  orgNumber: 5566778899,
  address: "Storgatan 1",
  zipCode: "411 38",
  city: "Göteborg",
  country: "SE",
  phone: "+46 31 123 45 67",
  email: "faktura@nordiskkonsult.se",
  bankAccount: null,
  bankgiro: "5555-6666",
  plusgiro: null,
  iban: null,
  bic: null,
  bankName: null,
  swishNumber: null,
  paymentReferenceMode: null,
  defaultInvoiceLanguage: null,
  defaultPaymentTermsDays: null,
  vatNumber: "SE556677889901",
  registeredForVat: true,
};

const CLIENT_ID = "33333333-3333-3333-3333-333333333333";
const CLIENT = {
  id: CLIENT_ID,
  companyId: COMPANY_ID,
  name: "Acme Ltd",
  orgNumber: null,
  contactPerson: "Jane Doe",
  address: "1 High Street",
  zipCode: "EC1A 1BB",
  city: "London",
  country: "GB",
  email: "ap@acme.co.uk",
  phone: null,
  notes: null,
  invoiceLanguage: null,
};

const INVOICE_ID = "44444444-4444-4444-4444-444444444444";
const INVOICE = {
  id: INVOICE_ID,
  companyId: COMPANY_ID,
  clientId: CLIENT_ID,
  invoiceNumber: "2026-0042",
  status: "DRAFT",
  issueDate: "2026-09-11",
  dueDate: "2026-10-11",
  currency: "SEK",
  subtotal: 10000,
  vatAmount: 2500,
  total: 12500,
  paidAmount: 0,
  paidDate: null,
  notes: null,
  terms: null,
  invoiceLanguage: "sv",
  paymentReference: "200260042 8",
  invoiceItems: [],
};

const workspaceTools = collectTools(registerWorkspaceTools);
const clientTools = collectTools(registerClientTools);
const invoiceTools = collectTools(registerInvoiceTools);

let api: StubbedApi;
afterEach(() => api?.restore());

describe("update_workspace payment methods", () => {
  it("sends the international fields the How to pay block reads", async () => {
    api = stubApi({
      "GET /api/auth/me": AUTH_ME,
      [`GET /api/companies/${COMPANY_ID}`]: COMPANY,
      [`PUT /api/companies/${COMPANY_ID}`]: COMPANY,
    });

    await callTool(workspaceTools, "update_workspace", {
      iban: "SE45 5000 0000 0583 9825 7466",
      bic: "ESSESESS",
      bank_name: "SEB",
      swish_number: "1231234567",
    });

    expect(api.requests.find((r) => r.method === "PUT")?.body).toMatchObject({
      iban: "SE45 5000 0000 0583 9825 7466",
      bic: "ESSESESS",
      bankName: "SEB",
      swishNumber: "1231234567",
    });
  });

  it("sets the OCR mode and keeps the existing bankgiro", async () => {
    api = stubApi({
      "GET /api/auth/me": AUTH_ME,
      [`GET /api/companies/${COMPANY_ID}`]: COMPANY,
      [`PUT /api/companies/${COMPANY_ID}`]: COMPANY,
    });

    await callTool(workspaceTools, "update_workspace", { payment_reference_mode: "OCR_HARD" });

    const body = api.requests.find((r) => r.method === "PUT")?.body;
    expect(body?.paymentReferenceMode).toBe("OCR_HARD");
    expect(body?.bankgiro).toBe("5555-6666");
  });

  it("sets the workspace defaults for language and terms", async () => {
    api = stubApi({
      "GET /api/auth/me": AUTH_ME,
      [`GET /api/companies/${COMPANY_ID}`]: COMPANY,
      [`PUT /api/companies/${COMPANY_ID}`]: COMPANY,
    });

    await callTool(workspaceTools, "update_workspace", {
      default_invoice_language: "en",
      default_payment_terms_days: 14,
    });

    expect(api.requests.find((r) => r.method === "PUT")?.body).toMatchObject({
      defaultInvoiceLanguage: "en",
      defaultPaymentTermsDays: 14,
    });
  });

  it("rejects payment terms outside the accepted range before calling the API", async () => {
    const schema = workspaceTools.get("update_workspace")?.inputSchema as Record<
      string,
      { safeParse: (v: unknown) => { success: boolean } }
    >;

    expect(schema.default_payment_terms_days.safeParse(400).success).toBe(false);
    expect(schema.default_payment_terms_days.safeParse(30).success).toBe(true);
    expect(schema.payment_reference_mode.safeParse("OCR_MEDIUM").success).toBe(false);
  });
});

describe("client invoice language override", () => {
  it("sets the override on create", async () => {
    api = stubApi({
      "GET /api/auth/me": AUTH_ME,
      [`POST /api/companies/${COMPANY_ID}/clients`]: CLIENT,
    });

    await callTool(clientTools, "create_client", { name: "Acme Ltd", invoice_language: "en" });

    expect(api.requests.find((r) => r.method === "POST")?.body?.invoiceLanguage).toBe("en");
  });

  it("passes an empty string through, so the override can be cleared", async () => {
    api = stubApi({
      "GET /api/auth/me": AUTH_ME,
      [`GET /api/companies/${COMPANY_ID}/clients/${CLIENT_ID}`]: { ...CLIENT, invoiceLanguage: "en" },
      [`PUT /api/companies/${COMPANY_ID}/clients/${CLIENT_ID}`]: CLIENT,
    });

    await callTool(clientTools, "update_client", { client_id: CLIENT_ID, invoice_language: "" });

    expect(api.requests.find((r) => r.method === "PUT")?.body?.invoiceLanguage).toBe("");
  });

  it("leaves the override alone when not mentioned", async () => {
    api = stubApi({
      "GET /api/auth/me": AUTH_ME,
      [`GET /api/companies/${COMPANY_ID}/clients/${CLIENT_ID}`]: { ...CLIENT, invoiceLanguage: "en" },
      [`PUT /api/companies/${COMPANY_ID}/clients/${CLIENT_ID}`]: CLIENT,
    });

    await callTool(clientTools, "update_client", { client_id: CLIENT_ID, city: "Manchester" });

    expect(api.requests.find((r) => r.method === "PUT")?.body?.invoiceLanguage).toBe("en");
  });
});

describe("create_invoice", () => {
  const items = [{ description: "Konsulttjänst", quantity: 10, unit_price: 1000, vat_rate: 25 }];

  it("omits due_date so the backend applies the workspace payment terms", async () => {
    api = stubApi({
      "GET /api/auth/me": AUTH_ME,
      "POST /api/invoices": INVOICE,
    });

    await callTool(invoiceTools, "create_invoice", {
      client_id: CLIENT_ID,
      invoice_number: "2026-0042",
      items,
    });

    const body = api.requests.find((r) => r.method === "POST")?.body;
    expect(body).not.toHaveProperty("dueDate");
    expect(body?.invoiceItems).toHaveLength(1);
  });

  it("forwards an explicit language and payment reference", async () => {
    api = stubApi({
      "GET /api/auth/me": AUTH_ME,
      "POST /api/invoices": INVOICE,
    });

    await callTool(invoiceTools, "create_invoice", {
      client_id: CLIENT_ID,
      invoice_number: "2026-0042",
      invoice_language: "en",
      payment_reference: "200260042 8",
      items,
    });

    expect(api.requests.find((r) => r.method === "POST")?.body).toMatchObject({
      invoiceLanguage: "en",
      paymentReference: "200260042 8",
    });
  });

  it("only accepts the two supported languages", async () => {
    const schema = invoiceTools.get("create_invoice")?.inputSchema as Record<
      string,
      { safeParse: (v: unknown) => { success: boolean } }
    >;

    expect(schema.invoice_language.safeParse("de").success).toBe(false);
    expect(schema.invoice_language.safeParse("sv").success).toBe(true);
  });
});

describe("update_invoice", () => {
  it("preserves the frozen language and reference when not changing them", async () => {
    api = stubApi({
      "GET /api/auth/me": AUTH_ME,
      [`GET /api/invoices/${INVOICE_ID}`]: INVOICE,
      [`PUT /api/invoices/${INVOICE_ID}`]: INVOICE,
    });

    await callTool(invoiceTools, "update_invoice", { invoice_id: INVOICE_ID, notes: "Tack!" });

    expect(api.requests.find((r) => r.method === "PUT")?.body).toMatchObject({
      invoiceLanguage: "sv",
      paymentReference: "200260042 8",
    });
  });
});

describe("get_invoice_pdf", () => {
  it("uses the localised filename the backend sends", async () => {
    const jsonStub = stubApi({ "GET /api/auth/me": AUTH_ME });
    api = jsonStub;
    globalThis.fetch = (async () =>
      new Response(Buffer.from("%PDF-1.4 x"), {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": 'inline; filename="Faktura-2026-0042.pdf"',
        },
      })) as typeof fetch;

    const result = await callTool(invoiceTools, "get_invoice_pdf", { invoice_id: INVOICE_ID });
    const first = result.content[0];
    if (first?.type !== "text") throw new Error("expected text block");

    expect(JSON.parse(first.text).filename).toBe("Faktura-2026-0042.pdf");
  });
});
