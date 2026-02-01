# ============================================
# ISL Built-in Types and Functions
# ============================================
#
# These are available in every ISL domain without explicit import.

# ============================================
# PRIMITIVE TYPES
# ============================================

builtin type Boolean {
  values: true | false
  
  operators {
    and: (Boolean, Boolean) -> Boolean
    or: (Boolean, Boolean) -> Boolean
    not: (Boolean) -> Boolean
    xor: (Boolean, Boolean) -> Boolean
  }
}

builtin type Int {
  description: "Arbitrary precision integer"
  
  operators {
    +: (Int, Int) -> Int
    -: (Int, Int) -> Int
    *: (Int, Int) -> Int
    /: (Int, Int) -> Int
    %: (Int, Int) -> Int
    **: (Int, Int) -> Int  # Power
    
    ==: (Int, Int) -> Boolean
    !=: (Int, Int) -> Boolean
    <: (Int, Int) -> Boolean
    >: (Int, Int) -> Boolean
    <=: (Int, Int) -> Boolean
    >=: (Int, Int) -> Boolean
  }
  
  methods {
    abs(): Int
    sign(): Int  # -1, 0, or 1
    to_string(): String
    to_float(): Float
    
    min(other: Int): Int
    max(other: Int): Int
    clamp(min: Int, max: Int): Int
    
    in_range(min: Int, max: Int): Boolean
  }
  
  static {
    MIN: Int = platform_min_int
    MAX: Int = platform_max_int
    parse(s: String): Result<Int, ParseError>
  }
}

builtin type Float {
  description: "IEEE 754 double-precision floating point"
  
  methods {
    abs(): Float
    floor(): Int
    ceil(): Int
    round(): Int
    truncate(): Int
    
    sqrt(): Float
    log(): Float
    log10(): Float
    exp(): Float
    
    sin(): Float
    cos(): Float
    tan(): Float
    
    is_nan(): Boolean
    is_infinite(): Boolean
    is_finite(): Boolean
  }
  
  static {
    NAN: Float
    INFINITY: Float
    NEG_INFINITY: Float
    EPSILON: Float
    PI: Float = 3.14159265358979323846
    E: Float = 2.71828182845904523536
    
    parse(s: String): Result<Float, ParseError>
  }
}

builtin type String {
  description: "UTF-8 encoded string"
  
  properties {
    length: Int
    is_empty: Boolean = length == 0
    is_blank: Boolean = trim().is_empty
  }
  
  methods {
    # Case
    to_upper(): String
    to_lower(): String
    capitalize(): String
    title_case(): String
    
    # Trimming
    trim(): String
    trim_start(): String
    trim_end(): String
    
    # Searching
    contains(s: String): Boolean
    starts_with(s: String): Boolean
    ends_with(s: String): Boolean
    index_of(s: String): Int?
    last_index_of(s: String): Int?
    
    # Extraction
    substring(start: Int, end: Int?): String
    char_at(index: Int): String?
    slice(start: Int, end: Int?): String
    
    # Transformation
    replace(from: String, to: String): String
    replace_all(from: String, to: String): String
    replace_regex(pattern: Regex, replacement: String): String
    
    split(delimiter: String): List<String>
    split_regex(pattern: Regex): List<String>
    lines(): List<String>
    
    repeat(count: Int): String
    reverse(): String
    
    pad_start(length: Int, char: String = " "): String
    pad_end(length: Int, char: String = " "): String
    
    # Validation
    matches(pattern: Regex): Boolean
    is_numeric(): Boolean
    is_alphanumeric(): Boolean
    
    # Encoding
    to_bytes(): Bytes
    to_base64(): String
    from_base64(): Result<String, Error>
  }
  
  operators {
    +: (String, String) -> String  # Concatenation
    *: (String, Int) -> String     # Repeat
  }
  
  static {
    join(parts: List<String>, separator: String = ""): String
    format(template: String, args: Map<String, Any>): String
  }
}

# ============================================
# DATE/TIME TYPES
# ============================================

builtin type Timestamp {
  description: "Point in time with nanosecond precision"
  
  properties {
    unix_seconds: Int
    unix_millis: Int
    unix_nanos: Int
    
    year: Int
    month: Int
    day: Int
    hour: Int
    minute: Int
    second: Int
    millisecond: Int
    
    day_of_week: DayOfWeek
    day_of_year: Int
    week_of_year: Int
    
    timezone: String
  }
  
  methods {
    to_date(): Date
    to_time(): Time
    to_datetime(): DateTime
    
    format(pattern: String): String
    to_iso8601(): String
    to_rfc3339(): String
    
    in_timezone(tz: String): Timestamp
    to_utc(): Timestamp
    
    add(duration: Duration): Timestamp
    subtract(duration: Duration): Timestamp
    
    diff(other: Timestamp): Duration
    
    is_before(other: Timestamp): Boolean
    is_after(other: Timestamp): Boolean
    is_between(start: Timestamp, end: Timestamp): Boolean
    
    start_of_day(): Timestamp
    end_of_day(): Timestamp
    start_of_month(): Timestamp
    end_of_month(): Timestamp
  }
  
  static {
    now(): Timestamp
    parse(s: String, format: String?): Result<Timestamp, ParseError>
    from_unix(seconds: Int): Timestamp
    from_unix_millis(millis: Int): Timestamp
  }
}

builtin type Duration {
  description: "Time span"
  
  constructors {
    nanoseconds(n: Int): Duration
    microseconds(n: Int): Duration
    milliseconds(n: Int): Duration
    seconds(n: Int): Duration
    minutes(n: Int): Duration
    hours(n: Int): Duration
    days(n: Int): Duration
    weeks(n: Int): Duration
  }
  
  # Shorthand syntax
  syntax {
    100.nanoseconds
    50.microseconds
    500.milliseconds
    30.seconds
    5.minutes
    2.hours
    1.day
    2.weeks
  }
  
  properties {
    total_nanoseconds: Int
    total_milliseconds: Int
    total_seconds: Int
    total_minutes: Float
    total_hours: Float
    total_days: Float
  }
  
  methods {
    abs(): Duration
    is_zero(): Boolean
    is_negative(): Boolean
    
    humanize(): String  # "5 minutes ago"
  }
  
  operators {
    +: (Duration, Duration) -> Duration
    -: (Duration, Duration) -> Duration
    *: (Duration, Int) -> Duration
    /: (Duration, Int) -> Duration
  }
}

# ============================================
# COLLECTION TYPES
# ============================================

builtin type List<T> {
  description: "Ordered, indexed sequence"
  
  properties {
    length: Int
    is_empty: Boolean = length == 0
    first: T?
    last: T?
  }
  
  methods {
    # Access
    get(index: Int): T?
    at(index: Int): T  # Throws if out of bounds
    
    # Search
    contains(item: T): Boolean
    index_of(item: T): Int?
    find(predicate: (T) -> Boolean): T?
    find_index(predicate: (T) -> Boolean): Int?
    
    # Transformation
    map<U>(f: (T) -> U): List<U>
    flat_map<U>(f: (T) -> List<U>): List<U>
    filter(predicate: (T) -> Boolean): List<T>
    reject(predicate: (T) -> Boolean): List<T>
    
    # Reduction
    reduce<U>(initial: U, f: (U, T) -> U): U
    fold<U>(initial: U, f: (U, T) -> U): U
    
    # Aggregation
    sum(): T where T: Numeric
    product(): T where T: Numeric
    min(): T? where T: Comparable
    max(): T? where T: Comparable
    average(): Float where T: Numeric
    
    # Ordering
    sort(): List<T> where T: Comparable
    sort_by<K>(key: (T) -> K): List<T> where K: Comparable
    reverse(): List<T>
    shuffle(): List<T>
    
    # Slicing
    take(n: Int): List<T>
    drop(n: Int): List<T>
    slice(start: Int, end: Int?): List<T>
    
    # Grouping
    group_by<K>(key: (T) -> K): Map<K, List<T>>
    partition(predicate: (T) -> Boolean): Tuple<List<T>, List<T>>
    chunk(size: Int): List<List<T>>
    
    # Set operations
    distinct(): List<T>
    union(other: List<T>): List<T>
    intersect(other: List<T>): List<T>
    difference(other: List<T>): List<T>
    
    # Predicates
    all(predicate: (T) -> Boolean): Boolean
    any(predicate: (T) -> Boolean): Boolean
    none(predicate: (T) -> Boolean): Boolean
    
    # Mutation (returns new list)
    append(item: T): List<T>
    prepend(item: T): List<T>
    concat(other: List<T>): List<T>
    insert(index: Int, item: T): List<T>
    remove(index: Int): List<T>
    remove_all(predicate: (T) -> Boolean): List<T>
    
    # Conversion
    to_set(): Set<T>
    to_map<K, V>(key: (T) -> K, value: (T) -> V): Map<K, V>
  }
  
  static {
    empty<T>(): List<T>
    of<T>(...items: T): List<T>
    repeat<T>(item: T, count: Int): List<T>
    range(start: Int, end: Int, step: Int = 1): List<Int>
  }
}

builtin type Map<K, V> {
  description: "Key-value mapping"
  
  properties {
    size: Int
    is_empty: Boolean = size == 0
    keys: List<K>
    values: List<V>
    entries: List<Tuple<K, V>>
  }
  
  methods {
    get(key: K): V?
    get_or(key: K, default: V): V
    
    contains_key(key: K): Boolean
    contains_value(value: V): Boolean
    
    set(key: K, value: V): Map<K, V>
    remove(key: K): Map<K, V>
    
    map_values<U>(f: (V) -> U): Map<K, U>
    map_keys<K2>(f: (K) -> K2): Map<K2, V>
    filter(predicate: (K, V) -> Boolean): Map<K, V>
    
    merge(other: Map<K, V>): Map<K, V>
    merge_with(other: Map<K, V>, f: (V, V) -> V): Map<K, V>
  }
  
  static {
    empty<K, V>(): Map<K, V>
    of<K, V>(...entries: Tuple<K, V>): Map<K, V>
    from_list<T, K, V>(list: List<T>, key: (T) -> K, value: (T) -> V): Map<K, V>
  }
}

builtin type Set<T> {
  description: "Unordered collection of unique elements"
  
  properties {
    size: Int
    is_empty: Boolean = size == 0
  }
  
  methods {
    contains(item: T): Boolean
    
    add(item: T): Set<T>
    remove(item: T): Set<T>
    
    union(other: Set<T>): Set<T>
    intersect(other: Set<T>): Set<T>
    difference(other: Set<T>): Set<T>
    symmetric_difference(other: Set<T>): Set<T>
    
    is_subset_of(other: Set<T>): Boolean
    is_superset_of(other: Set<T>): Boolean
    is_disjoint_from(other: Set<T>): Boolean
    
    to_list(): List<T>
  }
}

# ============================================
# RESULT TYPE
# ============================================

builtin type Result<T, E> {
  description: "Success or error"
  
  constructors {
    success(value: T): Result<T, E>
    error(error: E): Result<T, E>
  }
  
  properties {
    is_success: Boolean
    is_error: Boolean
  }
  
  methods {
    unwrap(): T  # Throws if error
    unwrap_or(default: T): T
    unwrap_or_else(f: () -> T): T
    
    expect(message: String): T  # Throws with message if error
    
    map<U>(f: (T) -> U): Result<U, E>
    map_error<E2>(f: (E) -> E2): Result<T, E2>
    
    and_then<U>(f: (T) -> Result<U, E>): Result<U, E>
    or_else<E2>(f: (E) -> Result<T, E2>): Result<T, E2>
    
    ok(): T?
    err(): E?
  }
  
  pattern_matching {
    success(value) => # handle success
    error(err) => # handle error
  }
}

# ============================================
# OPTIONAL TYPE
# ============================================

builtin type Optional<T> {
  description: "Value that may be absent"
  alias: T?
  
  constructors {
    some(value: T): Optional<T>
    none(): Optional<T>
  }
  
  properties {
    is_some: Boolean
    is_none: Boolean
  }
  
  methods {
    unwrap(): T
    unwrap_or(default: T): T
    unwrap_or_else(f: () -> T): T
    
    map<U>(f: (T) -> U): Optional<U>
    flat_map<U>(f: (T) -> Optional<U>): Optional<U>
    filter(predicate: (T) -> Boolean): Optional<T>
    
    or_else(f: () -> Optional<T>): Optional<T>
  }
  
  operators {
    ??: (Optional<T>, T) -> T  # Null coalesce
    ?.: access optional properties
  }
}

# ============================================
# VALIDATION HELPERS
# ============================================

builtin validations {
  # Email
  is_email(s: String): Boolean
  
  # URL
  is_url(s: String): Boolean
  is_https_url(s: String): Boolean
  
  # UUID
  is_uuid(s: String): Boolean
  
  # Phone
  is_phone(s: String): Boolean
  is_e164_phone(s: String): Boolean
  
  # Credit Card
  is_credit_card(s: String): Boolean
  luhn_check(s: String): Boolean
  
  # IP Address
  is_ipv4(s: String): Boolean
  is_ipv6(s: String): Boolean
  is_ip(s: String): Boolean
  
  # Regex
  matches(s: String, pattern: Regex): Boolean
  
  # JSON
  is_json(s: String): Boolean
  
  # Base64
  is_base64(s: String): Boolean
}

# ============================================
# ASSERTION HELPERS
# ============================================

builtin assertions {
  # Existence
  exists<T>(value: T?): Boolean
  
  # Equality
  equals<T>(a: T, b: T): Boolean
  deep_equals<T>(a: T, b: T): Boolean
  
  # Collections
  is_empty<T>(collection: List<T> | Set<T> | Map<?, ?>): Boolean
  has_length<T>(collection: List<T>, length: Int): Boolean
  contains<T>(collection: List<T>, item: T): Boolean
  contains_all<T>(collection: List<T>, items: List<T>): Boolean
  
  # Comparisons
  is_positive(n: Int | Float): Boolean
  is_negative(n: Int | Float): Boolean
  is_zero(n: Int | Float): Boolean
  is_between(n: Int | Float, min: Int | Float, max: Int | Float): Boolean
  
  # Temporal
  is_past(t: Timestamp): Boolean
  is_future(t: Timestamp): Boolean
  is_today(t: Timestamp): Boolean
}
