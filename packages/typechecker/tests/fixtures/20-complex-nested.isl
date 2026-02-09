domain TestDomain {
  version: "1.0.0"
  
  type Email = String @format("email")
  type UserId = String
  
  entity User {
    id: UserId
    email: Email
    profile: UserProfile
  }
  
  entity UserProfile {
    name: String
    bio: String?
    avatar: String?
  }
  
  behavior CreateUser {
    input {
      email: Email
      name: String
    }
    output {
      success: User
    }
    preconditions {
      email != ""
      name != ""
    }
    postconditions {
      success {
        result.email == email
        result.profile.name == name
      }
    }
  }
}
