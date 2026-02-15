export interface Event {
  id: string;
  name: string;
  payload: string;
  timestamp: string;
}

export function TrackEvent(input: { name: string; payload: string }): Event {
  if (!input.name || input.name.length === 0) {
    throw new Error('INVALID_EVENT');
  }
  return {
    id: crypto.randomUUID(),
    name: input.name,
    payload: input.payload,
    timestamp: new Date().toISOString(),
  };
}
