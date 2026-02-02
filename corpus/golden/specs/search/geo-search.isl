// Search: Geospatial search
domain SearchGeo {
  version: "1.0.0"

  type GeoPoint = {
    latitude: Decimal
    longitude: Decimal
  }

  type BoundingBox = {
    top_left: GeoPoint
    bottom_right: GeoPoint
  }

  type GeoResult = {
    id: UUID
    name: String
    location: GeoPoint
    distance_km: Decimal
    address: String?
    category: String?
  }

  behavior GeoSearch {
    description: "Search by location"

    actors {
      Anonymous { }
      User { must: authenticated }
    }

    input {
      center: GeoPoint
      radius_km: Decimal
      query: String?
      categories: List<String>?
      sort_by_distance: Boolean?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        results: List<GeoResult>
        total_count: Int
        center: GeoPoint
        radius_km: Decimal
        has_more: Boolean
      }

      errors {
        INVALID_COORDINATES {
          when: "Coordinates are invalid"
          retriable: false
        }
        RADIUS_TOO_LARGE {
          when: "Search radius too large"
          retriable: false
        }
      }
    }

    pre {
      input.center.latitude >= -90 and input.center.latitude <= 90
      input.center.longitude >= -180 and input.center.longitude <= 180
      input.radius_km > 0
      input.radius_km <= 500
    }

    post success {
      - input.sort_by_distance == true implies is_sorted_by_distance(result.results)
      - all(r in result.results: r.distance_km <= input.radius_km)
    }

    temporal {
      - within 200ms (p99): response returned
    }
  }

  behavior BoundingBoxSearch {
    description: "Search within bounding box"

    actors {
      Anonymous { }
      User { must: authenticated }
    }

    input {
      bounds: BoundingBox
      query: String?
      categories: List<String>?
      page: Int?
      page_size: Int?
    }

    output {
      success: {
        results: List<GeoResult>
        total_count: Int
        bounds: BoundingBox
        has_more: Boolean
      }

      errors {
        INVALID_BOUNDS {
          when: "Bounding box is invalid"
          retriable: false
        }
        AREA_TOO_LARGE {
          when: "Search area too large"
          retriable: false
        }
      }
    }

    pre {
      input.bounds.top_left.latitude > input.bounds.bottom_right.latitude
      input.bounds.top_left.longitude < input.bounds.bottom_right.longitude
    }
  }

  behavior GetNearby {
    description: "Get nearby locations"

    actors {
      Anonymous { }
      User { must: authenticated }
    }

    input {
      location_id: UUID
      radius_km: Decimal?
      limit: Int?
      categories: List<String>?
    }

    output {
      success: List<GeoResult>

      errors {
        LOCATION_NOT_FOUND {
          when: "Location not found"
          retriable: false
        }
      }
    }

    pre {
      input.radius_km == null or input.radius_km > 0
      input.limit == null or (input.limit >= 1 and input.limit <= 100)
    }
  }

  behavior ReverseGeocode {
    description: "Get address from coordinates"

    actors {
      Anonymous { }
      User { must: authenticated }
    }

    input {
      location: GeoPoint
    }

    output {
      success: {
        address: String
        city: String
        state: String?
        country: String
        postal_code: String?
        formatted_address: String
      }

      errors {
        LOCATION_NOT_FOUND {
          when: "No address for location"
          retriable: false
        }
      }
    }

    pre {
      input.location.latitude >= -90 and input.location.latitude <= 90
      input.location.longitude >= -180 and input.location.longitude <= 180
    }
  }

  behavior Geocode {
    description: "Get coordinates from address"

    actors {
      Anonymous { }
      User { must: authenticated }
    }

    input {
      address: String
    }

    output {
      success: {
        location: GeoPoint
        formatted_address: String
        confidence: Decimal
      }

      errors {
        ADDRESS_NOT_FOUND {
          when: "Address not found"
          retriable: false
        }
        AMBIGUOUS_ADDRESS {
          when: "Multiple matches found"
          retriable: false
        }
      }
    }

    pre {
      input.address.length > 0
    }

    post success {
      - result.confidence >= 0 and result.confidence <= 1
    }
  }

  scenarios GeoSearch {
    scenario "find nearby restaurants" {
      when {
        result = GeoSearch(
          center: { latitude: 40.7128, longitude: -74.0060 },
          radius_km: 5,
          categories: ["restaurant"],
          sort_by_distance: true
        )
      }

      then {
        result is success
        all(r in result.results: r.distance_km <= 5)
      }
    }
  }
}
