// Phase-later. Form validation helpers for app/(auth)/* and settings forms.
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
