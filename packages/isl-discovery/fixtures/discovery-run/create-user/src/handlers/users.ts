
export async function createUser(input: { email: string }) {
  return { id: '1', email: input.email };
}
