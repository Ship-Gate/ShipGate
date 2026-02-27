// BAD: AI proposed a spec but tests don't validate the implementation
// Missing error handling, wrong return shape

export function TrackEvent(input: { name: string; payload: string }): string {
  // Returns string instead of Event — no validation at all
  return `tracked:${input.name}`;
}
