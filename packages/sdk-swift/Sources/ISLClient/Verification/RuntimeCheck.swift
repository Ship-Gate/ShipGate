import Foundation
import os.log

// MARK: - Runtime Verification

/// Runtime verification mode
public enum VerificationMode: Sendable {
    /// Verify all conditions, throw on failure
    case strict
    /// Verify all conditions, log on failure but don't throw
    case warn
    /// Skip verification (production optimization)
    case disabled
    
    #if DEBUG
    public static let `default` = VerificationMode.strict
    #else
    public static let `default` = VerificationMode.warn
    #endif
}

/// Runtime verification configuration
public struct VerificationConfiguration: Sendable {
    public let mode: VerificationMode
    public let logViolations: Bool
    public let reportCallback: (@Sendable (VerificationViolation) -> Void)?
    
    public init(
        mode: VerificationMode = .default,
        logViolations: Bool = true,
        reportCallback: (@Sendable (VerificationViolation) -> Void)? = nil
    ) {
        self.mode = mode
        self.logViolations = logViolations
        self.reportCallback = reportCallback
    }
    
    public static let `default` = VerificationConfiguration()
    public static let disabled = VerificationConfiguration(mode: .disabled)
    public static let strict = VerificationConfiguration(mode: .strict)
}

/// Verification violation details
public struct VerificationViolation: Sendable {
    public let type: ViolationType
    public let behavior: String
    public let message: String
    public let timestamp: Date
    public let context: [String: String]
    
    public enum ViolationType: String, Sendable {
        case precondition
        case postcondition
        case invariant
    }
    
    public init(
        type: ViolationType,
        behavior: String,
        message: String,
        context: [String: String] = [:]
    ) {
        self.type = type
        self.behavior = behavior
        self.message = message
        self.timestamp = Date()
        self.context = context
    }
}

// MARK: - Runtime Verifier

/// Central runtime verification manager
public actor RuntimeVerifier {
    public static let shared = RuntimeVerifier()
    
    private var configuration: VerificationConfiguration = .default
    private let logger = Logger(subsystem: "com.intentos.islclient", category: "verification")
    private var violations: [VerificationViolation] = []
    
    public func configure(_ configuration: VerificationConfiguration) {
        self.configuration = configuration
    }
    
    /// Verify a precondition
    public func verifyPrecondition(
        _ condition: @autoclosure () -> Bool,
        behavior: String,
        message: String,
        context: [String: String] = [:]
    ) throws {
        guard configuration.mode != .disabled else { return }
        
        guard condition() else {
            let violation = VerificationViolation(
                type: .precondition,
                behavior: behavior,
                message: message,
                context: context
            )
            
            await handleViolation(violation)
            
            if configuration.mode == .strict {
                throw VerificationError.preconditionFailed(message)
            }
            return
        }
    }
    
    /// Verify a postcondition
    public func verifyPostcondition(
        _ condition: @autoclosure () -> Bool,
        behavior: String,
        message: String,
        context: [String: String] = [:]
    ) throws {
        guard configuration.mode != .disabled else { return }
        
        guard condition() else {
            let violation = VerificationViolation(
                type: .postcondition,
                behavior: behavior,
                message: message,
                context: context
            )
            
            await handleViolation(violation)
            
            if configuration.mode == .strict {
                throw VerificationError.postconditionFailed(message)
            }
            return
        }
    }
    
    /// Verify an invariant
    public func verifyInvariant(
        _ condition: @autoclosure () -> Bool,
        behavior: String,
        message: String,
        context: [String: String] = [:]
    ) throws {
        guard configuration.mode != .disabled else { return }
        
        guard condition() else {
            let violation = VerificationViolation(
                type: .invariant,
                behavior: behavior,
                message: message,
                context: context
            )
            
            await handleViolation(violation)
            
            if configuration.mode == .strict {
                throw VerificationError.invariantViolation(message)
            }
            return
        }
    }
    
    private func handleViolation(_ violation: VerificationViolation) async {
        violations.append(violation)
        
        if configuration.logViolations {
            logger.error("[\(violation.type.rawValue)] \(violation.behavior): \(violation.message)")
        }
        
        configuration.reportCallback?(violation)
    }
    
    /// Get recorded violations
    public var recordedViolations: [VerificationViolation] {
        violations
    }
    
    /// Clear recorded violations
    public func clearViolations() {
        violations.removeAll()
    }
}

// MARK: - Behavior Contract Verifiers

/// Verifier for CreateUser behavior
/// Generated from ISL: `behavior CreateUser`
public struct CreateUserContractVerifier: Sendable {
    private let verifier: RuntimeVerifier
    
    public init(verifier: RuntimeVerifier = .shared) {
        self.verifier = verifier
    }
    
    /// Verify preconditions
    public func verifyPreconditions(_ input: CreateUserInput) async throws {
        // Email must be valid (already enforced by Email type)
        
        // Username: min_length: 3, max_length: 30
        try await verifier.verifyPrecondition(
            input.username.count >= 3,
            behavior: "CreateUser",
            message: "Username must be at least 3 characters",
            context: ["username_length": String(input.username.count)]
        )
        
        try await verifier.verifyPrecondition(
            input.username.count <= 30,
            behavior: "CreateUser",
            message: "Username must not exceed 30 characters",
            context: ["username_length": String(input.username.count)]
        )
    }
    
    /// Verify postconditions
    public func verifyPostconditions(input: CreateUserInput, result: User) async throws {
        // result.email == input.email
        try await verifier.verifyPostcondition(
            result.email == input.email,
            behavior: "CreateUser",
            message: "Returned email must match input email",
            context: [
                "input_email": input.email.value,
                "result_email": result.email.value
            ]
        )
        
        // result.status == PENDING
        try await verifier.verifyPostcondition(
            result.status == .pending,
            behavior: "CreateUser",
            message: "New user status must be PENDING",
            context: ["result_status": result.status.rawValue]
        )
        
        // result.username == input.username
        try await verifier.verifyPostcondition(
            result.username == input.username,
            behavior: "CreateUser",
            message: "Returned username must match input username",
            context: [
                "input_username": input.username,
                "result_username": result.username
            ]
        )
    }
}

/// Verifier for UpdateUser behavior
/// Generated from ISL: `behavior UpdateUser`
public struct UpdateUserContractVerifier: Sendable {
    private let verifier: RuntimeVerifier
    
    public init(verifier: RuntimeVerifier = .shared) {
        self.verifier = verifier
    }
    
    /// Verify postconditions
    public func verifyPostconditions(input: UpdateUserInput, original: User, result: User) async throws {
        // result.id == original.id (immutable)
        try await verifier.verifyPostcondition(
            result.id == original.id,
            behavior: "UpdateUser",
            message: "User ID must not change",
            context: [
                "original_id": original.id.uuidString,
                "result_id": result.id.uuidString
            ]
        )
        
        // result.email == original.email (immutable in update)
        try await verifier.verifyPostcondition(
            result.email == original.email,
            behavior: "UpdateUser",
            message: "Email must not change via update",
            context: [
                "original_email": original.email.value,
                "result_email": result.email.value
            ]
        )
        
        // result.updatedAt > original.updatedAt
        try await verifier.verifyPostcondition(
            result.updatedAt > original.updatedAt,
            behavior: "UpdateUser",
            message: "Updated timestamp must be newer",
            context: [:]
        )
        
        // If displayName was provided, it should be updated
        if let newDisplayName = input.displayName {
            try await verifier.verifyPostcondition(
                result.displayName == newDisplayName,
                behavior: "UpdateUser",
                message: "Display name must be updated to provided value",
                context: [
                    "input_displayName": newDisplayName,
                    "result_displayName": result.displayName ?? "nil"
                ]
            )
        }
        
        // If status was provided, it should be updated
        if let newStatus = input.status {
            try await verifier.verifyPostcondition(
                result.status == newStatus,
                behavior: "UpdateUser",
                message: "Status must be updated to provided value",
                context: [
                    "input_status": newStatus.rawValue,
                    "result_status": result.status.rawValue
                ]
            )
        }
    }
}

/// Verifier for CreateOrganization behavior
/// Generated from ISL: `behavior CreateOrganization`
public struct CreateOrganizationContractVerifier: Sendable {
    private let verifier: RuntimeVerifier
    
    public init(verifier: RuntimeVerifier = .shared) {
        self.verifier = verifier
    }
    
    /// Verify preconditions
    public func verifyPreconditions(_ input: CreateOrganizationInput) async throws {
        // Name: min_length: 2
        try await verifier.verifyPrecondition(
            input.name.count >= 2,
            behavior: "CreateOrganization",
            message: "Organization name must be at least 2 characters",
            context: ["name_length": String(input.name.count)]
        )
        
        // Slug: min_length: 2, lowercase alphanumeric
        try await verifier.verifyPrecondition(
            input.slug.count >= 2,
            behavior: "CreateOrganization",
            message: "Organization slug must be at least 2 characters",
            context: ["slug_length": String(input.slug.count)]
        )
    }
    
    /// Verify postconditions
    public func verifyPostconditions(input: CreateOrganizationInput, ownerId: UUID, result: Organization) async throws {
        // result.name == input.name
        try await verifier.verifyPostcondition(
            result.name == input.name,
            behavior: "CreateOrganization",
            message: "Returned name must match input",
            context: [
                "input_name": input.name,
                "result_name": result.name
            ]
        )
        
        // result.slug == input.slug
        try await verifier.verifyPostcondition(
            result.slug == input.slug,
            behavior: "CreateOrganization",
            message: "Returned slug must match input",
            context: [
                "input_slug": input.slug,
                "result_slug": result.slug
            ]
        )
        
        // result.ownerId == current user
        try await verifier.verifyPostcondition(
            result.ownerId == ownerId,
            behavior: "CreateOrganization",
            message: "Owner ID must be the creating user",
            context: [
                "expected_ownerId": ownerId.uuidString,
                "result_ownerId": result.ownerId.uuidString
            ]
        )
        
        // result.memberCount == 1 (owner is first member)
        try await verifier.verifyPostcondition(
            result.memberCount == 1,
            behavior: "CreateOrganization",
            message: "New organization must have exactly 1 member (owner)",
            context: ["result_memberCount": String(result.memberCount)]
        )
    }
}

// MARK: - Convenience Functions

/// Verify a precondition with default verifier
public func verifyPrecondition(
    _ condition: @autoclosure () -> Bool,
    behavior: String,
    message: String
) async throws {
    try await RuntimeVerifier.shared.verifyPrecondition(
        condition(),
        behavior: behavior,
        message: message
    )
}

/// Verify a postcondition with default verifier
public func verifyPostcondition(
    _ condition: @autoclosure () -> Bool,
    behavior: String,
    message: String
) async throws {
    try await RuntimeVerifier.shared.verifyPostcondition(
        condition(),
        behavior: behavior,
        message: message
    )
}

/// Verify an invariant with default verifier
public func verifyInvariant(
    _ condition: @autoclosure () -> Bool,
    behavior: String,
    message: String
) async throws {
    try await RuntimeVerifier.shared.verifyInvariant(
        condition(),
        behavior: behavior,
        message: message
    )
}
