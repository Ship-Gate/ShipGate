domain TestDomain {
  version: "1.0.0"
  
  imports {
    { User } from "./shared/types.isl"
  }
  
  entity Order {
    user: User
    total: Decimal
  }
}
