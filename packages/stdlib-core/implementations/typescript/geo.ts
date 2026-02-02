// ============================================================================
// ISL Standard Library - TypeScript Geographic Implementation
// @stdlib/geo
// ============================================================================

// ============================================================================
// COORDINATE TYPES
// ============================================================================

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location {
  coordinates: Coordinates;
  address?: Address;
  name?: string;
  placeId?: string;
}

export interface BoundingBox {
  northEast: Coordinates;
  southWest: Coordinates;
}

export interface GeoCircle {
  center: Coordinates;
  radius: Distance;
}

export interface GeoPolygon {
  vertices: Coordinates[];
}

// ============================================================================
// ADDRESS TYPES
// ============================================================================

export interface Address {
  line1: string;
  line2?: string;
  line3?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface USAddress {
  line1: string;
  line2?: string;
  city: string;
  state: USState;
  zipCode: string;
  country: 'US';
}

export interface SimpleAddress {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface ShippingAddress {
  recipientName: string;
  company?: string;
  phone?: string;
  address: Address;
  instructions?: string;
  residential: boolean;
}

export interface BillingAddress {
  name: string;
  address: Address;
  vatNumber?: string;
}

// ============================================================================
// DISTANCE TYPE
// ============================================================================

export enum DistanceUnit {
  METERS = 'METERS',
  KILOMETERS = 'KILOMETERS',
  MILES = 'MILES',
  FEET = 'FEET',
  YARDS = 'YARDS',
  NAUTICAL_MILES = 'NAUTICAL_MILES',
}

export interface Distance {
  value: number;
  unit: DistanceUnit;
}

// ============================================================================
// US STATES
// ============================================================================

export type USState =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'FL' | 'GA'
  | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME' | 'MD'
  | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ'
  | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI' | 'SC'
  | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY'
  | 'DC' | 'PR' | 'VI' | 'GU' | 'AS' | 'MP';

export const US_STATES: readonly USState[] = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
] as const;

// ============================================================================
// POSTAL CODE PATTERNS
// ============================================================================

export const POSTAL_PATTERNS = {
  US_ZIP: /^\d{5}(-\d{4})?$/,
  UK_POSTCODE: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i,
  CANADIAN: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
  GERMAN: /^\d{5}$/,
} as const;

// ============================================================================
// COORDINATE VALIDATION
// ============================================================================

export function isValidLatitude(value: number): boolean {
  return value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return value >= -180 && value <= 180;
}

export function isValidCoordinates(coords: Coordinates): boolean {
  return isValidLatitude(coords.latitude) && isValidLongitude(coords.longitude);
}

export function createCoordinates(latitude: number, longitude: number): Coordinates {
  if (!isValidLatitude(latitude)) {
    throw new Error(`Invalid latitude: ${latitude}. Must be between -90 and 90.`);
  }
  if (!isValidLongitude(longitude)) {
    throw new Error(`Invalid longitude: ${longitude}. Must be between -180 and 180.`);
  }
  return { latitude, longitude };
}

// ============================================================================
// POSTAL CODE VALIDATION
// ============================================================================

export function isValidUSZipCode(value: string): boolean {
  return POSTAL_PATTERNS.US_ZIP.test(value);
}

export function isValidUKPostcode(value: string): boolean {
  return POSTAL_PATTERNS.UK_POSTCODE.test(value);
}

export function isValidCanadianPostalCode(value: string): boolean {
  return POSTAL_PATTERNS.CANADIAN.test(value);
}

export function isValidGermanPostalCode(value: string): boolean {
  return POSTAL_PATTERNS.GERMAN.test(value);
}

export function isValidUSState(value: string): value is USState {
  return US_STATES.includes(value as USState);
}

// ============================================================================
// DISTANCE CONVERSIONS
// ============================================================================

const METERS_PER_KILOMETER = 1000;
const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;
const METERS_PER_YARD = 0.9144;
const METERS_PER_NAUTICAL_MILE = 1852;

export function toMeters(distance: Distance): number {
  switch (distance.unit) {
    case DistanceUnit.METERS:
      return distance.value;
    case DistanceUnit.KILOMETERS:
      return distance.value * METERS_PER_KILOMETER;
    case DistanceUnit.MILES:
      return distance.value * METERS_PER_MILE;
    case DistanceUnit.FEET:
      return distance.value * METERS_PER_FOOT;
    case DistanceUnit.YARDS:
      return distance.value * METERS_PER_YARD;
    case DistanceUnit.NAUTICAL_MILES:
      return distance.value * METERS_PER_NAUTICAL_MILE;
    default:
      throw new Error(`Unknown distance unit: ${distance.unit}`);
  }
}

export function toKilometers(distance: Distance): number {
  return toMeters(distance) / METERS_PER_KILOMETER;
}

export function toMiles(distance: Distance): number {
  return toMeters(distance) / METERS_PER_MILE;
}

export function createDistance(value: number, unit: DistanceUnit): Distance {
  if (value < 0) {
    throw new Error('Distance value cannot be negative');
  }
  return { value, unit };
}

export function meters(value: number): Distance {
  return createDistance(value, DistanceUnit.METERS);
}

export function kilometers(value: number): Distance {
  return createDistance(value, DistanceUnit.KILOMETERS);
}

export function miles(value: number): Distance {
  return createDistance(value, DistanceUnit.MILES);
}

// ============================================================================
// HAVERSINE FORMULA
// ============================================================================

const EARTH_RADIUS_METERS = 6371000;

export function haversineDistance(a: Coordinates, b: Coordinates): Distance {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  const distance = EARTH_RADIUS_METERS * c;
  
  return { value: distance, unit: DistanceUnit.METERS };
}

export function isWithinRadius(point: Coordinates, center: Coordinates, radius: Distance): boolean {
  const distance = haversineDistance(point, center);
  return toMeters(distance) <= toMeters(radius);
}

// ============================================================================
// BOUNDING BOX
// ============================================================================

export function createBoundingBox(northEast: Coordinates, southWest: Coordinates): BoundingBox {
  if (northEast.latitude < southWest.latitude) {
    throw new Error('NorthEast latitude must be >= SouthWest latitude');
  }
  return { northEast, southWest };
}

export function isWithinBoundingBox(point: Coordinates, box: BoundingBox): boolean {
  return (
    point.latitude <= box.northEast.latitude &&
    point.latitude >= box.southWest.latitude &&
    point.longitude <= box.northEast.longitude &&
    point.longitude >= box.southWest.longitude
  );
}

export function getBoundingBoxCenter(box: BoundingBox): Coordinates {
  return {
    latitude: (box.northEast.latitude + box.southWest.latitude) / 2,
    longitude: (box.northEast.longitude + box.southWest.longitude) / 2,
  };
}

// ============================================================================
// ADDRESS VALIDATION
// ============================================================================

export function isValidAddress(address: Address): boolean {
  if (!address.line1 || address.line1.length > 100) return false;
  if (address.line2 && address.line2.length > 100) return false;
  if (!address.city || address.city.length > 100) return false;
  if (!address.postalCode || address.postalCode.length > 20) return false;
  if (!address.country || address.country.length !== 2) return false;
  return true;
}

export function isValidUSAddress(address: USAddress): boolean {
  if (!address.line1 || address.line1.length > 100) return false;
  if (!address.city || address.city.length > 100) return false;
  if (!isValidUSState(address.state)) return false;
  if (!isValidUSZipCode(address.zipCode)) return false;
  return address.country === 'US';
}

export function formatAddress(address: Address): string {
  const lines: string[] = [address.line1];
  if (address.line2) lines.push(address.line2);
  if (address.line3) lines.push(address.line3);
  
  const cityLine = address.state
    ? `${address.city}, ${address.state} ${address.postalCode}`
    : `${address.city} ${address.postalCode}`;
  lines.push(cityLine);
  lines.push(address.country);
  
  return lines.join('\n');
}

export function formatUSAddress(address: USAddress): string {
  const lines: string[] = [address.line1];
  if (address.line2) lines.push(address.line2);
  lines.push(`${address.city}, ${address.state} ${address.zipCode}`);
  return lines.join('\n');
}

// ============================================================================
// GEOHASH HELPERS
// ============================================================================

const GEOHASH_CHARS = '0123456789bcdefghjkmnpqrstuvwxyz';

export function isValidGeohash(value: string): boolean {
  if (value.length < 1 || value.length > 12) return false;
  return [...value.toLowerCase()].every(c => GEOHASH_CHARS.includes(c));
}

// ============================================================================
// PLUS CODE / WHAT3WORDS VALIDATION
// ============================================================================

const PLUS_CODE_PATTERN = /^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2,}$/;
const WHAT3WORDS_PATTERN = /^[a-z]+\.[a-z]+\.[a-z]+$/;

export function isValidPlusCode(value: string): boolean {
  return PLUS_CODE_PATTERN.test(value);
}

export function isValidWhat3Words(value: string): boolean {
  return WHAT3WORDS_PATTERN.test(value);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const Geo = {
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
  
  // Constants
  DistanceUnit,
  US_STATES,
  POSTAL_PATTERNS,
};

export default Geo;
