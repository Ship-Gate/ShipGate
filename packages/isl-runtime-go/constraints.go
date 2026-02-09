package islruntime

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
)

// BehaviorConstraint represents constraints for a behavior
type BehaviorConstraint struct {
	Name          string   `json:"name"`
	Preconditions []string `json:"preconditions"`
	Postconditions []string `json:"postconditions"`
	Invariants    []string `json:"invariants"`
}

// DomainConstraints represents constraints for a domain
type DomainConstraints struct {
	Domain          string               `json:"domain"`
	Behaviors       []BehaviorConstraint  `json:"behaviors"`
	GlobalInvariants []string            `json:"global_invariants"`
}

// ConstraintLoader loads ISL constraints from files or compiled JSON
type ConstraintLoader struct{}

// NewConstraintLoader creates a new constraint loader
func NewConstraintLoader() *ConstraintLoader {
	return &ConstraintLoader{}
}

// LoadFromFile loads constraints from an ISL spec file
//
// Note: This is a simplified parser. For full ISL parsing, use the TypeScript parser
// and export to JSON format, then use LoadFromJSON.
func (cl *ConstraintLoader) LoadFromFile(path string) (*DomainConstraints, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}
	return cl.parseISL(string(content))
}

// LoadFromJSON loads constraints from compiled JSON format
func (cl *ConstraintLoader) LoadFromJSON(path string) (*DomainConstraints, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}
	var constraints DomainConstraints
	if err := json.Unmarshal(content, &constraints); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}
	return &constraints, nil
}

func (cl *ConstraintLoader) parseISL(content string) (*DomainConstraints, error) {
	domain := "Unknown"
	var behaviors []BehaviorConstraint
	var globalInvariants []string

	lines := strings.Split(content, "\n")
	inBehavior := false
	var currentBehavior *BehaviorConstraint

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "domain ") {
			parts := strings.Fields(line)
			if len(parts) > 1 {
				domain = parts[1]
			}
		} else if strings.HasPrefix(line, "behavior ") {
			if currentBehavior != nil {
				behaviors = append(behaviors, *currentBehavior)
			}
			parts := strings.Fields(line)
			name := ""
			if len(parts) > 1 {
				name = parts[1]
			}
			currentBehavior = &BehaviorConstraint{
				Name:          name,
				Preconditions: []string{},
				Postconditions: []string{},
				Invariants:    []string{},
			}
			inBehavior = true
		} else if inBehavior && currentBehavior != nil {
			if strings.Contains(line, "precondition") || strings.Contains(line, "pre ") {
				if expr := cl.extractExpression(line); expr != "" {
					currentBehavior.Preconditions = append(currentBehavior.Preconditions, expr)
				}
			} else if strings.Contains(line, "postcondition") || strings.Contains(line, "post ") {
				if expr := cl.extractExpression(line); expr != "" {
					currentBehavior.Postconditions = append(currentBehavior.Postconditions, expr)
				}
			} else if strings.Contains(line, "invariant") {
				if expr := cl.extractExpression(line); expr != "" {
					currentBehavior.Invariants = append(currentBehavior.Invariants, expr)
				}
			}
			if line == "}" {
				inBehavior = false
			}
		} else if strings.HasPrefix(line, "invariant ") {
			if expr := cl.extractExpression(line); expr != "" {
				globalInvariants = append(globalInvariants, expr)
			}
		}
	}

	if currentBehavior != nil {
		behaviors = append(behaviors, *currentBehavior)
	}

	if domain == "" {
		domain = "Unknown"
	}

	return &DomainConstraints{
		Domain:          domain,
		Behaviors:       behaviors,
		GlobalInvariants: globalInvariants,
	}, nil
}

func (cl *ConstraintLoader) extractExpression(line string) string {
	keywords := []string{"precondition", "postcondition", "invariant", "pre ", "post "}
	for _, keyword := range keywords {
		if idx := strings.Index(line, keyword); idx != -1 {
			expr := strings.TrimSpace(line[idx+len(keyword):])
			if expr != "" && !strings.HasPrefix(expr, "{") {
				return expr
			}
		}
	}
	return ""
}
