# Shadowing test - types to be shadowed

domain ShadowTypes {
  version: "1.0.0"

  type Email = String { format: "email", max_length: 255 }
}
