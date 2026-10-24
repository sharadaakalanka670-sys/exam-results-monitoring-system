import { queryOne, execute } from '../config/db';
import { generateRandomOtp, hashOtp, verifyOtpHash, OTP_CONFIG } from '../utils/otp';
import { OtpActionType } from '../types/enums';

export class OtpService {
  /**
   * Generates a single-use 6-digit OTP for physical handover verification.
   * Returns plaintext OTP to the requester once; stores only the SHA-256 hash.
   */
  static async requestOtp(
    examScheduleId: number,
    requesterUserId: number,
    actionType: OtpActionType
  ): Promise<{ otp: string; expiresAt: Date; transactionId: number }> {
    // Invalidate any existing active OTPs for this schedule & action
    await execute(
      `UPDATE otp_transactions
       SET invalidated_at = NOW()
       WHERE exam_schedule_id = ? 
         AND action_type = ? 
         AND verified_at IS NULL 
         AND invalidated_at IS NULL`,
      [examScheduleId, actionType]
    );

    const plaintextOtp = generateRandomOtp();
    const codeHash = hashOtp(plaintextOtp);
    const expiresAt = new Date(Date.now() + OTP_CONFIG.EXPIRY_MINUTES * 60 * 1000);

    const result = await execute(
      `INSERT INTO otp_transactions
        (exam_schedule_id, requester_user_id, action_type, code_hash, expires_at, attempt_count)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [examScheduleId, requesterUserId, actionType, codeHash, expiresAt]
    );

    return {
      otp: plaintextOtp,
      expiresAt,
      transactionId: result.insertId
    };
  }

  /**
   * Verifies an OTP provided by the AR Office user.
   * Enforces attempt limits, expiration, single-use, and timing-safe hash comparison.
   */
  static async verifyOtp(
    examScheduleId: number,
    actionType: OtpActionType,
    candidateOtp: string,
    verifierUserId: number
  ): Promise<{ success: boolean; message: string }> {
    // Find latest active OTP transaction
    const transaction = await queryOne<any>(
      `SELECT id, code_hash AS codeHash, expires_at AS expiresAt, attempt_count AS attemptCount
       FROM otp_transactions
       WHERE exam_schedule_id = ?
         AND action_type = ?
         AND verified_at IS NULL
         AND invalidated_at IS NULL
       ORDER BY generated_at DESC
       LIMIT 1`,
      [examScheduleId, actionType]
    );

    if (!transaction) {
      return {
        success: false,
        message: 'No active OTP request found for this handover action. Please request a new OTP.'
      };
    }

    // Check expiration
    if (new Date() > new Date(transaction.expiresAt)) {
      await execute(
        `UPDATE otp_transactions SET invalidated_at = NOW() WHERE id = ?`,
        [transaction.id]
      );
      return {
        success: false,
        message: 'The OTP has expired. Please ask the examiner to generate a fresh OTP.'
      };
    }

    // Check attempts limit
    if (transaction.attemptCount >= OTP_CONFIG.MAX_ATTEMPTS) {
      await execute(
        `UPDATE otp_transactions SET invalidated_at = NOW() WHERE id = ?`,
        [transaction.id]
      );
      return {
        success: false,
        message: 'Maximum OTP verification attempts exceeded. This OTP has been invalidated.'
      };
    }

    // Increment attempt count
    await execute(
      `UPDATE otp_transactions SET attempt_count = attempt_count + 1 WHERE id = ?`,
      [transaction.id]
    );

    // Check hash match
    const isValid = verifyOtpHash(candidateOtp, transaction.codeHash);

    if (!isValid) {
      const remainingAttempts = OTP_CONFIG.MAX_ATTEMPTS - (transaction.attemptCount + 1);
      return {
        success: false,
        message: `Incorrect OTP. ${Math.max(0, remainingAttempts)} attempt(s) remaining.`
      };
    }

    // Successful verification
    await execute(
      `UPDATE otp_transactions 
       SET verified_at = NOW(), verified_by_user_id = ? 
       WHERE id = ?`,
      [verifierUserId, transaction.id]
    );

    return {
      success: true,
      message: 'OTP verified successfully.'
    };
  }
}
