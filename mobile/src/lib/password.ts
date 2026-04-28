export type PasswordChecks = {
  minLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  allPassed: boolean;
};

const SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/;

export function validatePassword(pw: string): PasswordChecks {
  const minLength = pw.length >= 8;
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  const hasSpecial = SPECIAL_CHARS.test(pw);
  return {
    minLength,
    hasLetter,
    hasNumber,
    hasSpecial,
    allPassed: minLength && hasLetter && hasNumber && hasSpecial,
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}
