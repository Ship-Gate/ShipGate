# Collections Standard Library Module
# Provides List and Map operations
#
# DETERMINISM NOTE:
# All functions in this module are DETERMINISTIC
# Sort operations use stable sorting algorithm

module Collections version "1.0.0"

# ============================================
# Types
# ============================================

type SortOrder = enum {
  ASC       # Ascending order
  DESC      # Descending order
}

type CompareResult = Int {
  min: -1
  max: 1
  description: "-1 for less, 0 for equal, 1 for greater"
}

# ============================================
# Entities
# ============================================

entity KeyValuePair<K, V> {
  key: K
  value: V
}

entity IndexedValue<T> {
  index: Int { min: 0 }
  value: T
}

entity GroupedResult<K, V> {
  key: K
  values: List<V>
  
  invariants {
    values.length >= 1
  }
}

# ============================================
# Behaviors - List Basic Operations
# ============================================

behavior Length {
  description: "Get length of list (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
  }

  output {
    success: Int { min: 0 }
  }

  post success {
    result >= 0
  }
}

behavior IsEmpty {
  description: "Check if list is empty (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
  }

  output {
    success: Boolean
  }

  post success {
    result == (input.list.length == 0)
  }
}

behavior First {
  description: "Get first element of list (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
  }

  output {
    success: Any?
  }

  post success {
    input.list.length == 0 implies result == null
    input.list.length > 0 implies result == input.list[0]
  }
}

behavior Last {
  description: "Get last element of list (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
  }

  output {
    success: Any?
  }

  post success {
    input.list.length == 0 implies result == null
    input.list.length > 0 implies result == input.list[input.list.length - 1]
  }
}

behavior Get {
  description: "Get element at index (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    index: Int
  }

  output {
    success: Any?

    errors {
      INDEX_OUT_OF_BOUNDS {
        when: "Index is outside list bounds"
        retriable: false
      }
    }
  }

  pre {
    index >= 0
    index < list.length
  }

  post success {
    result == input.list[input.index]
  }
}

# ============================================
# Behaviors - List Transformation
# ============================================

behavior Map {
  description: "Transform each element (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    transform: Function<Any, Any>
  }

  output {
    success: List<Any>
  }

  post success {
    result.length == input.list.length
  }
}

behavior Filter {
  description: "Filter elements by predicate (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    predicate: Function<Any, Boolean>
  }

  output {
    success: List<Any>
  }

  post success {
    result.length <= input.list.length
  }
}

behavior Reduce {
  description: "Reduce list to single value (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    reducer: Function<(Any, Any), Any>
    initial: Any
  }

  output {
    success: Any
  }
}

behavior FlatMap {
  description: "Map and flatten result (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    transform: Function<Any, List<Any>>
  }

  output {
    success: List<Any>
  }
}

# ============================================
# Behaviors - List Search
# ============================================

behavior Find {
  description: "Find first element matching predicate (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    predicate: Function<Any, Boolean>
  }

  output {
    success: Any?
  }
}

behavior FindIndex {
  description: "Find index of first matching element (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    predicate: Function<Any, Boolean>
  }

  output {
    success: Int  # -1 if not found
  }

  post success {
    result >= -1
    result < input.list.length
  }
}

behavior FindLast {
  description: "Find last element matching predicate (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    predicate: Function<Any, Boolean>
  }

  output {
    success: Any?
  }
}

behavior FindLastIndex {
  description: "Find index of last matching element (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    predicate: Function<Any, Boolean>
  }

  output {
    success: Int  # -1 if not found
  }

  post success {
    result >= -1
    result < input.list.length
  }
}

behavior IndexOf {
  description: "Find index of value (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    value: Any
    start_index: Int [default: 0]
  }

  output {
    success: Int  # -1 if not found
  }

  pre {
    start_index >= 0
  }

  post success {
    result >= -1
    result < input.list.length
  }
}

behavior Includes {
  description: "Check if list includes value (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    value: Any
  }

  output {
    success: Boolean
  }

  post success {
    result == (IndexOf(input.list, input.value) >= 0)
  }
}

# ============================================
# Behaviors - List Testing
# ============================================

behavior Every {
  description: "Check if all elements match predicate (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    predicate: Function<Any, Boolean>
  }

  output {
    success: Boolean
  }

  post success {
    input.list.length == 0 implies result == true
  }
}

behavior Some {
  description: "Check if any element matches predicate (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    predicate: Function<Any, Boolean>
  }

  output {
    success: Boolean
  }

  post success {
    input.list.length == 0 implies result == false
  }
}

behavior None {
  description: "Check if no elements match predicate (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    predicate: Function<Any, Boolean>
  }

  output {
    success: Boolean
  }

  post success {
    result == not Some(input.list, input.predicate)
  }
}

# ============================================
# Behaviors - List Slicing
# ============================================

behavior Take {
  description: "Take first n elements (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    count: Int { min: 0 }
  }

  output {
    success: List<Any>
  }

  post success {
    result.length == min(input.count, input.list.length)
  }
}

behavior TakeWhile {
  description: "Take elements while predicate is true (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    predicate: Function<Any, Boolean>
  }

  output {
    success: List<Any>
  }

  post success {
    result.length <= input.list.length
  }
}

behavior Drop {
  description: "Drop first n elements (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    count: Int { min: 0 }
  }

  output {
    success: List<Any>
  }

  post success {
    result.length == max(0, input.list.length - input.count)
  }
}

behavior DropWhile {
  description: "Drop elements while predicate is true (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    predicate: Function<Any, Boolean>
  }

  output {
    success: List<Any>
  }

  post success {
    result.length <= input.list.length
  }
}

behavior Slice {
  description: "Get slice of list (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    start: Int { min: 0 }
    end: Int?
  }

  output {
    success: List<Any>
  }

  pre {
    start >= 0
  }

  post success {
    result.length <= input.list.length
  }
}

# ============================================
# Behaviors - List Combination
# ============================================

behavior Concat {
  description: "Concatenate two lists (DETERMINISTIC)"
  deterministic: true

  input {
    first: List<Any>
    second: List<Any>
  }

  output {
    success: List<Any>
  }

  post success {
    result.length == input.first.length + input.second.length
  }
}

behavior Flatten {
  description: "Flatten nested list (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<List<Any>>
    depth: Int [default: 1]
  }

  output {
    success: List<Any>
  }

  pre {
    depth >= 1
  }
}

behavior Zip {
  description: "Zip two lists into pairs (DETERMINISTIC)"
  deterministic: true

  input {
    first: List<Any>
    second: List<Any>
  }

  output {
    success: List<{ first: Any, second: Any }>
  }

  post success {
    result.length == min(input.first.length, input.second.length)
  }
}

behavior Unzip {
  description: "Unzip list of pairs into two lists (DETERMINISTIC)"
  deterministic: true

  input {
    pairs: List<{ first: Any, second: Any }>
  }

  output {
    success: { first: List<Any>, second: List<Any> }
  }

  post success {
    result.first.length == input.pairs.length
    result.second.length == input.pairs.length
  }
}

# ============================================
# Behaviors - List Modification
# ============================================

behavior Reverse {
  description: "Reverse list order (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
  }

  output {
    success: List<Any>
  }

  post success {
    result.length == input.list.length
  }
}

behavior Sort {
  description: "Sort list (stable sort) (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    order: SortOrder [default: ASC]
  }

  output {
    success: List<Any>
  }

  post success {
    result.length == input.list.length
  }
}

behavior SortBy {
  description: "Sort list by key function (stable sort) (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    key_fn: Function<Any, Any>
    order: SortOrder [default: ASC]
  }

  output {
    success: List<Any>
  }

  post success {
    result.length == input.list.length
  }
}

behavior SortWith {
  description: "Sort list with custom comparator (stable sort) (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    compare: Function<(Any, Any), CompareResult>
  }

  output {
    success: List<Any>
  }

  post success {
    result.length == input.list.length
  }
}

behavior Unique {
  description: "Remove duplicate values (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
  }

  output {
    success: List<Any>
  }

  post success {
    result.length <= input.list.length
  }
}

behavior UniqueBy {
  description: "Remove duplicates by key function (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    key_fn: Function<Any, Any>
  }

  output {
    success: List<Any>
  }

  post success {
    result.length <= input.list.length
  }
}

# ============================================
# Behaviors - List Grouping
# ============================================

behavior Chunk {
  description: "Split list into chunks of size n (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    size: Int { min: 1 }
  }

  output {
    success: List<List<Any>>
  }

  post success {
    input.list.length == 0 implies result.length == 0
    input.list.length > 0 implies result.length == ceil(input.list.length / input.size)
  }
}

behavior GroupBy {
  description: "Group elements by key function (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    key_fn: Function<Any, Any>
  }

  output {
    success: List<GroupedResult<Any, Any>>
  }
}

behavior Partition {
  description: "Split into two lists by predicate (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    predicate: Function<Any, Boolean>
  }

  output {
    success: { matching: List<Any>, not_matching: List<Any> }
  }

  post success {
    result.matching.length + result.not_matching.length == input.list.length
  }
}

# ============================================
# Behaviors - Map Operations
# ============================================

behavior MapGet {
  description: "Get value from map by key (DETERMINISTIC)"
  deterministic: true

  input {
    map: Map<Any, Any>
    key: Any
    default_value: Any?
  }

  output {
    success: Any?
  }
}

behavior MapSet {
  description: "Set value in map (DETERMINISTIC)"
  deterministic: true

  input {
    map: Map<Any, Any>
    key: Any
    value: Any
  }

  output {
    success: Map<Any, Any>
  }
}

behavior MapRemove {
  description: "Remove key from map (DETERMINISTIC)"
  deterministic: true

  input {
    map: Map<Any, Any>
    key: Any
  }

  output {
    success: Map<Any, Any>
  }
}

behavior MapHas {
  description: "Check if map has key (DETERMINISTIC)"
  deterministic: true

  input {
    map: Map<Any, Any>
    key: Any
  }

  output {
    success: Boolean
  }
}

behavior MapKeys {
  description: "Get all keys from map (DETERMINISTIC)"
  deterministic: true

  input {
    map: Map<Any, Any>
  }

  output {
    success: List<Any>
  }
}

behavior MapValues {
  description: "Get all values from map (DETERMINISTIC)"
  deterministic: true

  input {
    map: Map<Any, Any>
  }

  output {
    success: List<Any>
  }
}

behavior MapEntries {
  description: "Get all entries from map (DETERMINISTIC)"
  deterministic: true

  input {
    map: Map<Any, Any>
  }

  output {
    success: List<KeyValuePair<Any, Any>>
  }
}

behavior MapSize {
  description: "Get number of entries in map (DETERMINISTIC)"
  deterministic: true

  input {
    map: Map<Any, Any>
  }

  output {
    success: Int { min: 0 }
  }
}

behavior MapMerge {
  description: "Merge two maps (DETERMINISTIC)"
  deterministic: true

  input {
    first: Map<Any, Any>
    second: Map<Any, Any>
  }

  output {
    success: Map<Any, Any>
  }

  post success {
    # Second map values override first
  }
}

behavior MapPick {
  description: "Create map with only specified keys (DETERMINISTIC)"
  deterministic: true

  input {
    map: Map<Any, Any>
    keys: List<Any>
  }

  output {
    success: Map<Any, Any>
  }
}

behavior MapOmit {
  description: "Create map without specified keys (DETERMINISTIC)"
  deterministic: true

  input {
    map: Map<Any, Any>
    keys: List<Any>
  }

  output {
    success: Map<Any, Any>
  }
}

behavior MapMapValues {
  description: "Transform all values in map (DETERMINISTIC)"
  deterministic: true

  input {
    map: Map<Any, Any>
    transform: Function<Any, Any>
  }

  output {
    success: Map<Any, Any>
  }
}

behavior MapFilterValues {
  description: "Filter map entries by value predicate (DETERMINISTIC)"
  deterministic: true

  input {
    map: Map<Any, Any>
    predicate: Function<Any, Boolean>
  }

  output {
    success: Map<Any, Any>
  }
}

behavior FromEntries {
  description: "Create map from entries (DETERMINISTIC)"
  deterministic: true

  input {
    entries: List<KeyValuePair<Any, Any>>
  }

  output {
    success: Map<Any, Any>
  }
}

# ============================================
# Behaviors - Set Operations
# ============================================

behavior Union {
  description: "Union of two lists (DETERMINISTIC)"
  deterministic: true

  input {
    first: List<Any>
    second: List<Any>
  }

  output {
    success: List<Any>
  }

  post success {
    forall v in input.first: Includes(result, v)
    forall v in input.second: Includes(result, v)
  }
}

behavior Intersection {
  description: "Intersection of two lists (DETERMINISTIC)"
  deterministic: true

  input {
    first: List<Any>
    second: List<Any>
  }

  output {
    success: List<Any>
  }

  post success {
    forall v in result: Includes(input.first, v) and Includes(input.second, v)
  }
}

behavior Difference {
  description: "Difference of two lists (first - second) (DETERMINISTIC)"
  deterministic: true

  input {
    first: List<Any>
    second: List<Any>
  }

  output {
    success: List<Any>
  }

  post success {
    forall v in result: Includes(input.first, v) and not Includes(input.second, v)
  }
}

behavior SymmetricDifference {
  description: "Symmetric difference of two lists (DETERMINISTIC)"
  deterministic: true

  input {
    first: List<Any>
    second: List<Any>
  }

  output {
    success: List<Any>
  }
}

# ============================================
# Behaviors - Utility
# ============================================

behavior Range {
  description: "Create list of numbers in range (DETERMINISTIC)"
  deterministic: true

  input {
    start: Int
    end: Int
    step: Int [default: 1]
  }

  output {
    success: List<Int>

    errors {
      INVALID_STEP {
        when: "Step is zero"
        retriable: false
      }
    }
  }

  pre {
    step != 0
  }
}

behavior Repeat {
  description: "Create list with repeated value (DETERMINISTIC)"
  deterministic: true

  input {
    value: Any
    count: Int { min: 0 }
  }

  output {
    success: List<Any>
  }

  post success {
    result.length == input.count
    forall v in result: v == input.value
  }
}

behavior WithIndex {
  description: "Add index to each element (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
  }

  output {
    success: List<IndexedValue<Any>>
  }

  post success {
    result.length == input.list.length
  }
}

behavior Count {
  description: "Count elements matching predicate (DETERMINISTIC)"
  deterministic: true

  input {
    list: List<Any>
    predicate: Function<Any, Boolean>
  }

  output {
    success: Int { min: 0 }
  }

  post success {
    result >= 0
    result <= input.list.length
  }
}

# ============================================
# Constants
# ============================================

const EMPTY_LIST: List<Any> = []
const EMPTY_MAP: Map<Any, Any> = {}
