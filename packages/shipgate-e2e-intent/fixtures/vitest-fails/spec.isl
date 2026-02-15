domain MathService {
  version: "1.0.0"

  behavior Divide {
    input {
      numerator: Float
      denominator: Float
    }

    output {
      success: Float
      errors {
        DIVISION_BY_ZERO {
          when: "Denominator is zero"
          retriable: false
        }
      }
    }

    preconditions {
      - input.denominator != 0
    }

    postconditions {
      success implies {
        - result == input.numerator / input.denominator
      }
    }
  }
}
