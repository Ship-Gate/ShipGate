import { describe, test, expect } from 'vitest';
import * as Collections from '../src/collections';

describe('Collections Module', () => {
  describe('List Basic Operations', () => {
    test('length returns list length', () => {
      expect(Collections.length([1, 2, 3])).toBe(3);
      expect(Collections.length([])).toBe(0);
    });

    test('isEmpty checks empty list', () => {
      expect(Collections.isEmpty([])).toBe(true);
      expect(Collections.isEmpty([1])).toBe(false);
    });

    test('first returns first element', () => {
      expect(Collections.first([1, 2, 3])).toBe(1);
      expect(Collections.first([])).toBe(null);
    });

    test('last returns last element', () => {
      expect(Collections.last([1, 2, 3])).toBe(3);
      expect(Collections.last([])).toBe(null);
    });

    test('get returns element at index', () => {
      expect(Collections.get([1, 2, 3], 1)).toBe(2);
      expect(() => Collections.get([1, 2, 3], 5)).toThrow('INDEX_OUT_OF_BOUNDS');
    });
  });

  describe('List Transformation', () => {
    test('map transforms elements', () => {
      expect(Collections.map([1, 2, 3], x => x * 2)).toEqual([2, 4, 6]);
    });

    test('filter filters elements', () => {
      expect(Collections.filter([1, 2, 3, 4], x => x % 2 === 0)).toEqual([2, 4]);
    });

    test('reduce reduces to single value', () => {
      expect(Collections.reduce([1, 2, 3, 4], (acc, x) => acc + x, 0)).toBe(10);
    });

    test('flatMap maps and flattens', () => {
      expect(Collections.flatMap([1, 2], x => [x, x * 2])).toEqual([1, 2, 2, 4]);
    });
  });

  describe('List Search', () => {
    test('find returns first matching element', () => {
      expect(Collections.find([1, 2, 3], x => x > 1)).toBe(2);
      expect(Collections.find([1, 2, 3], x => x > 5)).toBe(null);
    });

    test('findIndex returns index of first match', () => {
      expect(Collections.findIndex([1, 2, 3], x => x > 1)).toBe(1);
      expect(Collections.findIndex([1, 2, 3], x => x > 5)).toBe(-1);
    });

    test('indexOf finds value index', () => {
      expect(Collections.indexOf([1, 2, 3, 2], 2)).toBe(1);
      expect(Collections.indexOf([1, 2, 3], 5)).toBe(-1);
    });

    test('includes checks value existence', () => {
      expect(Collections.includes([1, 2, 3], 2)).toBe(true);
      expect(Collections.includes([1, 2, 3], 5)).toBe(false);
    });
  });

  describe('List Testing', () => {
    test('every checks all match predicate', () => {
      expect(Collections.every([2, 4, 6], x => x % 2 === 0)).toBe(true);
      expect(Collections.every([2, 4, 5], x => x % 2 === 0)).toBe(false);
    });

    test('some checks any match predicate', () => {
      expect(Collections.some([1, 2, 3], x => x > 2)).toBe(true);
      expect(Collections.some([1, 2, 3], x => x > 5)).toBe(false);
    });

    test('none checks no match predicate', () => {
      expect(Collections.none([1, 2, 3], x => x > 5)).toBe(true);
      expect(Collections.none([1, 2, 3], x => x > 2)).toBe(false);
    });
  });

  describe('List Slicing', () => {
    test('take returns first n elements', () => {
      expect(Collections.take([1, 2, 3, 4, 5], 3)).toEqual([1, 2, 3]);
      expect(Collections.take([1, 2], 5)).toEqual([1, 2]);
    });

    test('drop removes first n elements', () => {
      expect(Collections.drop([1, 2, 3, 4, 5], 2)).toEqual([3, 4, 5]);
    });

    test('slice extracts portion', () => {
      expect(Collections.slice([1, 2, 3, 4, 5], 1, 4)).toEqual([2, 3, 4]);
    });
  });

  describe('List Combination', () => {
    test('concat joins lists', () => {
      expect(Collections.concat([1, 2], [3, 4])).toEqual([1, 2, 3, 4]);
    });

    test('flatten flattens nested lists', () => {
      expect(Collections.flatten([[1, 2], [3, 4]])).toEqual([1, 2, 3, 4]);
    });

    test('zip combines two lists', () => {
      expect(Collections.zip([1, 2], ['a', 'b'])).toEqual([
        { first: 1, second: 'a' },
        { first: 2, second: 'b' },
      ]);
    });
  });

  describe('List Modification', () => {
    test('reverse reverses list', () => {
      expect(Collections.reverse([1, 2, 3])).toEqual([3, 2, 1]);
    });

    test('sort sorts list (stable)', () => {
      expect(Collections.sort([3, 1, 2])).toEqual([1, 2, 3]);
      expect(Collections.sort([3, 1, 2], 'DESC')).toEqual([3, 2, 1]);
    });

    test('sortBy sorts by key function', () => {
      const items = [{ name: 'b' }, { name: 'a' }, { name: 'c' }];
      expect(Collections.sortBy(items, x => x.name)).toEqual([
        { name: 'a' },
        { name: 'b' },
        { name: 'c' },
      ]);
    });

    test('unique removes duplicates', () => {
      expect(Collections.unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
    });
  });

  describe('List Grouping', () => {
    test('chunk splits into chunks', () => {
      expect(Collections.chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    test('groupBy groups by key', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ];
      const grouped = Collections.groupBy(items, x => x.type);
      expect(grouped).toHaveLength(2);
      expect(grouped.find(g => g.key === 'a')?.values).toHaveLength(2);
    });

    test('partition splits by predicate', () => {
      const { matching, not_matching } = Collections.partition([1, 2, 3, 4, 5], x => x % 2 === 0);
      expect(matching).toEqual([2, 4]);
      expect(not_matching).toEqual([1, 3, 5]);
    });
  });

  describe('Map Operations', () => {
    test('mapGet retrieves value', () => {
      const map = new Map([['a', 1], ['b', 2]]);
      expect(Collections.mapGet(map, 'a')).toBe(1);
      expect(Collections.mapGet(map, 'c', 0)).toBe(0);
    });

    test('mapSet adds/updates value', () => {
      const map = new Map([['a', 1]]);
      const newMap = Collections.mapSet(map, 'b', 2);
      expect(Collections.mapGet(newMap, 'b')).toBe(2);
    });

    test('mapKeys returns keys', () => {
      const map = new Map([['a', 1], ['b', 2]]);
      expect(Collections.mapKeys(map)).toEqual(['a', 'b']);
    });

    test('mapValues returns values', () => {
      const map = new Map([['a', 1], ['b', 2]]);
      expect(Collections.mapValues(map)).toEqual([1, 2]);
    });

    test('mapMerge merges maps', () => {
      const a = new Map([['a', 1]]);
      const b = new Map([['b', 2]]);
      const merged = Collections.mapMerge(a, b);
      expect(Collections.mapSize(merged)).toBe(2);
    });
  });

  describe('Set Operations', () => {
    test('union combines lists', () => {
      expect(Collections.union([1, 2], [2, 3])).toEqual([1, 2, 3]);
    });

    test('intersection finds common elements', () => {
      expect(Collections.intersection([1, 2, 3], [2, 3, 4])).toEqual([2, 3]);
    });

    test('difference finds elements only in first', () => {
      expect(Collections.difference([1, 2, 3], [2, 3, 4])).toEqual([1]);
    });
  });

  describe('Utility', () => {
    test('range creates number sequence', () => {
      expect(Collections.range(1, 5)).toEqual([1, 2, 3, 4]);
      expect(Collections.range(0, 10, 2)).toEqual([0, 2, 4, 6, 8]);
    });

    test('repeat creates list with repeated value', () => {
      expect(Collections.repeat('a', 3)).toEqual(['a', 'a', 'a']);
    });

    test('withIndex adds index to elements', () => {
      expect(Collections.withIndex(['a', 'b'])).toEqual([
        { index: 0, value: 'a' },
        { index: 1, value: 'b' },
      ]);
    });

    test('count counts matching elements', () => {
      expect(Collections.count([1, 2, 3, 4, 5], x => x % 2 === 0)).toBe(2);
    });
  });
});
