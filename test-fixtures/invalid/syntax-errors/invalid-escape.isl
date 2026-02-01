// Syntax error: invalid escape sequence

domain InvalidEscape {
  version: "1.0.0"
  
  behavior Test {
    description: "Invalid \x escape sequence"
    
    input {
      value: String
    }
  }
}
