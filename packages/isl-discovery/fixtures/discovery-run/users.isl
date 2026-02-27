
domain Users {
  behavior CreateUser {
    input {
      email: String
    }
    output {
      success: User
    }
  }
}
