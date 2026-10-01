// Changes are recorded under one fixed name: there is no per-person name any more.
export const ACTOR = "Kaif";

// Kept so edit screens that ask for the acting name keep working; it is always available.
export function requireActor(): string {
  return ACTOR;
}
