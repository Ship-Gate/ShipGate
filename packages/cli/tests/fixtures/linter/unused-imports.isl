domain TestDomain {
  version: "1.0.0"
  
  imports {
    { User, UnusedType } from "./types.isl"
  }
  
  entity Order {
    user: User
  }
}
