// Package islruntime provides runtime verification helpers for ISL (Intent Specification Language)
package islruntime

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

// TraceEventType represents the type of trace event
type TraceEventType string

const (
	TraceEventTypeCall        TraceEventType = "call"
	TraceEventTypeReturn      TraceEventType = "return"
	TraceEventTypeStateChange TraceEventType = "state_change"
	TraceEventTypeCheck       TraceEventType = "check"
	TraceEventTypeError       TraceEventType = "error"
)

// TraceEvent represents a single trace event
type TraceEvent struct {
	ID          string                 `json:"id"`
	Type        TraceEventType         `json:"type"`
	Timestamp   int64                  `json:"timestamp"`
	Data        map[string]interface{} `json:"data"`
	Behavior    *string                `json:"behavior,omitempty"`
	Input       map[string]interface{} `json:"input,omitempty"`
	Output      interface{}            `json:"output,omitempty"`
	Error       *ErrorInfo             `json:"error,omitempty"`
	StateBefore *EntityStoreSnapshot   `json:"state_before,omitempty"`
	StateAfter  *EntityStoreSnapshot   `json:"state_after,omitempty"`
}

// ErrorInfo represents error information
type ErrorInfo struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// EntityStoreSnapshot represents a snapshot of entity state
type EntityStoreSnapshot struct {
	Entities map[string]map[string]interface{} `json:"entities"`
}

// TraceMetadata contains metadata about a trace
type TraceMetadata struct {
	TestName      string  `json:"test_name"`
	Scenario      string  `json:"scenario"`
	Implementation *string `json:"implementation,omitempty"`
	Version       string  `json:"version"`
	Environment   string  `json:"environment"`
	Passed        bool    `json:"passed"`
	FailureIndex  *int    `json:"failure_index,omitempty"`
	Duration      int64   `json:"duration"`
}

// Trace represents a complete trace
type Trace struct {
	ID           string                 `json:"id"`
	Name         string                 `json:"name"`
	Domain       string                 `json:"domain"`
	StartTime    int64                  `json:"start_time"`
	EndTime      int64                  `json:"end_time"`
	Events       []TraceEvent           `json:"events"`
	InitialState map[string]interface{} `json:"initial_state"`
	Snapshots    []interface{}           `json:"snapshots"`
	Metadata     TraceMetadata           `json:"metadata"`
}

// TraceEmitter emits trace events during runtime execution
type TraceEmitter struct {
	traceID      string
	startTime    int64
	events       []TraceEvent
	initialState map[string]interface{}
	domain       string
	behavior     string
	eventCounter int
}

// NewTraceEmitter creates a new trace emitter
func NewTraceEmitter(domain, behavior string) *TraceEmitter {
	return &TraceEmitter{
		traceID:      fmt.Sprintf("trace_%d_%s", time.Now().UnixMilli(), uuid.New().String()),
		startTime:    time.Now().UnixMilli(),
		events:       make([]TraceEvent, 0),
		initialState: make(map[string]interface{}),
		domain:       domain,
		behavior:     behavior,
		eventCounter: 0,
	}
}

// CaptureInitialState captures the initial state
func (te *TraceEmitter) CaptureInitialState(state map[string]interface{}) {
	te.initialState = te.redactPII(state)
}

// EmitCall emits a function call event
func (te *TraceEmitter) EmitCall(functionName string, args map[string]interface{}) {
	redactedArgs := te.redactPII(args)
	te.events = append(te.events, TraceEvent{
		ID:        te.generateEventID(),
		Type:      TraceEventTypeCall,
		Timestamp: time.Now().UnixMilli(),
		Data: map[string]interface{}{
			"kind":     "call",
			"function": functionName,
			"args":     redactedArgs,
		},
		Behavior: &te.behavior,
		Input:    redactedArgs,
	})
}

// EmitReturn emits a function return event
func (te *TraceEmitter) EmitReturn(functionName string, result interface{}, durationMs int64) {
	redactedResult := te.redactValue(result)
	te.events = append(te.events, TraceEvent{
		ID:        te.generateEventID(),
		Type:      TraceEventTypeReturn,
		Timestamp: time.Now().UnixMilli(),
		Data: map[string]interface{}{
			"kind":     "return",
			"function": functionName,
			"result":   redactedResult,
			"duration": durationMs,
		},
		Behavior: &te.behavior,
		Output:   redactedResult,
	})
}

// EmitStateChange emits a state change event
func (te *TraceEmitter) EmitStateChange(path []string, oldValue, newValue interface{}, source string) {
	te.events = append(te.events, TraceEvent{
		ID:        te.generateEventID(),
		Type:      TraceEventTypeStateChange,
		Timestamp: time.Now().UnixMilli(),
		Data: map[string]interface{}{
			"kind":      "state_change",
			"path":      path,
			"oldValue":  te.redactValue(oldValue),
			"newValue":  te.redactValue(newValue),
			"source":    source,
		},
		Behavior: &te.behavior,
	})
}

// EmitCheck emits a check event (precondition, postcondition, invariant)
func (te *TraceEmitter) EmitCheck(expression string, passed bool, category string, expected, actual interface{}, message *string) {
	eventType := TraceEventTypeCheck
	data := map[string]interface{}{
		"kind":      "check",
		"expression": expression,
		"passed":    passed,
		"category":  category,
	}
	if expected != nil {
		data["expected"] = te.redactValue(expected)
	}
	if actual != nil {
		data["actual"] = te.redactValue(actual)
	}
	if message != nil {
		data["message"] = *message
	}

	te.events = append(te.events, TraceEvent{
		ID:        te.generateEventID(),
		Type:      eventType,
		Timestamp: time.Now().UnixMilli(),
		Data:      data,
		Behavior:  &te.behavior,
	})
}

// EmitError emits an error event
func (te *TraceEmitter) EmitError(message string, code *string, stack *string) {
	errorCode := "UNKNOWN"
	if code != nil {
		errorCode = *code
	}
	te.events = append(te.events, TraceEvent{
		ID:        te.generateEventID(),
		Type:      TraceEventTypeError,
		Timestamp: time.Now().UnixMilli(),
		Data: map[string]interface{}{
			"kind":    "error",
			"message": message,
			"code":    errorCode,
			"stack":   te.redactPIIValue(stack),
		},
		Behavior: &te.behavior,
		Error: &ErrorInfo{
			Code:    errorCode,
			Message: message,
		},
	})
}

// Finalize finalizes and returns the trace
func (te *TraceEmitter) Finalize(passed bool) *Trace {
	endTime := time.Now().UnixMilli()
	duration := endTime - te.startTime

	return &Trace{
		ID:           te.traceID,
		Name:         fmt.Sprintf("%s - %s", te.domain, te.behavior),
		Domain:       te.domain,
		StartTime:    te.startTime,
		EndTime:      endTime,
		Events:       te.events,
		InitialState: te.initialState,
		Snapshots:    make([]interface{}, 0),
		Metadata: TraceMetadata{
			TestName:    fmt.Sprintf("%s::%s", te.domain, te.behavior),
			Scenario:    te.behavior,
			Version:     "1.0.0",
			Environment: "runtime",
			Passed:      passed,
			Duration:    duration,
		},
	}
}

// SaveToFile saves the trace to a file
func (te *TraceEmitter) SaveToFile(path string, passed bool) error {
	trace := te.Finalize(passed)
	data, err := json.MarshalIndent(trace, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal trace: %w", err)
	}
	return os.WriteFile(path, data, 0644)
}

func (te *TraceEmitter) generateEventID() string {
	te.eventCounter++
	return fmt.Sprintf("evt_%d_%d", te.eventCounter, time.Now().UnixMilli())
}

func (te *TraceEmitter) redactPII(value map[string]interface{}) map[string]interface{} {
	redacted := make(map[string]interface{})
	for k, v := range value {
		lowerKey := strings.ToLower(k)
		if te.isForbiddenKey(lowerKey) {
			continue
		}
		if strings.Contains(lowerKey, "email") {
			if str, ok := v.(string); ok {
				redacted[k] = te.redactEmail(str)
			} else {
				redacted[k] = te.redactValue(v)
			}
		} else if strings.Contains(lowerKey, "ip") || lowerKey == "ip_address" {
			if str, ok := v.(string); ok {
				redacted[k] = te.redactIP(str)
			} else {
				redacted[k] = te.redactValue(v)
			}
		} else if strings.Contains(lowerKey, "phone") {
			if str, ok := v.(string); ok {
				redacted[k] = te.redactPhone(str)
			} else {
				redacted[k] = te.redactValue(v)
			}
		} else {
			redacted[k] = te.redactValue(v)
		}
	}
	return redacted
}

func (te *TraceEmitter) redactValue(value interface{}) interface{} {
	if str, ok := value.(string); ok {
		if strings.Contains(str, "@") && strings.Contains(str, ".") {
			return te.redactEmail(str)
		}
		if te.isIPAddress(str) {
			return te.redactIP(str)
		}
	}
	return value
}

func (te *TraceEmitter) redactPIIValue(value *string) *string {
	if value == nil {
		return nil
	}
	str := *value
	if strings.Contains(str, "@") && strings.Contains(str, ".") {
		redacted := te.redactEmail(str)
		return &redacted
	}
	if te.isIPAddress(str) {
		redacted := te.redactIP(str)
		return &redacted
	}
	return value
}

func (te *TraceEmitter) redactEmail(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return "***@***"
	}
	local := parts[0]
	domain := parts[1]
	redactedLocal := "*"
	if len(local) > 1 {
		redactedLocal = string(local[0]) + strings.Repeat("*", min(len(local)-1, 3))
	}
	return fmt.Sprintf("%s@%s", redactedLocal, domain)
}

func (te *TraceEmitter) redactIP(ip string) string {
	parts := strings.Split(ip, ".")
	if len(parts) == 4 {
		return fmt.Sprintf("%s.%s.xxx.xxx", parts[0], parts[1])
	}
	return "xxx.xxx.xxx.xxx"
}

func (te *TraceEmitter) redactPhone(phone string) string {
	if len(phone) > 4 {
		return strings.Repeat("*", len(phone)-4) + phone[len(phone)-4:]
	}
	return "****"
}

func (te *TraceEmitter) isForbiddenKey(key string) bool {
	forbidden := []string{
		"password", "password_hash", "secret", "api_key", "apikey",
		"access_token", "accesstoken", "refresh_token", "refreshtoken",
		"private_key", "privatekey", "credit_card", "creditcard",
		"ssn", "social_security",
	}
	for _, f := range forbidden {
		if strings.Contains(key, f) {
			return true
		}
	}
	return false
}

func (te *TraceEmitter) isIPAddress(str string) bool {
	ipRegex := regexp.MustCompile(`^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$`)
	return ipRegex.MatchString(str)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
