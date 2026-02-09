domain TestDomain {
  version: "1.0.0"
  
  imports {
    { User } from "./nonexistent.isl"
  }
  
  entity Order {
    user: User
  }
}
