// src/utils/validators.js

/**
 * Validates email format.
 * Matches the same regex used in the backend.
 */
export const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

/**
 * Returns an array of password rules with their pass/fail status.
 * Used to render the live checklist as the user types.
 */
export const getPasswordRules = (password) => {
  const pwd = password || '';
  return [
    { label: 'At least 8 characters',                passed: pwd.length >= 8 },
    { label: 'At least one uppercase letter (A-Z)',  passed: /[A-Z]/.test(pwd) },
    { label: 'At least one lowercase letter (a-z)',  passed: /[a-z]/.test(pwd) },
    { label: 'At least one number (0-9)',            passed: /[0-9]/.test(pwd) },
    {
      label: 'At least one special character (!@#$ ...)',
      passed: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pwd)
    }
  ];
};

/**
 * Returns true only if every password rule passes.
 */
export const isPasswordValid = (password) => {
  return getPasswordRules(password).every(rule => rule.passed);
};