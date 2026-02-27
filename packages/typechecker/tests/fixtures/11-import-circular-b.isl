domain TestDomain {
  version: "1.0.0"
  
  imports {
    { User } from "./a.isl"
  }
  
  entity Order {
    total: Decimal
  }
}
