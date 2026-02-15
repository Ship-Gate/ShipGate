export class AppError extends Error {
  public statusCode: number;
  public code: string;
  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidPriorityError extends AppError {
  constructor() {
    super('Priority must be between 1 and 5', 400, 'INVALID_PRIORITY');
  }
}

export class DuplicateEmailError extends AppError {
  constructor() {
    super('Email already registered', 400, 'DUPLICATE_EMAIL');
  }
}

export class InvalidUsernameError extends AppError {
  constructor() {
    super('Username is too short', 400, 'INVALID_USERNAME');
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super('Unauthorized', 401, 'UNAUTHORIZED');
  }
}