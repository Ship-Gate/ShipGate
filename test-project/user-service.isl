# User Service Specification

behavior CreateUser {
  input: userData { name: string, email: string }
  output: user { id: string, name: string, email: string }
  preconditions:
    - userData.name is non-empty string
    - userData.email is valid email format
  postconditions:
    - returned user.id is unique
    - returned user.name equals input userData.name
    - returned user.email equals input userData.email
}

behavior GetUser {
  input: id { string }
  output: user { id: string, name: string, email: string } | null
  preconditions:
    - id is non-empty string
  postconditions:
    - if user exists, returned user.id equals input id
    - if user doesn't exist, returns null
}

behavior DeleteUser {
  input: id { string }
  output: success { boolean }
  preconditions:
    - id is non-empty string
  postconditions:
    - returns true if user was deleted
    - returns false if user didn't exist
}
