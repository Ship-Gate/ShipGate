import { greet } from './greeter';

describe('greet', () => {
  it('should greet a valid name', () => {
    expect(greet('Alice')).toBe('Hello, Alice!');
  });

  it('should throw EMPTY_NAME for empty string', () => {
    expect(() => greet('')).toThrow('EMPTY_NAME');
  });

  it('should throw EMPTY_NAME for whitespace', () => {
    expect(() => greet('   ')).toThrow('EMPTY_NAME');
  });
});
