export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  // Line 5: ISSUE - type-mismatch, declared as string but used as Date elsewhere
  createdAt: string;
}
