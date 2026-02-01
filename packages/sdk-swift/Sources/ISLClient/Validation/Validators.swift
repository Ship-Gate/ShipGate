import Foundation

// MARK: - Validator Protocol

/// Protocol for validators
public protocol Validator<Input>: Sendable {
    associatedtype Input
    
    /// Validate the input and throw on failure
    func validate(_ input: Input) throws
    
    /// Check if input is valid without throwing
    func isValid(_ input: Input) -> Bool
}

extension Validator {
    public func isValid(_ input: Input) -> Bool {
        do {
            try validate(input)
            return true
        } catch {
            return false
        }
    }
}

// MARK: - Validation Result

/// Result of validation with detailed errors
public struct ValidationResult: Sendable {
    public let isValid: Bool
    public let errors: [ValidationError]
    
    public init(isValid: Bool = true, errors: [ValidationError] = []) {
        self.isValid = isValid
        self.errors = errors
    }
    
    public static let valid = ValidationResult()
    
    public static func invalid(_ errors: [ValidationError]) -> ValidationResult {
        ValidationResult(isValid: false, errors: errors)
    }
    
    public static func invalid(_ error: ValidationError) -> ValidationResult {
        ValidationResult(isValid: false, errors: [error])
    }
    
    public func merge(_ other: ValidationResult) -> ValidationResult {
        ValidationResult(
            isValid: isValid && other.isValid,
            errors: errors + other.errors
        )
    }
}

// MARK: - Common Validators

/// String length validator
public struct LengthValidator: Validator {
    public typealias Input = String
    
    public let field: String
    public let min: Int?
    public let max: Int?
    
    public init(field: String, min: Int? = nil, max: Int? = nil) {
        self.field = field
        self.min = min
        self.max = max
    }
    
    public func validate(_ input: String) throws {
        if let min = min, input.count < min {
            throw ValidationError.valueTooShort(field: field, minimum: min)
        }
        if let max = max, input.count > max {
            throw ValidationError.valueTooLong(field: field, maximum: max)
        }
    }
}

/// Pattern validator
public struct PatternValidator: Validator {
    public typealias Input = String
    
    public let field: String
    public let pattern: String
    private let regex: NSRegularExpression?
    
    public init(field: String, pattern: String) {
        self.field = field
        self.pattern = pattern
        self.regex = try? NSRegularExpression(pattern: pattern)
    }
    
    public func validate(_ input: String) throws {
        guard let regex = regex else {
            throw ValidationError.patternMismatch(field: field, pattern: pattern)
        }
        
        let range = NSRange(input.startIndex..., in: input)
        guard regex.firstMatch(in: input, options: [], range: range) != nil else {
            throw ValidationError.patternMismatch(field: field, pattern: pattern)
        }
    }
}

/// Range validator for numeric values
public struct RangeValidator<T: Comparable & Sendable>: Validator {
    public typealias Input = T
    
    public let field: String
    public let range: ClosedRange<T>
    
    public init(field: String, range: ClosedRange<T>) {
        self.field = field
        self.range = range
    }
    
    public func validate(_ input: T) throws {
        guard range.contains(input) else {
            if let min = range.lowerBound as? Double, let max = range.upperBound as? Double {
                throw ValidationError.valueOutOfRange(field: field, min: min, max: max)
            }
            throw ValidationError.invalidFormat(field: field, expected: "value in range")
        }
    }
}

/// Non-empty validator
public struct NonEmptyValidator: Validator {
    public typealias Input = String
    
    public let field: String
    
    public init(field: String) {
        self.field = field
    }
    
    public func validate(_ input: String) throws {
        guard !input.isEmpty else {
            throw ValidationError.emptyValue(field: field)
        }
    }
}

// MARK: - ISL Behavior Validators

/// Create user precondition validator
/// Generated from ISL: `behavior CreateUser preconditions`
public struct CreateUserValidator: Validator {
    public typealias Input = CreateUserInput
    
    public init() {}
    
    public func validate(_ input: CreateUserInput) throws {
        // Email is already validated by Email type
        
        // Username: min_length: 3, max_length: 30
        try LengthValidator(field: "username", min: 3, max: 30).validate(input.username)
        
        // Username pattern: alphanumeric and underscores only
        try PatternValidator(field: "username", pattern: #"^[a-zA-Z0-9_]+$"#).validate(input.username)
        
        // Display name validation (optional)
        if let displayName = input.displayName {
            try LengthValidator(field: "displayName", min: 1, max: 100).validate(displayName)
        }
    }
}

/// Update user precondition validator
/// Generated from ISL: `behavior UpdateUser preconditions`
public struct UpdateUserValidator: Validator {
    public typealias Input = UpdateUserInput
    
    public init() {}
    
    public func validate(_ input: UpdateUserInput) throws {
        // At least one field should be provided
        guard input.displayName != nil || input.status != nil else {
            throw ValidationError.requiredFieldMissing(field: "at least one update field")
        }
        
        // Display name validation
        if let displayName = input.displayName {
            try LengthValidator(field: "displayName", min: 1, max: 100).validate(displayName)
        }
    }
}

/// Create organization precondition validator
/// Generated from ISL: `behavior CreateOrganization preconditions`
public struct CreateOrganizationValidator: Validator {
    public typealias Input = CreateOrganizationInput
    
    public init() {}
    
    public func validate(_ input: CreateOrganizationInput) throws {
        // Name: min_length: 2, max_length: 100
        try LengthValidator(field: "name", min: 2, max: 100).validate(input.name)
        
        // Slug: min_length: 2, max_length: 50
        try LengthValidator(field: "slug", min: 2, max: 50).validate(input.slug)
        
        // Slug pattern: lowercase alphanumeric and hyphens
        try PatternValidator(field: "slug", pattern: #"^[a-z0-9-]+$"#).validate(input.slug)
    }
}

/// Create API key precondition validator
/// Generated from ISL: `behavior CreateAPIKey preconditions`
public struct CreateAPIKeyValidator: Validator {
    public typealias Input = CreateAPIKeyInput
    
    public init() {}
    
    public func validate(_ input: CreateAPIKeyInput) throws {
        // Name: min_length: 1, max_length: 100
        try NonEmptyValidator(field: "name").validate(input.name)
        try LengthValidator(field: "name", max: 100).validate(input.name)
        
        // Permissions must not be empty
        guard !input.permissions.isEmpty else {
            throw ValidationError.emptyValue(field: "permissions")
        }
        
        // Expiration date must be in the future if provided
        if let expiresAt = input.expiresAt {
            guard expiresAt > Date() else {
                throw ValidationError.invalidFormat(field: "expiresAt", expected: "date in the future")
            }
        }
    }
}

// MARK: - Composite Validators

/// Combine multiple validators
public struct CompositeValidator<Input>: Validator {
    private let validators: [AnyValidator<Input>]
    
    public init(_ validators: [any Validator<Input>]) {
        self.validators = validators.map { AnyValidator($0) }
    }
    
    public func validate(_ input: Input) throws {
        for validator in validators {
            try validator.validate(input)
        }
    }
}

/// Type-erased validator
public struct AnyValidator<Input>: Validator {
    private let _validate: @Sendable (Input) throws -> Void
    
    public init<V: Validator>(_ validator: V) where V.Input == Input {
        self._validate = validator.validate
    }
    
    public func validate(_ input: Input) throws {
        try _validate(input)
    }
}

// MARK: - Validation Builder

/// Builder for composing validation rules
@resultBuilder
public struct ValidationBuilder<Input> {
    public static func buildBlock(_ validators: any Validator<Input>...) -> CompositeValidator<Input> {
        CompositeValidator(validators)
    }
}

/// Create composite validator with builder syntax
public func validate<Input>(@ValidationBuilder<Input> _ builder: () -> CompositeValidator<Input>) -> CompositeValidator<Input> {
    builder()
}

// MARK: - Validation Extensions

extension String {
    /// Validate string with given validator
    public func validate<V: Validator>(with validator: V) throws where V.Input == String {
        try validator.validate(self)
    }
    
    /// Check if string matches pattern
    public func matches(pattern: String) -> Bool {
        PatternValidator(field: "", pattern: pattern).isValid(self)
    }
}

// MARK: - Precondition Validation Helper

/// Validate preconditions and return errors
public func validatePreconditions<T>(
    _ input: T,
    validators: [AnyValidator<T>]
) -> ValidationResult {
    var errors: [ValidationError] = []
    
    for validator in validators {
        do {
            try validator.validate(input)
        } catch let error as ValidationError {
            errors.append(error)
        } catch {
            // Non-validation errors are unexpected
        }
    }
    
    if errors.isEmpty {
        return .valid
    }
    
    return .invalid(errors)
}
