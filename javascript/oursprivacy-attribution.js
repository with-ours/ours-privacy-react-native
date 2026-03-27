/**
 * Deep link / URL attribution parser.
 *
 * Extracts marketing attribution data (UTM params, click IDs, visitor ID)
 * from a URL string. Field lists are sourced from oursprivacy-schema.js,
 * which is auto-generated from the server's Zod schema to ensure the SDK
 * and server stay in sync.
 *
 * Parsed fields go into **defaultProperties** (not eventProperties) because
 * the server schema has dedicated typed columns for them. Unknown keys in
 * defaultProperties are silently stripped by the server's Zod parse.
 *
 * @see scripts/sync-schema.js
 * @see oursprivacy-schema.js (auto-generated, do not edit)
 */

import {UTM_PARAMS, CLICK_IDS} from "./oursprivacy-schema";

const OURS_VISITOR_ID_PARAM = "ours_visitor_id";

/**
 * Parse query parameters from a URL string.
 * Uses simple string splitting instead of the URL constructor,
 * which is polyfill-dependent and inconsistent across RN environments.
 */
function parseQueryParams(url) {
  if (!url || typeof url !== "string") {
    return {};
  }
  const queryStart = url.indexOf("?");
  if (queryStart === -1) {
    return {};
  }
  const queryString = url.substring(queryStart + 1);
  // Strip any fragment
  const fragmentStart = queryString.indexOf("#");
  const cleanQuery =
    fragmentStart === -1
      ? queryString
      : queryString.substring(0, fragmentStart);

  const params = {};
  const pairs = cleanQuery.split("&");
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const eqIndex = pair.indexOf("=");
    if (eqIndex === -1) continue;
    const key = pair.substring(0, eqIndex);
    const value = pair.substring(eqIndex + 1);
    try {
      params[key] = decodeURIComponent(value.replace(/\+/g, " "));
    } catch (_) {
      params[key] = value;
    }
  }
  return params;
}

/**
 * Extract a subset of params from parsed query params.
 * Returns an object with only the keys that are present, or null if none found.
 */
function extractParams(queryParams, keys) {
  const result = {};
  let found = false;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (queryParams[key] !== undefined && queryParams[key] !== "") {
      result[key] = queryParams[key];
      found = true;
    }
  }
  return found ? result : null;
}

/**
 * Parse marketing attribution data from a URL.
 *
 * Extracts UTM parameters, ad network click IDs (Google, Meta, TikTok,
 * AppLovin, etc.), and the Ours Privacy cross-platform visitor ID.
 *
 * All returned fields (utmParams + clickIds) are valid keys in the server's
 * defaultPayload schema and should be placed in defaultProperties.
 *
 * @param {string} url - The deep link or initial URL to parse.
 * @returns {{ utmParams: object|null, clickIds: object|null, oursVisitorId: string|null, rawURL: string }}
 */
export function parseAttributionFromURL(url) {
  const queryParams = parseQueryParams(url);
  return {
    utmParams: extractParams(queryParams, UTM_PARAMS),
    clickIds: extractParams(queryParams, CLICK_IDS),
    oursVisitorId: queryParams[OURS_VISITOR_ID_PARAM] || null,
    rawURL: url || "",
  };
}

export {UTM_PARAMS, CLICK_IDS, OURS_VISITOR_ID_PARAM};
