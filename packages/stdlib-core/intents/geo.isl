// ============================================================================
// ISL Standard Library - Geographic Types
// @stdlib/geo
// ============================================================================

/**
 * Full postal address
 */
type Address = {
  line1: String { max_length: 100 }
  line2: String? { max_length: 100 }
  line3: String? { max_length: 100 }
  city: String { max_length: 100 }
  state: String? { max_length: 100 }
  postalCode: String { max_length: 20 }
  country: CountryCode
}

/**
 * US-specific address
 */
type USAddress = {
  line1: String { max_length: 100 }
  line2: String? { max_length: 100 }
  city: String { max_length: 100 }
  state: USState
  zipCode: ZipCode
  country: String = "US"
}

/**
 * Simple address for forms
 */
type SimpleAddress = {
  street: String { max_length: 200 }
  city: String { max_length: 100 }
  postalCode: String { max_length: 20 }
  country: CountryCode
}

/**
 * Geographic coordinates (WGS84)
 */
type Coordinates = {
  latitude: Latitude
  longitude: Longitude
}

/**
 * Latitude (-90 to 90)
 */
type Latitude = Decimal {
  min: -90
  max: 90
  precision: 8
}

/**
 * Longitude (-180 to 180)
 */
type Longitude = Decimal {
  min: -180
  max: 180
  precision: 8
}

/**
 * Location with coordinates and optional address
 */
type Location = {
  coordinates: Coordinates
  address: Address?
  name: String? { max_length: 200 }
  placeId: String?  // Google Places ID or similar
}

/**
 * Bounding box for geographic regions
 */
type BoundingBox = {
  northEast: Coordinates
  southWest: Coordinates
  
  invariants {
    northEast.latitude >= southWest.latitude
  }
}

/**
 * Circular geographic region
 */
type GeoCircle = {
  center: Coordinates
  radius: Distance
}

/**
 * Polygon region defined by vertices
 */
type GeoPolygon = {
  vertices: List<Coordinates> { min_length: 3 }
  
  invariants {
    vertices.length >= 3
    // First and last vertex should be the same (closed polygon)
  }
}

/**
 * Distance with unit
 */
type Distance = {
  value: Decimal { min: 0, precision: 2 }
  unit: DistanceUnit
}

/**
 * Distance units
 */
enum DistanceUnit {
  METERS
  KILOMETERS
  MILES
  FEET
  YARDS
  NAUTICAL_MILES
}

/**
 * US ZIP code (5-digit or ZIP+4)
 */
type ZipCode = String {
  format: /^\d{5}(-\d{4})?$/
}

/**
 * UK postcode
 */
type UKPostcode = String {
  format: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i
}

/**
 * Canadian postal code
 */
type CanadianPostalCode = String {
  format: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i
}

/**
 * German postal code (PLZ)
 */
type GermanPostalCode = String {
  format: /^\d{5}$/
}

/**
 * US state codes
 */
enum USState {
  AL  // Alabama
  AK  // Alaska
  AZ  // Arizona
  AR  // Arkansas
  CA  // California
  CO  // Colorado
  CT  // Connecticut
  DE  // Delaware
  FL  // Florida
  GA  // Georgia
  HI  // Hawaii
  ID  // Idaho
  IL  // Illinois
  IN  // Indiana
  IA  // Iowa
  KS  // Kansas
  KY  // Kentucky
  LA  // Louisiana
  ME  // Maine
  MD  // Maryland
  MA  // Massachusetts
  MI  // Michigan
  MN  // Minnesota
  MS  // Mississippi
  MO  // Missouri
  MT  // Montana
  NE  // Nebraska
  NV  // Nevada
  NH  // New Hampshire
  NJ  // New Jersey
  NM  // New Mexico
  NY  // New York
  NC  // North Carolina
  ND  // North Dakota
  OH  // Ohio
  OK  // Oklahoma
  OR  // Oregon
  PA  // Pennsylvania
  RI  // Rhode Island
  SC  // South Carolina
  SD  // South Dakota
  TN  // Tennessee
  TX  // Texas
  UT  // Utah
  VT  // Vermont
  VA  // Virginia
  WA  // Washington
  WV  // West Virginia
  WI  // Wisconsin
  WY  // Wyoming
  DC  // District of Columbia
  PR  // Puerto Rico
  VI  // Virgin Islands
  GU  // Guam
  AS  // American Samoa
  MP  // Northern Mariana Islands
}

/**
 * Country code (ISO 3166-1 alpha-2)
 * Re-exported from primitives for convenience
 */
type CountryCode = String {
  format: /^[A-Z]{2}$/
  length: 2
}

/**
 * Country code (ISO 3166-1 alpha-3)
 */
type CountryCode3 = String {
  format: /^[A-Z]{3}$/
  length: 3
}

/**
 * Region/subdivision code (ISO 3166-2)
 * Example: US-CA, GB-ENG
 */
type SubdivisionCode = String {
  format: /^[A-Z]{2}-[A-Z0-9]{1,3}$/
}

/**
 * Plus Code (Open Location Code)
 * Example: 8FVC9G8F+6W
 */
type PlusCode = String {
  format: /^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2,}$/
}

/**
 * What3Words address
 * Example: filled.count.soap
 */
type What3Words = String {
  format: /^[a-z]+\.[a-z]+\.[a-z]+$/
}

/**
 * Geohash string
 */
type Geohash = String {
  format: /^[0-9b-hjkmnp-z]{1,12}$/
  min_length: 1
  max_length: 12
}

/**
 * Shipping address with contact info
 */
type ShippingAddress = {
  recipientName: String { max_length: 100 }
  company: String? { max_length: 100 }
  phone: Phone?
  address: Address
  instructions: String? { max_length: 500 }
  residential: Boolean
}

/**
 * Billing address
 */
type BillingAddress = {
  name: String { max_length: 100 }
  address: Address
  vatNumber: String? { max_length: 50 }
}
