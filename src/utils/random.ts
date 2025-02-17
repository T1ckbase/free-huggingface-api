export function randomString(length: number): string {
  return [...crypto.getRandomValues(new Uint8Array(length))]
    .map((x, i) => (i = x / 255 * 61 | 0, String.fromCharCode(i + (i > 9 ? i > 35 ? 61 : 55 : 48))))
    .join('');
}

export function randomLowercaseString(length: number): string {
  return [...crypto.getRandomValues(new Uint8Array(length))]
    .map(x => String.fromCharCode(x % 26 + 97))
    .join('');
}

export function randomPassword(length: number): string {
  if (length < 8) {
    throw new Error('Password length must be at least 8 characters.');
  }

  const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
  const numberChars = '0123456789';
  const specialChars = '!@#$%^&*()_+~`|}{[]:;?><,./-=';

  let allChars = uppercaseChars + lowercaseChars + numberChars;
  if (length < 12) {
    allChars += specialChars;
  }

  let password = '';

  // Ensure at least one of each required character type
  password += uppercaseChars.charAt(Math.floor(Math.random() * uppercaseChars.length));
  password += lowercaseChars.charAt(Math.floor(Math.random() * lowercaseChars.length));
  password += numberChars.charAt(Math.floor(Math.random() * numberChars.length));
  if (length < 12) {
    password += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
  }

  // Fill the rest of the password with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  // Shuffle the password to mix the guaranteed characters
  password = password.split('').sort(() => Math.random() - 0.5).join('');

  return password;
}