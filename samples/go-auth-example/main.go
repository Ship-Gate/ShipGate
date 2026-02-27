// Package main demonstrates ISL runtime verification in Go
//
// This example shows how to:
// 1. Load ISL constraints
// 2. Emit trace events during behavior execution
// 3. Save traces for verification with `shipgate verify`
package main

import (
	"fmt"
	"os"
	"time"

	"github.com/shipgate/isl-runtime-go"
)

// User represents a user entity
type User struct {
	ID         string
	Email      string
	Username   string
	LoginCount int
}

// UserStore manages users
type UserStore struct {
	users map[string]*User
}

// NewUserStore creates a new user store
func NewUserStore() *UserStore {
	return &UserStore{
		users: make(map[string]*User),
	}
}

// CreateUser creates a new user
func (s *UserStore) CreateUser(email, username string) (*User, error) {
	if _, exists := s.users[email]; exists {
		return nil, fmt.Errorf("EMAIL_EXISTS")
	}
	user := &User{
		ID:         fmt.Sprintf("user_%d", len(s.users)),
		Email:      email,
		Username:   username,
		LoginCount: 0,
	}
	s.users[email] = user
	return user, nil
}

// Login logs in a user
func (s *UserStore) Login(email string) (string, error) {
	user, exists := s.users[email]
	if !exists {
		return "", fmt.Errorf("USER_NOT_FOUND")
	}
	user.LoginCount++
	return fmt.Sprintf("session_%s", user.ID), nil
}

func main() {
	fmt.Println("=== Go Auth Example - ISL Runtime Verification ===\n")

	// 1. Load constraints
	fmt.Println("1. Loading ISL constraints...")
	loader := islruntime.NewConstraintLoader()

	var constraints *islruntime.DomainConstraints
	var err error

	// Try loading from JSON first (recommended), fallback to ISL
	if _, err := os.Stat("specs/auth.json"); err == nil {
		constraints, err = loader.LoadFromJSON("specs/auth.json")
		if err != nil {
			panic(fmt.Errorf("failed to load JSON: %w", err))
		}
	} else {
		constraints, err = loader.LoadFromFile("specs/auth.isl")
		if err != nil {
			panic(fmt.Errorf("failed to load ISL: %w", err))
		}
	}

	fmt.Printf("   Loaded domain: %s\n", constraints.Domain)
	fmt.Printf("   Behaviors: %d\n", len(constraints.Behaviors))
	for _, behavior := range constraints.Behaviors {
		fmt.Printf("     - %s (%d preconditions, %d postconditions)\n",
			behavior.Name,
			len(behavior.Preconditions),
			len(behavior.Postconditions),
		)
	}
	fmt.Println()

	// 2. Initialize user store
	store := NewUserStore()

	// 3. Execute CreateUser behavior with tracing
	fmt.Println("2. Executing CreateUser behavior...")
	emitter := islruntime.NewTraceEmitter(constraints.Domain, "CreateUser")

	// Capture initial state
	emitter.CaptureInitialState(map[string]interface{}{
		"user_count": len(store.users),
	})

	input := map[string]interface{}{
		"email":    "alice@example.com",
		"username": "alice",
	}

	// Emit call event
	start := time.Now()
	emitter.EmitCall("CreateUser", input)

	// Check preconditions
	email := input["email"].(string)
	username := input["username"].(string)
	pre1Passed := len(email) > 0
	pre2Passed := len(username) > 0

	emitter.EmitCheck(
		"input.email.length > 0",
		pre1Passed,
		"precondition",
		nil,
		nil,
		nil,
	)
	emitter.EmitCheck(
		"input.username.length > 0",
		pre2Passed,
		"precondition",
		nil,
		nil,
		nil,
	)

	// Execute behavior
	user, err := store.CreateUser(email, username)
	duration := time.Since(start).Milliseconds()

	if err != nil {
		errorCode := "CREATE_USER_ERROR"
		emitter.EmitError(err.Error(), &errorCode, nil)
		fmt.Printf("   ✗ Error: %s\n", err)
	} else {
		output := map[string]interface{}{
			"id":       user.ID,
			"email":    user.Email,
			"username": user.Username,
		}
		emitter.EmitReturn("CreateUser", output, duration)

		// Check postconditions
		emitter.EmitCheck(
			"result.id != null",
			true,
			"postcondition",
			nil,
			nil,
			nil,
		)

		fmt.Printf("   ✓ Created user: %s (%s)\n", user.Username, user.ID)
	}

	// Save trace
	if err := os.MkdirAll(".shipgate/traces", 0755); err != nil {
		panic(fmt.Errorf("failed to create traces directory: %w", err))
	}
	if err := emitter.SaveToFile(".shipgate/traces/create_user.json", err == nil); err != nil {
		panic(fmt.Errorf("failed to save trace: %w", err))
	}
	fmt.Println("   Trace saved to .shipgate/traces/create_user.json\n")

	// 4. Execute Login behavior with tracing
	if err == nil {
		fmt.Println("3. Executing Login behavior...")
		emitter = islruntime.NewTraceEmitter(constraints.Domain, "Login")

		emitter.CaptureInitialState(map[string]interface{}{
			"user_count": len(store.users),
		})

		input = map[string]interface{}{
			"email":      "alice@example.com",
			"ip_address": "192.168.1.100",
		}

		start = time.Now()
		emitter.EmitCall("Login", input)

		// Check preconditions
		email = input["email"].(string)
		prePassed := len(email) > 0
		emitter.EmitCheck(
			"input.email.length > 0",
			prePassed,
			"precondition",
			nil,
			nil,
			nil,
		)

		// Execute behavior
		sessionID, err := store.Login(email)
		duration = time.Since(start).Milliseconds()

		if err != nil {
			errorCode := "LOGIN_ERROR"
			emitter.EmitError(err.Error(), &errorCode, nil)
			fmt.Printf("   ✗ Error: %s\n", err)
		} else {
			output := map[string]interface{}{
				"session_id": sessionID,
			}
			emitter.EmitReturn("Login", output, duration)

			// Check postconditions
			emitter.EmitCheck(
				"result.session_id != null",
				true,
				"postcondition",
				nil,
				nil,
				nil,
			)

			fmt.Printf("   ✓ Login successful: %s\n", sessionID)
		}

		// Save trace
		if err := emitter.SaveToFile(".shipgate/traces/login.json", err == nil); err != nil {
			panic(fmt.Errorf("failed to save trace: %w", err))
		}
		fmt.Println("   Trace saved to .shipgate/traces/login.json\n")
	}

	// 5. Summary
	fmt.Println("=== Summary ===")
	fmt.Println("Traces generated:")
	fmt.Println("  - .shipgate/traces/create_user.json")
	fmt.Println("  - .shipgate/traces/login.json")
	fmt.Println()
	fmt.Println("To verify with shipgate:")
	fmt.Println("  shipgate verify --proof .shipgate/traces")
}
