// Edge case: Special values and boundary conditions

domain SpecialValues {
  version: "1.0.0"
  
  // Boundary number values
  type MaxInt = Int { max: 2147483647 }
  type MinInt = Int { min: -2147483648 }
  type ZeroInt = Int { min: 0, max: 0 }
  
  type LargeDecimal = Decimal {
    precision: 18
    max: 999999999999999999
  }
  
  type SmallDecimal = Decimal {
    precision: 10
    min: 0.0000000001
  }
  
  // Empty and whitespace strings
  type NonEmpty = String { min_length: 1 }
  type ExactLength = String { min_length: 10, max_length: 10 }
  
  // Duration edge cases
  type ZeroDuration = Duration { min: 0.seconds }
  type MaxDuration = Duration { max: 365.days }
  
  entity BoundaryEntity {
    id: UUID [immutable, unique]
    
    // Numeric boundaries
    max_int: Int
    min_int: Int
    zero: Int
    
    // Precision
    precise_decimal: Decimal
    
    // Timestamps
    created_at: Timestamp [immutable]
    far_future: Timestamp
    
    // Empty collections
    empty_list: List<String>
    empty_map: Map<String, Int>
    
    // Null handling
    optional_null: String?
    
    invariants {
      max_int <= 2147483647
      min_int >= -2147483648
      zero == 0
      empty_list.length >= 0
    }
  }
  
  behavior TestBoundaries {
    input {
      max_value: Int
      min_value: Int
      zero_value: Int
      empty_string: String
      empty_list: List<String>
      null_value: String?
    }
    
    output {
      success: {
        sum: Int
        concatenated: String
        list_length: Int
        has_value: Boolean
      }
      
      errors {
        OVERFLOW {
          when: "Integer overflow detected"
        }
        UNDERFLOW {
          when: "Integer underflow detected"
        }
        EMPTY_INPUT {
          when: "Required input was empty"
        }
      }
    }
    
    preconditions {
      input.max_value <= 2147483647
      input.min_value >= -2147483648
    }
    
    postconditions {
      success implies {
        result.list_length == input.empty_list.length
        input.null_value == null implies result.has_value == false
        input.null_value != null implies result.has_value == true
      }
    }
  }
  
  // Test long string literals
  behavior TestLongStrings {
    description: "This is a very long description that tests the parser's ability to handle lengthy string content. It contains multiple sentences and spans many characters to ensure the lexer and parser can handle strings of significant length without issues. The description continues with more content to push the boundaries of what might be considered a reasonable string length in a specification file. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
    
    input {
      long_input: String
    }
    
    output {
      success: Boolean
    }
  }
  
  scenarios TestBoundaries {
    scenario "max values" {
      when {
        result = TestBoundaries(
          max_value: 2147483647,
          min_value: -2147483648,
          zero_value: 0,
          empty_string: "",
          empty_list: [],
          null_value: null
        )
      }
      
      then {
        result is success or result is OVERFLOW
      }
    }
    
    scenario "zero values" {
      when {
        result = TestBoundaries(
          max_value: 0,
          min_value: 0,
          zero_value: 0,
          empty_string: "",
          empty_list: [],
          null_value: null
        )
      }
      
      then {
        result is success
        result.sum == 0
        result.list_length == 0
        result.has_value == false
      }
    }
  }
}
