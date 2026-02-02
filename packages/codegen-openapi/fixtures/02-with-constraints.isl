// Domain with various constraints
domain Constraints {
  version: "1.0.0"
  
  type Email = String {
    format: email
    max_length: 254
  }
  
  type Age = Int {
    min: 0
    max: 150
  }
  
  type Username = String {
    min_length: 3
    max_length: 32
  }
  
  type Money = Decimal {
    min: 0
    precision: 2
  }
  
  entity Person {
    id: UUID [immutable]
    email: Email
    age: Age?
    username: Username
    balance: Money
  }
  
  behavior CreatePerson {
    input {
      email: Email
      age: Age?
      username: Username
    }
    output {
      success: Person
    }
  }
}
