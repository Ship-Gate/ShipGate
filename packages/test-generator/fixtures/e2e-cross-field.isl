// E2E Test Generation Fixture: Cross-Field Constraints
// Tests constraints that relate multiple input fields (a < b, etc.)
domain CrossFieldFixture {
  version: "1.0.0"

  type DateRange = {
    start_date: Timestamp
    end_date: Timestamp
  }

  type PriceRange = {
    min_price: Decimal
    max_price: Decimal
  }

  entity Booking {
    id: UUID [immutable, unique]
    room_id: UUID [indexed]
    check_in: Timestamp
    check_out: Timestamp
    guests: Int
    total_price: Decimal
    created_at: Timestamp [immutable]

    invariants {
      check_out > check_in
      guests >= 1
      total_price > 0
    }
  }

  entity PriceFilter {
    id: UUID [immutable, unique]
    min_price: Decimal
    max_price: Decimal
    created_at: Timestamp [immutable]

    invariants {
      max_price >= min_price
      min_price >= 0
    }
  }

  behavior CreateBooking {
    description: "Create a room booking with date range"

    input {
      room_id: UUID
      check_in: Timestamp
      check_out: Timestamp
      guests: Int
      price_per_night: Decimal
    }

    output {
      success: Booking

      errors {
        INVALID_DATE_RANGE {
          when: "Check-out must be after check-in"
          retriable: true
        }
        ROOM_NOT_AVAILABLE {
          when: "Room is not available for selected dates"
          retriable: false
        }
        INVALID_GUEST_COUNT {
          when: "Guest count is invalid"
          retriable: true
        }
      }
    }

    preconditions {
      input.check_out > input.check_in
      input.guests >= 1
      input.guests <= 10
      input.price_per_night > 0
    }

    postconditions {
      success implies {
        Booking.exists(result.id)
        Booking.lookup(result.id).room_id == input.room_id
        Booking.lookup(result.id).check_in == input.check_in
        Booking.lookup(result.id).check_out == input.check_out
        Booking.lookup(result.id).total_price > 0
      }

      INVALID_DATE_RANGE implies {
        Booking.count == old(Booking.count)
      }
    }
  }

  behavior CreatePriceFilter {
    description: "Create a price filter with min/max range"

    input {
      min_price: Decimal
      max_price: Decimal
    }

    output {
      success: PriceFilter

      errors {
        INVALID_RANGE {
          when: "Max price must be >= min price"
          retriable: true
        }
        NEGATIVE_PRICE {
          when: "Price cannot be negative"
          retriable: true
        }
      }
    }

    preconditions {
      input.min_price >= 0
      input.max_price >= input.min_price
    }

    postconditions {
      success implies {
        PriceFilter.exists(result.id)
        PriceFilter.lookup(result.id).min_price == input.min_price
        PriceFilter.lookup(result.id).max_price == input.max_price
      }
    }
  }
}
