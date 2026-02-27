# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createDefaultKeyExtractor, IpKeyExtractor, UserIdKeyExtractor, ApiKeyExtractor, SessionKeyExtractor, HeaderKeyExtractor, QueryKeyExtractor, CookieKeyExtractor, CustomKeyExtractor, CompositeKeyExtractor, KeyExtractorFactory
# dependencies: 

domain KeyExtractor {
  version: "1.0.0"

  type IpKeyExtractor = String
  type UserIdKeyExtractor = String
  type ApiKeyExtractor = String
  type SessionKeyExtractor = String
  type HeaderKeyExtractor = String
  type QueryKeyExtractor = String
  type CookieKeyExtractor = String
  type CustomKeyExtractor = String
  type CompositeKeyExtractor = String
  type KeyExtractorFactory = String

  invariants exports_present {
    - true
  }
}
