import { addCalendarMonths, calculateFirstMarkingDueDate, calculateSecondMarkingDueDate } from '../src/utils/dates';
import { generateRandomOtp, hashOtp, verifyOtpHash } from '../src/utils/otp';
import { isValidPdfBuffer } from '../src/utils/storage';

// tests for date helpers, otp codes and pdf buffer checks
describe('Business Rules & Utility Unit Tests', () => {
  describe('Calendar Month Calculations', () => {
    test('Standard date plus 3 calendar months preserves day of month', () => {
      const base = new Date('2026-03-15T10:00:00Z');
      const due = calculateFirstMarkingDueDate(base);
      expect(due.getUTCFullYear()).toBe(2026);
      expect(due.getUTCMonth()).toBe(5); // June (0-indexed: 0=Jan, 1=Feb, 2=Mar, 3=Apr, 4=May, 5=Jun)
      expect(due.getUTCDate()).toBe(15);
    });

    test('End of month clamp: Jan 31 + 1 month clamps to Feb 28 in non-leap year (2026)', () => {
      const base = new Date('2026-01-31T00:00:00Z');
      const due = calculateSecondMarkingDueDate(base);
      expect(due.getUTCFullYear()).toBe(2026);
      expect(due.getUTCMonth()).toBe(1); // Feb
      expect(due.getUTCDate()).toBe(28);
    });

    test('End of month clamp: Oct 31 + 3 months gives Jan 31', () => {
      const base = new Date('2026-10-31T00:00:00Z');
      const due = calculateFirstMarkingDueDate(base);
      expect(due.getUTCFullYear()).toBe(2027);
      expect(due.getUTCMonth()).toBe(0); // Jan
      expect(due.getUTCDate()).toBe(31);
    });

    test('End of month clamp: Nov 30 + 3 months gives Feb 28 (2027)', () => {
      const base = new Date('2026-11-30T00:00:00Z');
      const due = calculateFirstMarkingDueDate(base);
      expect(due.getUTCFullYear()).toBe(2027);
      expect(due.getUTCMonth()).toBe(1); // Feb
      expect(due.getUTCDate()).toBe(28);
    });

    test('Second marking exactly 1 calendar month from courier dispatch', () => {
      const dispatch = new Date('2026-08-10T12:00:00Z');
      const due = calculateSecondMarkingDueDate(dispatch);
      expect(due.getUTCFullYear()).toBe(2026);
      expect(due.getUTCMonth()).toBe(8); // September
      expect(due.getUTCDate()).toBe(10);
    });
  });

  describe('OTP Generation and Hashing', () => {
    test('Generated OTP is exactly 6 numeric digits', () => {
      for (let i = 0; i < 20; i++) {
        const otp = generateRandomOtp();
        expect(otp).toMatch(/^[0-9]{6}$/);
      }
    });

    test('OTP hash matches candidate and fails incorrect codes', () => {
      const code = '729104';
      const hash = hashOtp(code);
      expect(hash.length).toBe(64); // SHA-256 hex length
      expect(verifyOtpHash('729104', hash)).toBe(true);
      expect(verifyOtpHash('123456', hash)).toBe(false);
      expect(verifyOtpHash('729105', hash)).toBe(false);
    });
  });

  describe('PDF File Header Validation', () => {
    test('Validates %PDF- signature', () => {
      const validBuffer = Buffer.from('%PDF-1.7\nSome content...');
      expect(isValidPdfBuffer(validBuffer)).toBe(true);
    });

    test('Rejects non-PDF file buffers', () => {
      const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');
      const textBuffer = Buffer.from('Hello world');
      expect(isValidPdfBuffer(exeBuffer)).toBe(false);
      expect(isValidPdfBuffer(textBuffer)).toBe(false);
    });
  });
});
