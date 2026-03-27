import {
  parseAttributionFromURL,
} from "oursprivacy-react-native/javascript/oursprivacy-attribution";
import {
  UTM_PARAMS,
  CLICK_IDS,
} from "oursprivacy-react-native/javascript/oursprivacy-schema";

describe("parseAttributionFromURL", () => {
  it("should parse all UTM parameters", () => {
    const url =
      "myapp://open?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale&utm_content=banner_1&utm_term=analytics+sdk";
    const result = parseAttributionFromURL(url);
    expect(result.utmParams).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "spring_sale",
      utm_content: "banner_1",
      utm_term: "analytics sdk",
    });
    expect(result.clickIds).toBeNull();
    expect(result.oursVisitorId).toBeNull();
  });

  it("should parse click IDs", () => {
    const url = "myapp://open?gclid=abc123&fbclid=def456&ttclid=ghi789";
    const result = parseAttributionFromURL(url);
    expect(result.clickIds).toEqual({
      gclid: "abc123",
      fbclid: "def456",
      ttclid: "ghi789",
    });
    expect(result.utmParams).toBeNull();
  });

  it("should parse AppLovin-specific params", () => {
    const url = "myapp://open?aleid=click_123&alart=user_456";
    const result = parseAttributionFromURL(url);
    expect(result.clickIds).toEqual({
      aleid: "click_123",
      alart: "user_456",
    });
  });

  it("should parse ours_visitor_id for cross-platform identity", () => {
    const url =
      "myapp://open?ours_visitor_id=550e8400-e29b-41d4-a716-446655440000&utm_source=email";
    const result = parseAttributionFromURL(url);
    expect(result.oursVisitorId).toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    );
    expect(result.utmParams).toEqual({utm_source: "email"});
  });

  it("should return rawURL", () => {
    const url = "myapp://open?utm_source=google";
    const result = parseAttributionFromURL(url);
    expect(result.rawURL).toBe(url);
  });

  it("should handle URL with no query params", () => {
    const url = "myapp://open";
    const result = parseAttributionFromURL(url);
    expect(result.utmParams).toBeNull();
    expect(result.clickIds).toBeNull();
    expect(result.oursVisitorId).toBeNull();
    expect(result.rawURL).toBe(url);
  });

  it("should handle URL with fragment after query params", () => {
    const url = "myapp://open?utm_source=google&gclid=abc#section";
    const result = parseAttributionFromURL(url);
    expect(result.utmParams).toEqual({utm_source: "google"});
    expect(result.clickIds).toEqual({gclid: "abc"});
  });

  it("should handle https URLs", () => {
    const url =
      "https://example.com/app?utm_source=facebook&utm_medium=social&fbclid=xyz";
    const result = parseAttributionFromURL(url);
    expect(result.utmParams).toEqual({
      utm_source: "facebook",
      utm_medium: "social",
    });
    expect(result.clickIds).toEqual({fbclid: "xyz"});
  });

  it("should decode URI-encoded values", () => {
    const url = "myapp://open?utm_campaign=spring%20sale%202026&utm_source=g%C3%B6ogle";
    const result = parseAttributionFromURL(url);
    expect(result.utmParams).toEqual({
      utm_campaign: "spring sale 2026",
      utm_source: "göogle",
    });
  });

  it("should handle malformed encoding gracefully", () => {
    const url = "myapp://open?utm_source=%E0%A4%A";
    const result = parseAttributionFromURL(url);
    // Should not throw, should return the raw value
    expect(result.utmParams).toBeTruthy();
    expect(result.utmParams.utm_source).toBeDefined();
  });

  it("should ignore empty param values", () => {
    const url = "myapp://open?utm_source=&utm_medium=cpc&gclid=";
    const result = parseAttributionFromURL(url);
    expect(result.utmParams).toEqual({utm_medium: "cpc"});
    expect(result.clickIds).toBeNull();
  });

  it("should ignore params without = sign", () => {
    const url = "myapp://open?utm_source=google&orphan_key&utm_medium=cpc";
    const result = parseAttributionFromURL(url);
    expect(result.utmParams).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
    });
  });

  it("should handle null input", () => {
    const result = parseAttributionFromURL(null);
    expect(result.utmParams).toBeNull();
    expect(result.clickIds).toBeNull();
    expect(result.oursVisitorId).toBeNull();
    expect(result.rawURL).toBe("");
  });

  it("should handle undefined input", () => {
    const result = parseAttributionFromURL(undefined);
    expect(result.utmParams).toBeNull();
    expect(result.clickIds).toBeNull();
    expect(result.oursVisitorId).toBeNull();
    expect(result.rawURL).toBe("");
  });

  it("should handle empty string input", () => {
    const result = parseAttributionFromURL("");
    expect(result.utmParams).toBeNull();
    expect(result.clickIds).toBeNull();
    expect(result.oursVisitorId).toBeNull();
    expect(result.rawURL).toBe("");
  });

  it("should parse a complex real-world deep link", () => {
    const url =
      "myapp://products/123?utm_source=applovin&utm_medium=cpc&utm_campaign=retarget_q1&aleid=click_abc&alart=user_xyz&ours_visitor_id=web-uuid-123&gclid=google_click";
    const result = parseAttributionFromURL(url);
    expect(result.utmParams).toEqual({
      utm_source: "applovin",
      utm_medium: "cpc",
      utm_campaign: "retarget_q1",
    });
    expect(result.clickIds).toEqual({
      aleid: "click_abc",
      alart: "user_xyz",
      gclid: "google_click",
    });
    expect(result.oursVisitorId).toBe("web-uuid-123");
  });

  it("should export UTM_PARAMS list from schema", () => {
    expect(UTM_PARAMS).toContain("utm_source");
    expect(UTM_PARAMS).toContain("utm_medium");
    expect(UTM_PARAMS).toContain("utm_campaign");
    expect(UTM_PARAMS).toContain("utm_content");
    expect(UTM_PARAMS).toContain("utm_term");
  });

  it("should export CLICK_IDS list from schema including AppLovin params", () => {
    expect(CLICK_IDS).toContain("gclid");
    expect(CLICK_IDS).toContain("fbclid");
    expect(CLICK_IDS).toContain("ttclid");
    expect(CLICK_IDS).toContain("aleid");
    expect(CLICK_IDS).toContain("alart");
    expect(CLICK_IDS).toContain("msclkid");
    // These come from the server schema, not hardcoded
    expect(CLICK_IDS).toContain("irclickid"); // server uses irclickid, not irclid
  });
});
