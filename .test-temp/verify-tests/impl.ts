
export class User {
  constructor(
    public id: string,
    public name: string,
    public email: string
  ) {}
}

export function createUser(input: { name: string; email: string }): User {
  return new User(
    crypto.randomUUID(),
    input.name,
    input.email
  );
}
