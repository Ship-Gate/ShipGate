domain TypesStruct {
  version: "1.0.0"

  type Address = {
    line1: String
    city: String
    country: String
  }

  entity Place {
    id: UUID [immutable, unique]
    name: String
  }

  type Coordinates = {
    lat: Decimal
    lng: Decimal
  }

  entity Location {
    id: UUID [immutable, unique]
    address: Address
    coords: Coordinates?
  }

  behavior CreateLocation {
    input {
      address: Address
      coords: Coordinates?
    }
    output {
      success: Location
    }
  }
}
