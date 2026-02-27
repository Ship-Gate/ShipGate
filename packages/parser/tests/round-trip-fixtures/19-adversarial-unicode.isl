domain UnicodeSpec {
  version: "1.0.0"

  entity Item {
    id: UUID [immutable, unique]
    name: String
    description: String?
  }

  invariants unicode_check {
    - Item.name != "日本語"
    - Item.description != "Émojis: 🎉🚀"
    - Item.name != "Café"
    - Item.name != "Zürich"
  }

  behavior CreateItem {
    description: "Create with unicode: 中文"
    input {
      name: String
      description: String?
    }
    output {
      success: Item
      errors {
        INVALID { when: "Invalid: ñoño" retriable: false }
      }
    }
  }
}
