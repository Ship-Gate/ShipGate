// ============================================================================
// ISL Standard Library - Geo Test Suite
// ============================================================================

import { describe, test, expect } from 'vitest';
import {
  // Coordinate helpers
  isValidLatitude,
  isValidLongitude,
  isValidCoordinates,
  createCoordinates,
  
  // Distance helpers
  toMeters,
  toKilometers,
  toMiles,
  createDistance,
  meters,
  kilometers,
  miles,
  
  // Distance calculations
  haversineDistance,
  isWithinRadius,
  
  // Bounding box
  createBoundingBox,
  isWithinBoundingBox,
  getBoundingBoxCenter,
  
  // Postal code validation
  isValidUSZipCode,
  isValidUKPostcode,
  isValidCanadianPostalCode,
  isValidGermanPostalCode,
  isValidUSState,
  
  // Address helpers
  isValidAddress,
  isValidUSAddress,
  formatAddress,
  formatUSAddress,
  
  // Geo encoding
  isValidGeohash,
  isValidPlusCode,
  isValidWhat3Words,
  
  // Types
  DistanceUnit,
  US_STATES,
} from '../implementations/typescript/geo';

// ============================================================================
// COORDINATE VALIDATION
// ============================================================================

describe('Coordinate Validation', () => {
  test('isValidLatitude accepts valid values', () => {
    expect(isValidLatitude(0)).toBe(true);
    expect(isValidLatitude(45.5)).toBe(true);
    expect(isValidLatitude(-90)).toBe(true);
    expect(isValidLatitude(90)).toBe(true);
  });

  test('isValidLatitude rejects invalid values', () => {
    expect(isValidLatitude(-91)).toBe(false);
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLatitude(180)).toBe(false);
  });

  test('isValidLongitude accepts valid values', () => {
    expect(isValidLongitude(0)).toBe(true);
    expect(isValidLongitude(122.4194)).toBe(true);
    expect(isValidLongitude(-180)).toBe(true);
    expect(isValidLongitude(180)).toBe(true);
  });

  test('isValidLongitude rejects invalid values', () => {
    expect(isValidLongitude(-181)).toBe(false);
    expect(isValidLongitude(181)).toBe(false);
    expect(isValidLongitude(360)).toBe(false);
  });

  test('isValidCoordinates validates both', () => {
    expect(isValidCoordinates({ latitude: 37.7749, longitude: -122.4194 })).toBe(true);
    expect(isValidCoordinates({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidCoordinates({ latitude: 0, longitude: 181 })).toBe(false);
  });

  test('createCoordinates creates valid coordinates', () => {
    const coords = createCoordinates(37.7749, -122.4194);
    expect(coords.latitude).toBe(37.7749);
    expect(coords.longitude).toBe(-122.4194);
  });

  test('createCoordinates throws for invalid values', () => {
    expect(() => createCoordinates(91, 0)).toThrow();
    expect(() => createCoordinates(0, 181)).toThrow();
  });
});

// ============================================================================
// DISTANCE OPERATIONS
// ============================================================================

describe('Distance Operations', () => {
  test('creates distances with correct units', () => {
    expect(meters(100).unit).toBe(DistanceUnit.METERS);
    expect(kilometers(5).unit).toBe(DistanceUnit.KILOMETERS);
    expect(miles(10).unit).toBe(DistanceUnit.MILES);
  });

  test('toMeters converts correctly', () => {
    expect(toMeters(meters(100))).toBe(100);
    expect(toMeters(kilometers(1))).toBe(1000);
    expect(toMeters(miles(1))).toBeCloseTo(1609.344, 2);
  });

  test('toKilometers converts correctly', () => {
    expect(toKilometers(meters(1000))).toBe(1);
    expect(toKilometers(miles(1))).toBeCloseTo(1.609344, 4);
  });

  test('toMiles converts correctly', () => {
    expect(toMiles(kilometers(1.609344))).toBeCloseTo(1, 4);
  });

  test('createDistance throws for negative values', () => {
    expect(() => createDistance(-1, DistanceUnit.METERS)).toThrow();
  });
});

// ============================================================================
// HAVERSINE DISTANCE
// ============================================================================

describe('Haversine Distance', () => {
  test('calculates distance between two points', () => {
    // San Francisco to Los Angeles (~559 km)
    const sf = { latitude: 37.7749, longitude: -122.4194 };
    const la = { latitude: 34.0522, longitude: -118.2437 };
    const distance = haversineDistance(sf, la);
    expect(toKilometers(distance)).toBeCloseTo(559, -1); // Within 10km
  });

  test('same point returns zero distance', () => {
    const point = { latitude: 40.7128, longitude: -74.0060 };
    const distance = haversineDistance(point, point);
    expect(toMeters(distance)).toBe(0);
  });

  test('calculates distance across date line', () => {
    // Tokyo to Honolulu
    const tokyo = { latitude: 35.6762, longitude: 139.6503 };
    const honolulu = { latitude: 21.3069, longitude: -157.8583 };
    const distance = haversineDistance(tokyo, honolulu);
    expect(toKilometers(distance)).toBeGreaterThan(6000);
  });
});

// ============================================================================
// WITHIN RADIUS
// ============================================================================

describe('Within Radius', () => {
  test('point within radius returns true', () => {
    const center = { latitude: 40.7128, longitude: -74.0060 }; // NYC
    const point = { latitude: 40.7580, longitude: -73.9855 };  // Times Square
    expect(isWithinRadius(point, center, kilometers(10))).toBe(true);
  });

  test('point outside radius returns false', () => {
    const center = { latitude: 40.7128, longitude: -74.0060 }; // NYC
    const point = { latitude: 34.0522, longitude: -118.2437 }; // LA
    expect(isWithinRadius(point, center, kilometers(100))).toBe(false);
  });
});

// ============================================================================
// BOUNDING BOX
// ============================================================================

describe('Bounding Box', () => {
  test('createBoundingBox creates valid box', () => {
    const box = createBoundingBox(
      { latitude: 41, longitude: -73 },
      { latitude: 40, longitude: -74 }
    );
    expect(box.northEast.latitude).toBe(41);
    expect(box.southWest.latitude).toBe(40);
  });

  test('createBoundingBox throws when NE latitude < SW latitude', () => {
    expect(() => createBoundingBox(
      { latitude: 40, longitude: -73 },
      { latitude: 41, longitude: -74 }
    )).toThrow();
  });

  test('isWithinBoundingBox returns true for point inside', () => {
    const box = createBoundingBox(
      { latitude: 41, longitude: -73 },
      { latitude: 40, longitude: -74 }
    );
    expect(isWithinBoundingBox({ latitude: 40.5, longitude: -73.5 }, box)).toBe(true);
  });

  test('isWithinBoundingBox returns false for point outside', () => {
    const box = createBoundingBox(
      { latitude: 41, longitude: -73 },
      { latitude: 40, longitude: -74 }
    );
    expect(isWithinBoundingBox({ latitude: 42, longitude: -73 }, box)).toBe(false);
  });

  test('getBoundingBoxCenter calculates correct center', () => {
    const box = createBoundingBox(
      { latitude: 42, longitude: -72 },
      { latitude: 40, longitude: -74 }
    );
    const center = getBoundingBoxCenter(box);
    expect(center.latitude).toBe(41);
    expect(center.longitude).toBe(-73);
  });
});

// ============================================================================
// POSTAL CODE VALIDATION
// ============================================================================

describe('US ZIP Code Validation', () => {
  test('accepts valid ZIP codes', () => {
    expect(isValidUSZipCode('12345')).toBe(true);
    expect(isValidUSZipCode('12345-6789')).toBe(true);
    expect(isValidUSZipCode('00000')).toBe(true);
    expect(isValidUSZipCode('99999')).toBe(true);
  });

  test('rejects invalid ZIP codes', () => {
    expect(isValidUSZipCode('1234')).toBe(false);
    expect(isValidUSZipCode('123456')).toBe(false);
    expect(isValidUSZipCode('12345-678')).toBe(false);
    expect(isValidUSZipCode('ABCDE')).toBe(false);
  });
});

describe('UK Postcode Validation', () => {
  test('accepts valid UK postcodes', () => {
    expect(isValidUKPostcode('SW1A 1AA')).toBe(true);
    expect(isValidUKPostcode('EC1A 1BB')).toBe(true);
    expect(isValidUKPostcode('W1A 0AX')).toBe(true);
    expect(isValidUKPostcode('M1 1AE')).toBe(true);
    expect(isValidUKPostcode('B33 8TH')).toBe(true);
  });

  test('rejects invalid UK postcodes', () => {
    expect(isValidUKPostcode('12345')).toBe(false);
    expect(isValidUKPostcode('INVALID')).toBe(false);
  });
});

describe('Canadian Postal Code Validation', () => {
  test('accepts valid Canadian postal codes', () => {
    expect(isValidCanadianPostalCode('K1A 0B1')).toBe(true);
    expect(isValidCanadianPostalCode('V6B 3K9')).toBe(true);
    expect(isValidCanadianPostalCode('M5V3L9')).toBe(true); // Without space
  });

  test('rejects invalid Canadian postal codes', () => {
    expect(isValidCanadianPostalCode('12345')).toBe(false);
    expect(isValidCanadianPostalCode('ABCDEF')).toBe(false);
  });
});

describe('German Postal Code Validation', () => {
  test('accepts valid German postal codes', () => {
    expect(isValidGermanPostalCode('10115')).toBe(true);
    expect(isValidGermanPostalCode('80331')).toBe(true);
  });

  test('rejects invalid German postal codes', () => {
    expect(isValidGermanPostalCode('1234')).toBe(false);
    expect(isValidGermanPostalCode('123456')).toBe(false);
  });
});

// ============================================================================
// US STATE VALIDATION
// ============================================================================

describe('US State Validation', () => {
  test('accepts valid state codes', () => {
    expect(isValidUSState('CA')).toBe(true);
    expect(isValidUSState('NY')).toBe(true);
    expect(isValidUSState('TX')).toBe(true);
    expect(isValidUSState('DC')).toBe(true);
    expect(isValidUSState('PR')).toBe(true); // Puerto Rico
  });

  test('rejects invalid state codes', () => {
    expect(isValidUSState('XX')).toBe(false);
    expect(isValidUSState('California')).toBe(false);
    expect(isValidUSState('ca')).toBe(false); // Lowercase
  });

  test('US_STATES contains all states', () => {
    expect(US_STATES.length).toBe(56); // 50 states + DC + territories
  });
});

// ============================================================================
// ADDRESS VALIDATION
// ============================================================================

describe('Address Validation', () => {
  test('isValidAddress accepts valid address', () => {
    expect(isValidAddress({
      line1: '123 Main St',
      city: 'Anytown',
      postalCode: '12345',
      country: 'US',
    })).toBe(true);
  });

  test('isValidAddress rejects invalid address', () => {
    expect(isValidAddress({
      line1: '',
      city: 'Anytown',
      postalCode: '12345',
      country: 'US',
    })).toBe(false);

    expect(isValidAddress({
      line1: '123 Main St',
      city: 'Anytown',
      postalCode: '12345',
      country: 'USA', // Too long
    })).toBe(false);
  });

  test('isValidUSAddress accepts valid US address', () => {
    expect(isValidUSAddress({
      line1: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'US',
    })).toBe(true);
  });

  test('isValidUSAddress rejects invalid state', () => {
    expect(isValidUSAddress({
      line1: '123 Main St',
      city: 'San Francisco',
      state: 'XX',
      zipCode: '94105',
      country: 'US',
    })).toBe(false);
  });
});

// ============================================================================
// ADDRESS FORMATTING
// ============================================================================

describe('Address Formatting', () => {
  test('formatAddress formats correctly', () => {
    const address = {
      line1: '123 Main St',
      line2: 'Apt 4',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      country: 'US',
    };
    const formatted = formatAddress(address);
    expect(formatted).toContain('123 Main St');
    expect(formatted).toContain('Apt 4');
    expect(formatted).toContain('San Francisco, CA 94105');
    expect(formatted).toContain('US');
  });

  test('formatUSAddress formats correctly', () => {
    const address = {
      line1: '123 Main St',
      city: 'San Francisco',
      state: 'CA' as const,
      zipCode: '94105',
      country: 'US' as const,
    };
    const formatted = formatUSAddress(address);
    expect(formatted).toContain('123 Main St');
    expect(formatted).toContain('San Francisco, CA 94105');
  });
});

// ============================================================================
// GEO ENCODING VALIDATION
// ============================================================================

describe('Geo Encoding Validation', () => {
  test('isValidGeohash accepts valid geohashes', () => {
    expect(isValidGeohash('9q8yyk8y')).toBe(true);
    expect(isValidGeohash('u4pruydqqvj')).toBe(true);
    expect(isValidGeohash('sp')).toBe(true);
  });

  test('isValidGeohash rejects invalid geohashes', () => {
    expect(isValidGeohash('')).toBe(false);
    expect(isValidGeohash('a'.repeat(13))).toBe(false); // Too long
    expect(isValidGeohash('invalid!')).toBe(false);
  });

  test('isValidPlusCode accepts valid codes', () => {
    expect(isValidPlusCode('8FVC9G8F+6W')).toBe(true);
    expect(isValidPlusCode('849VCWC8+R9')).toBe(true);
  });

  test('isValidPlusCode rejects invalid codes', () => {
    expect(isValidPlusCode('')).toBe(false);
    expect(isValidPlusCode('invalid')).toBe(false);
  });

  test('isValidWhat3Words accepts valid addresses', () => {
    expect(isValidWhat3Words('filled.count.soap')).toBe(true);
    expect(isValidWhat3Words('index.home.raft')).toBe(true);
  });

  test('isValidWhat3Words rejects invalid addresses', () => {
    expect(isValidWhat3Words('')).toBe(false);
    expect(isValidWhat3Words('only.two')).toBe(false);
    expect(isValidWhat3Words('HAS.CAPS.here')).toBe(false);
  });
});
