domain TestDomain {
  version: "1.0.0"
  
  imports {
    { User } from "./types1.isl"
    { User } from "./types2.isl"
  }
  
  entity Order {
    user: User
  }
}
