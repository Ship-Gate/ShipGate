domain Greeter {
  version: "1.0.0"

  behavior Greet {
    input {
      name: String
    }

    output {
      success: String
      errors {
        EMPTY_NAME {
          when: "Name is empty or whitespace"
        }
      }
    }

    pre {
      name.length > 0
      name.trim().length > 0
    }

    post success {
      result.contains(input.name)
      result.length > input.name.length
    }
  }
}
