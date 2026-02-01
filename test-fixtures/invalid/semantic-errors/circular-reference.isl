// Semantic error: circular type reference

domain CircularReference {
  version: "1.0.0"
  
  // Direct circular reference
  type A = B
  type B = A
  
  // Indirect circular reference
  type X = Y
  type Y = Z
  type Z = X
  
  // Self-referential type (should be explicit)
  type Node = {
    value: String
    next: Node  // Should use explicit recursion syntax
  }
}
