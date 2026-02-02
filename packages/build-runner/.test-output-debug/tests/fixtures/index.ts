// Test fixtures for Minimal

export const itemFixture: Item = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'test-value'
};

export function createItem(overrides?: Partial<Item>): Item {
  return { ...itemFixture, ...overrides };
}