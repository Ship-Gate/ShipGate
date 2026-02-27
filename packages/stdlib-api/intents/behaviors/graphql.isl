# GraphQL API Behaviors

# ============================================
# GraphQL Query
# ============================================

behavior GraphQLQuery {
  description: "Execute a GraphQL query"
  
  input {
    query: String
    variables: Map<String, Any>?
    operation_name: String?
  }
  
  output {
    success: {
      data: Any
      extensions: Map<String, Any>?
    }
    errors {
      SYNTAX_ERROR {
        when: "Query syntax is invalid"
        fields { 
          message: String
          locations: List<{ line: Int, column: Int }>
        }
      }
      VALIDATION_ERROR {
        when: "Query doesn't match schema"
        fields { errors: List<GraphQLError> }
      }
      EXECUTION_ERROR {
        when: "Resolver threw an error"
        fields { 
          errors: List<GraphQLError>
          partial_data: Any?
        }
      }
    }
  }
  
  invariants {
    query depth <= max_query_depth
    query complexity <= max_query_complexity
  }
  
  temporal {
    within 5.seconds: query completes
  }
}

behavior GraphQLMutation {
  description: "Execute a GraphQL mutation"
  
  input {
    mutation: String
    variables: Map<String, Any>?
    operation_name: String?
  }
  
  output {
    success: {
      data: Any
      extensions: Map<String, Any>?
    }
    errors {
      SYNTAX_ERROR { }
      VALIDATION_ERROR { }
      EXECUTION_ERROR { }
      AUTHORIZATION_ERROR {
        when: "User not authorized for mutation"
      }
    }
  }
}

behavior GraphQLSubscription {
  description: "Subscribe to GraphQL events"
  
  input {
    subscription: String
    variables: Map<String, Any>?
  }
  
  output {
    success: Stream<{
      data: Any
      errors: List<GraphQLError>?
    }>
    errors {
      SUBSCRIPTION_NOT_SUPPORTED { }
      INVALID_SUBSCRIPTION { }
    }
  }
}

type GraphQLError = {
  message: String
  locations: List<{ line: Int, column: Int }>?
  path: List<String | Int>?
  extensions: Map<String, Any>?
}

# ============================================
# GraphQL Schema Definition
# ============================================

entity GraphQLSchema {
  types: List<GraphQLType>
  queries: List<GraphQLField>
  mutations: List<GraphQLField>?
  subscriptions: List<GraphQLField>?
  directives: List<GraphQLDirective>?
  
  # Security
  depth_limit: Int = 10
  complexity_limit: Int = 1000
  introspection_enabled: Boolean = true
  
  derived {
    sdl: String = generate_sdl(this)
  }
}

type GraphQLType = {
  name: String
  kind: GraphQLTypeKind
  fields: List<GraphQLField>?
  interfaces: List<String>?
  enum_values: List<String>?
  input_fields: List<GraphQLInputField>?
  possible_types: List<String>?
}

enum GraphQLTypeKind {
  SCALAR
  OBJECT
  INTERFACE
  UNION
  ENUM
  INPUT_OBJECT
  LIST
  NON_NULL
}

type GraphQLField = {
  name: String
  type: GraphQLTypeRef
  args: List<GraphQLInputField>?
  description: String?
  deprecated: Boolean = false
  deprecation_reason: String?
  resolver: String?
  directives: List<GraphQLDirectiveUsage>?
}

type GraphQLInputField = {
  name: String
  type: GraphQLTypeRef
  default_value: Any?
  description: String?
}

type GraphQLTypeRef = {
  name: String
  kind: GraphQLTypeKind
  of_type: GraphQLTypeRef?
}

type GraphQLDirective = {
  name: String
  description: String?
  locations: List<DirectiveLocation>
  args: List<GraphQLInputField>?
}

type GraphQLDirectiveUsage = {
  name: String
  args: Map<String, Any>?
}

enum DirectiveLocation {
  QUERY
  MUTATION
  SUBSCRIPTION
  FIELD
  FRAGMENT_DEFINITION
  FRAGMENT_SPREAD
  INLINE_FRAGMENT
  SCHEMA
  SCALAR
  OBJECT
  FIELD_DEFINITION
  ARGUMENT_DEFINITION
  INTERFACE
  UNION
  ENUM
  ENUM_VALUE
  INPUT_OBJECT
  INPUT_FIELD_DEFINITION
}
