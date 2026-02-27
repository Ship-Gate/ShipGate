// Even good code with an empty spec should produce 0/NO_SHIP.
// An empty spec has no behaviors to verify — no evidence can be produced.

export interface Widget {
  id: string;
  name: string;
}

export function createWidget(name: string): Widget {
  if (!name) throw new Error('Name required');
  return { id: crypto.randomUUID(), name };
}
