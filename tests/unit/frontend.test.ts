import { describe, expect, it } from "vitest";
import { isFrontendDocumentRequest } from "../../src/server/frontend.js";

describe("frontend document requests", () => {
  it.each(["GET", "HEAD"])("serves the SPA shell for HTML %s requests", (method) => {
    expect(isFrontendDocumentRequest(method, true)).toBe(true);
  });

  it("does not serve the SPA shell for API-style or mutating requests", () => {
    expect(isFrontendDocumentRequest("GET", false)).toBe(false);
    expect(isFrontendDocumentRequest("POST", true)).toBe(false);
  });
});
