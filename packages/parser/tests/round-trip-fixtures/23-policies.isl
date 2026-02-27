domain WithPolicies {
  version: "1.0.0"

  entity Resource {
    id: UUID [immutable, unique]
    owner_id: UUID
    public: Boolean
  }

  policy OwnerOnly {
    applies_to: UpdateResource, DeleteResource
    rules {
      when (Resource.public == true): allow
      default: deny
    }
  }

  policy PublicRead {
    applies_to: all
    rules {
      when (Resource.public == true): allow
      default: deny
    }
  }

  behavior UpdateResource {
    input {
      id: UUID
      user_id: UUID
    }
    output {
      success: Resource
    }
  }

  behavior DeleteResource {
    input {
      id: UUID
      user_id: UUID
    }
    output {
      success: Boolean
    }
  }
}
