domain TypesConstrained {
  version: "1.0.0"

  type Email = String {
    max_length: 254
  }

  type Money = Decimal {
    min: 0
    precision: 2
  }

  type Age = Int {
    min: 0
    max: 150
  }

  type Slug = String {
    min_length: 1
    max_length: 100
  }

  entity User {
    id: UUID [immutable, unique]
    email: Email
    balance: Money
    age: Age?
    slug: Slug
  }
}
