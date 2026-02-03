// Fixture: Type reference with typo - should trigger "did you mean?" suggestion
// Expected Error: E0201 with help suggesting 'UserProfile'

domain TestDomain {
  version: "1.0.0"

  type UserProfile = {
    name: String
    email: String
  }

  entity User {
    id: UUID [immutable, unique]
    profile: UserProfle  // Typo: should suggest 'UserProfile'
  }
}
