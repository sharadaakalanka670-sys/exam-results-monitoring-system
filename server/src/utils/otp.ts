import crypto from 'crypto';

/**
 * Generates a cryptographically secure 6-digit numeric OTP string.
 */
export function generateRandomOtp(): string {
  // Use crypto.randomInt to generate a value between 100000 and 999999
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

/**
 * Computes a SHA-256 hash of the OTP for secure database storage.
 * Never store or log plaintext OTPs.
 */
export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp.trim()).digest('hex');
}

/**
 * Validates candidate OTP against stored hash.
 */
export function verifyOtpHash(candidateOtp: string, storedHash: string): boolean {
  const candidateHash = hashOtp(candidateOtp);
  return crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(storedHash));
}

/**
 * Default OTP parameters
 */
export const OTP_CONFIG = {
  EXPIRY_MINUTES: 10,
  MAX_ATTEMPTS: 5,
};
