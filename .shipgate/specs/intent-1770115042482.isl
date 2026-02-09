domain Login {
  use stdlib-auth

  state {
    sessions: Map<string, Session>
  }

  behavior authenticate(provider: AuthProvider, credentials: Credentials) -> Result<Session, Error> {
    precondition: credentials != null && provider.isEnabled
    postcondition: result.session.isValid && result.session.userId != null
    errors: [InvalidCredentials, ProviderUnavailable, AccountLocked]
  }

  behavior authenticateWithGoogle(googleToken: String) -> Result<Session, Error> {
    precondition: googleToken.length > 0
    postcondition: result.session.provider == "google" && result.user.email != null
    errors: [InvalidGoogleToken, GoogleAccountNotLinked]
  }

  behavior authenticateWithGitHub(githubCode: String) -> Result<Session, Error> {
    precondition: githubCode.length > 0
    postcondition: result.session.provider == "github" && result.user.githubId != null
    errors: [InvalidGitHubCode, GitHubAccountNotLinked]
  }

  invariant forall s in sessions: s.expiresAt > now()
}
