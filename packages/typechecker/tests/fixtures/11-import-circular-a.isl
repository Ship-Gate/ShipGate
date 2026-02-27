domain TestDomain {
  version: "1.0.0"
  
  imports {
    { Order } from "./b.isl"
  }
  
  entity User {
    name: String
  }
}
