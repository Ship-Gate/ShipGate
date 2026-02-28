# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createOAuthService, OAuthStore, OAuthProviderConfig, OAuthUserInfo, OAuthService
# dependencies: 

domain Oauth {
  version: "1.0.0"

  type OAuthStore = String
  type OAuthProviderConfig = String
  type OAuthUserInfo = String
  type OAuthService = String

  invariants exports_present {
    - true
  }
}
