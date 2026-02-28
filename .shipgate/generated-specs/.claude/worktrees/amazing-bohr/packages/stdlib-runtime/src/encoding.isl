# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: encodeBase64, decodeBase64, tryDecodeBase64, encodeBase64Url, decodeBase64Url, isValidBase64, isValidBase64Url, encodeUrl, decodeUrl, tryDecodeUrl, encodeUrlComponent, decodeUrlComponent, buildQueryString, parseQueryString, escapeHtml, unescapeHtml, escapeHtmlAttribute, encodeHex, decodeHex, isValidHex, encodeUtf8, decodeUtf8, getByteLength, stringToCodePoints, codePointsToString, escapeJsonString, unescapeJsonString, convert, detectEncoding, BASE64_ALPHABET, BASE64URL_ALPHABET, HEX_ALPHABET_LOWER, HEX_ALPHABET_UPPER, Encoding_, Encoding, EncodingResult, DecodingResult
# dependencies: 

domain Encoding {
  version: "1.0.0"

  type Encoding = String
  type EncodingResult = String
  type DecodingResult = String

  invariants exports_present {
    - true
  }
}
