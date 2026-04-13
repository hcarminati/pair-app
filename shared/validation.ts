export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

export function normalizeTag(label: string): string {
  return label.trim().toLowerCase();
}
