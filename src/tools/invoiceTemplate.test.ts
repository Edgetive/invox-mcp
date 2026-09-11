import { afterEach, describe, expect, it } from "vitest";
import { registerInvoiceTemplateTools } from "./invoiceTemplate.js";
import {
  AUTH_ME,
  COMPANY_ID,
  callTool,
  collectTools,
  resultJson,
  stubApi,
  type StubbedApi,
} from "./toolTestHarness.js";

const SAVED_CONFIG = {
  version: 2,
  presetId: "nordic",
  accentId: "blue",
  logo: { position: "right", size: "medium" },
  showVatColumn: true,
  showQrCode: false,
};

const CATALOG = {
  version: 2,
  defaults: SAVED_CONFIG,
  presets: [
    {
      id: "nordic",
      label: "Nordic",
      description: "Calm and spacious",
      defaultAccentId: "blue",
      thumbnailPath: "/api/companies/{companyId}/invoice-template/presets/nordic/thumbnail",
      samplePdfPath: "/api/companies/{companyId}/invoice-template/presets/nordic/preview",
    },
  ],
  accents: [{ id: "blue", label: "Blue", strong: "#1d4ed8", soft: "#eff4ff" }],
  logoPositions: ["left", "right", "hidden"],
  logoSizes: ["small", "medium", "large"],
};

const tools = collectTools(registerInvoiceTemplateTools);

let api: StubbedApi;
afterEach(() => api?.restore());

describe("list_invoice_presets", () => {
  it("returns the catalog without needing a company", async () => {
    api = stubApi({ "GET /api/invoice-template/presets": CATALOG });

    const catalog = resultJson<typeof CATALOG>(await callTool(tools, "list_invoice_presets"));

    expect(catalog.presets[0].id).toBe("nordic");
    expect(catalog.accents[0].strong).toBe("#1d4ed8");
    expect(api.requests.map((r) => r.path)).toEqual(["/api/invoice-template/presets"]);
  });
});

describe("set_invoice_template", () => {
  it("keeps unspecified fields at their current value", async () => {
    api = stubApi({
      "GET /api/auth/me": AUTH_ME,
      [`GET /api/companies/${COMPANY_ID}/invoice-template`]: SAVED_CONFIG,
      [`PUT /api/companies/${COMPANY_ID}/invoice-template`]: {
        ...SAVED_CONFIG,
        presetId: "editorial",
      },
    });

    await callTool(tools, "set_invoice_template", { preset_id: "editorial" });

    const put = api.requests.find((r) => r.method === "PUT");
    expect(put?.body).toEqual({
      version: 2,
      presetId: "editorial",
      accentId: "blue",
      logo: { position: "right", size: "medium" },
      showVatColumn: true,
      showQrCode: false,
    });
  });

  it("sends a nested logo object, because the backend rejects flat logo fields", async () => {
    api = stubApi({
      "GET /api/auth/me": AUTH_ME,
      [`GET /api/companies/${COMPANY_ID}/invoice-template`]: SAVED_CONFIG,
      [`PUT /api/companies/${COMPANY_ID}/invoice-template`]: SAVED_CONFIG,
    });

    await callTool(tools, "set_invoice_template", {
      logo_position: "left",
      logo_size: "large",
    });

    const put = api.requests.find((r) => r.method === "PUT");
    expect(put?.body?.logo).toEqual({ position: "left", size: "large" });
    expect(put?.body).not.toHaveProperty("logoPosition");
  });

  it("can turn a boolean toggle off", async () => {
    api = stubApi({
      "GET /api/auth/me": AUTH_ME,
      [`GET /api/companies/${COMPANY_ID}/invoice-template`]: SAVED_CONFIG,
      [`PUT /api/companies/${COMPANY_ID}/invoice-template`]: SAVED_CONFIG,
    });

    await callTool(tools, "set_invoice_template", { show_vat_column: false });

    expect(api.requests.find((r) => r.method === "PUT")?.body?.showVatColumn).toBe(false);
  });

  it("surfaces the plan gate instead of reporting success", async () => {
    api = stubApi({
      "GET /api/auth/me": AUTH_ME,
      [`GET /api/companies/${COMPANY_ID}/invoice-template`]: SAVED_CONFIG,
    });

    const result = await callTool(tools, "set_invoice_template", { preset_id: "bold" });

    expect(result.isError).toBe(true);
  });
});

describe("preview_invoice_template", () => {
  it("previews the saved design when no preset is named", async () => {
    api = stubPdf();

    await callTool(tools, "preview_invoice_template");

    expect(api.requests.at(-1)?.path).toBe(
      `/api/companies/${COMPANY_ID}/invoice-template/preview`,
    );
  });

  it("previews a named preset without saving it", async () => {
    api = stubPdf();

    await callTool(tools, "preview_invoice_template", { preset_id: "premium", language: "en" });

    expect(api.requests.at(-1)?.path).toBe(
      `/api/companies/${COMPANY_ID}/invoice-template/presets/premium/preview?language=en`,
    );
    expect(api.requests.every((r) => r.method === "GET")).toBe(true);
  });

  it("returns the PDF as a resource block", async () => {
    api = stubPdf();

    const result = await callTool(tools, "preview_invoice_template");

    expect(result.content[1]).toMatchObject({
      type: "resource",
      resource: { mimeType: "application/pdf" },
    });
  });
});

/** getRaw bypasses the JSON envelope, so the PDF route needs a non-JSON stub. */
function stubPdf(): StubbedApi {
  const jsonOnly = stubApi({ "GET /api/auth/me": AUTH_ME });
  const stubbed = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    if (String(url).includes("invoice-template")) {
      jsonOnly.requests.push({
        method: init?.method ?? "GET",
        path: new URL(String(url)).pathname + (new URL(String(url)).search || ""),
        body: null,
        headers: {},
      });
      return new Response(Buffer.from("%PDF-1.4 sample"), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    }
    return stubbed(url as never, init);
  }) as typeof fetch;
  return jsonOnly;
}
