// Auto-generated from ISL specification
// DO NOT EDIT MANUALLY

package auth

import (
	"time"
)

type User struct {
	Id string `json:"id"`
	Email string `json:"email"`
	PasswordHash string `json:"password_hash"`
	Status UserStatus `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type Session struct {
	Id string `json:"id"`
	UserId string `json:"user_id"`
	ExpiresAt time.Time `json:"expires_at"`
	Revoked bool `json:"revoked"`
}

type LoginHandler interface {
	Login(input interface{}) (Session, error)
}

type RegisterHandler interface {
	Register(input interface{}) (User, error)
}
