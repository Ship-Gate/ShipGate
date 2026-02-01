/**
 * Data Generator
 *
 * Generate realistic fake data for mock responses using Faker.
 */

import { faker } from '@faker-js/faker';

export interface DataGeneratorOptions {
  /** Seed for reproducible data */
  seed?: number;
  /** Locale for localized data */
  locale?: string;
}

export class DataGenerator {
  constructor(options: DataGeneratorOptions = {}) {
    if (options.seed !== undefined) {
      faker.seed(options.seed);
    }
  }

  // Primitives

  string(length: number = 10): string {
    return faker.string.alphanumeric(length);
  }

  word(): string {
    return faker.lorem.word();
  }

  words(count: number = 3): string {
    return faker.lorem.words(count);
  }

  sentence(): string {
    return faker.lorem.sentence();
  }

  paragraph(): string {
    return faker.lorem.paragraph();
  }

  integer(min: number = 0, max: number = 1000): number {
    return faker.number.int({ min, max });
  }

  float(min: number = 0, max: number = 1000): number {
    return faker.number.float({ min, max });
  }

  decimal(min: number = 0, max: number = 1000, precision: number = 2): number {
    return parseFloat(faker.number.float({ min, max }).toFixed(precision));
  }

  boolean(): boolean {
    return faker.datatype.boolean();
  }

  // Identifiers

  uuid(): string {
    return faker.string.uuid();
  }

  nanoid(length: number = 21): string {
    return faker.string.nanoid(length);
  }

  slug(): string {
    return faker.helpers.slugify(faker.lorem.words(3)).toLowerCase();
  }

  // Personal

  firstName(): string {
    return faker.person.firstName();
  }

  lastName(): string {
    return faker.person.lastName();
  }

  fullName(): string {
    return faker.person.fullName();
  }

  email(firstName?: string, lastName?: string): string {
    return faker.internet.email({ firstName, lastName });
  }

  username(): string {
    return faker.internet.userName();
  }

  password(length: number = 12): string {
    return faker.internet.password({ length });
  }

  phone(): string {
    return faker.phone.number();
  }

  avatar(): string {
    return faker.image.avatar();
  }

  gender(): string {
    return faker.person.gender();
  }

  birthDate(minAge: number = 18, maxAge: number = 80): Date {
    return faker.date.birthdate({ min: minAge, max: maxAge, mode: 'age' });
  }

  // Address

  address(): string {
    return faker.location.streetAddress();
  }

  city(): string {
    return faker.location.city();
  }

  state(): string {
    return faker.location.state();
  }

  country(): string {
    return faker.location.country();
  }

  countryCode(): string {
    return faker.location.countryCode();
  }

  zipCode(): string {
    return faker.location.zipCode();
  }

  latitude(): number {
    return faker.location.latitude();
  }

  longitude(): number {
    return faker.location.longitude();
  }

  coordinates(): { lat: number; lng: number } {
    return {
      lat: this.latitude(),
      lng: this.longitude(),
    };
  }

  // Internet

  url(): string {
    return faker.internet.url();
  }

  domainName(): string {
    return faker.internet.domainName();
  }

  ip(): string {
    return faker.internet.ip();
  }

  ipv6(): string {
    return faker.internet.ipv6();
  }

  mac(): string {
    return faker.internet.mac();
  }

  userAgent(): string {
    return faker.internet.userAgent();
  }

  httpMethod(): string {
    return faker.internet.httpMethod();
  }

  httpStatusCode(): number {
    return faker.internet.httpStatusCode();
  }

  // Images

  imageUrl(width: number = 640, height: number = 480): string {
    return faker.image.url({ width, height });
  }

  // Dates & Times

  date(from?: Date, to?: Date): string {
    const date = faker.date.between({
      from: from ?? new Date('2020-01-01'),
      to: to ?? new Date(),
    });
    return date.toISOString().split('T')[0];
  }

  timestamp(from?: Date, to?: Date): string {
    const date = faker.date.between({
      from: from ?? new Date('2020-01-01'),
      to: to ?? new Date(),
    });
    return date.toISOString();
  }

  future(years: number = 1): string {
    return faker.date.future({ years }).toISOString();
  }

  past(years: number = 1): string {
    return faker.date.past({ years }).toISOString();
  }

  duration(): string {
    const value = this.integer(1, 3600);
    const units = ['ms', 's', 'm', 'h'];
    const unit = units[this.integer(0, units.length - 1)];
    return `${value}${unit}`;
  }

  // Commerce

  company(): string {
    return faker.company.name();
  }

  productName(): string {
    return faker.commerce.productName();
  }

  productDescription(): string {
    return faker.commerce.productDescription();
  }

  price(min: number = 1, max: number = 1000): string {
    return faker.commerce.price({ min, max });
  }

  currency(): string {
    return faker.finance.currencyCode();
  }

  creditCardNumber(): string {
    return faker.finance.creditCardNumber();
  }

  creditCardCVV(): string {
    return faker.finance.creditCardCVV();
  }

  // Collections

  array<T>(generator: () => T, count: number = 5): T[] {
    return Array.from({ length: count }, generator);
  }

  arrayElement<T>(array: T[]): T {
    return faker.helpers.arrayElement(array);
  }

  enumValue(values: string[]): string {
    return faker.helpers.arrayElement(values);
  }

  shuffle<T>(array: T[]): T[] {
    return faker.helpers.shuffle([...array]);
  }

  unique<T>(generator: () => T, count: number): T[] {
    const items = new Set<T>();
    let attempts = 0;
    while (items.size < count && attempts < count * 10) {
      items.add(generator());
      attempts++;
    }
    return Array.from(items);
  }

  // Structured Data

  json(maxDepth: number = 2): Record<string, unknown> {
    const generate = (depth: number): unknown => {
      if (depth === 0) {
        const type = this.integer(0, 3);
        switch (type) {
          case 0: return this.word();
          case 1: return this.integer();
          case 2: return this.boolean();
          default: return null;
        }
      }

      const obj: Record<string, unknown> = {};
      const fieldCount = this.integer(2, 5);
      for (let i = 0; i < fieldCount; i++) {
        const key = this.word();
        obj[key] = generate(depth - 1);
      }
      return obj;
    };

    return generate(maxDepth) as Record<string, unknown>;
  }

  // Custom

  custom<T>(generator: () => T): T {
    return generator();
  }

  maybe<T>(generator: () => T, probability: number = 0.5): T | undefined {
    return faker.datatype.boolean({ probability }) ? generator() : undefined;
  }

  oneOf<T>(...generators: Array<() => T>): T {
    const generator = faker.helpers.arrayElement(generators);
    return generator();
  }

  weighted<T>(options: Array<{ weight: number; value: T }>): T {
    return faker.helpers.weightedArrayElement(
      options.map(o => ({ weight: o.weight, value: o.value }))
    );
  }

  // Templates

  template(pattern: string): string {
    return faker.helpers.fake(pattern);
  }

  // Status values

  userStatus(): string {
    return this.enumValue(['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED', 'DELETED']);
  }

  orderStatus(): string {
    return this.enumValue(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
  }

  paymentStatus(): string {
    return this.enumValue(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']);
  }

  // Reset seed

  setSeed(seed: number): void {
    faker.seed(seed);
  }
}
