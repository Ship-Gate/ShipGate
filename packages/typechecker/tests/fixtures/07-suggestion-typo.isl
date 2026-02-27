domain TestDomain {
  version: "1.0.0"
  
  type Email = String
  type UserName = String
  
  entity User {
    emial: Email
    usrName: UserName
  }
}
