// Simple user service for testing
interface User {
  id: string;
  name: string;
  email: string;
}

export class UserService {
  private users: Map<string, User> = new Map();

  createUser(userData: { name: string; email: string }): { id: string; name: string; email: string } {
    const id = Math.random().toString(36).substring(7);
    const user = { id, ...userData };
    this.users.set(id, user);
    return user;
  }

  getUser(id: string): User | null {
    return this.users.get(id) || null;
  }

  deleteUser(id: string): boolean {
    return this.users.delete(id);
  }
}
