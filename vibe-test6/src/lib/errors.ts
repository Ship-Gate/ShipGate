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
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UserNotFoundError extends AppError {
  constructor() {
    super('Assignee user does not exist', 404, 'USER_NOT_FOUND');
    Object.setPrototypeOf(this, new.target.prototype);
  }
}