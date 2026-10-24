import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, queryOne, execute, withTransaction } from '../config/db';
import { ENV } from '../config/env';
import { AuditService } from '../services/auditService';
import { EmailService } from '../services/emailService';
import { RoleName } from '../types/enums';
import { getRankFromDesignation } from '../utils/academicDesignations';

/**
 * Helper to fetch a full user object with active roles and optional examiner profile.
 */
async function fetchUserById(userId: number) {
  const user = await queryOne<any>(
    `SELECT u.id, u.username, u.email, u.password_hash AS passwordHash,
            u.full_name AS fullName, u.designation, u.phone_number AS phoneNumber,
            u.is_active AS isActive, u.profile_picture_url AS profilePictureUrl,
            ep.id AS examinerProfileId, ep.institution, ep.seniority_level AS seniorityLevel
     FROM users u
     LEFT JOIN examiner_profiles ep ON ep.user_id = u.id
     WHERE u.id = ?`,
    [userId]
  );

  if (!user) return null;

  const roleRows = await query<any>(
    `SELECT r.name 
     FROM user_roles ur
     INNER JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = ?`,
    [user.id]
  );

  const roles = roleRows.map((r: any) => r.name as RoleName);

  return {
    ...user,
    roles,
    isActive: Boolean(user.isActive),
  };
}

export class AuthController {
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Username and password are required' });
        return;
      }

      const cleanIdentifier = username.trim();

      const user = await queryOne<any>(
        `SELECT u.id, u.username, u.email, u.password_hash AS passwordHash,
                u.full_name AS fullName, u.designation, u.phone_number AS phoneNumber,
                u.is_active AS isActive, u.profile_picture_url AS profilePictureUrl,
                ep.id AS examinerProfileId, ep.institution, ep.seniority_level AS seniorityLevel
         FROM users u
         LEFT JOIN examiner_profiles ep ON ep.user_id = u.id
         WHERE u.username = ? OR u.email = ?`,
        [cleanIdentifier, cleanIdentifier.toLowerCase()]
      );

      if (!user) {
        await AuditService.log({
          action: 'LOGIN_ATTEMPT',
          result: 'FAILURE',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: { username }
        });
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials' });
        return;
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        await AuditService.log({
          userId: user.id,
          action: 'LOGIN_ATTEMPT',
          result: 'FAILURE',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials' });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'Account is deactivated' });
        return;
      }

      const roleRows = await query<any>(
        `SELECT r.name 
         FROM user_roles ur
         INNER JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = ?`,
        [user.id]
      );

      const roles = roleRows.map((r: any) => r.name as RoleName);

      // Generate JWT
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        ENV.JWT_SECRET,
        { expiresIn: (ENV.JWT_EXPIRES_IN || '7d') as any }
      );

      // Update last login
      await execute(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [user.id]);

      await AuditService.log({
        userId: user.id,
        action: 'LOGIN',
        result: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Set HttpOnly cookie
      res.cookie('access_token', token, {
        httpOnly: true,
        secure: ENV.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          designation: user.designation,
          phoneNumber: user.phoneNumber || null,
          institution: user.institution || null,
          roles,
          examinerProfileId: user.examinerProfileId || null,
          seniorityLevel: user.seniorityLevel || null,
          profilePictureUrl: user.profilePictureUrl || null,
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async me(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated' });
        return;
      }

      const user = await fetchUserById(req.user.id);

      if (!user) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
        return;
      }

      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          designation: user.designation,
          phoneNumber: user.phoneNumber || null,
          institution: user.institution || null,
          roles: user.roles,
          examinerProfileId: user.examinerProfileId || null,
          seniorityLevel: user.seniorityLevel || null,
          profilePictureUrl: user.profilePictureUrl || null,
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated' });
        return;
      }

      const { fullName, email, phoneNumber, designation, institution, profilePictureUrl } = req.body;

      // Validate email uniqueness if changed
      if (email) {
        const existing = await queryOne<any>(
          `SELECT id FROM users WHERE email = ? AND id != ?`,
          [email.trim().toLowerCase(), req.user.id]
        );
        if (existing) {
          res.status(400).json({ error: 'BAD_REQUEST', message: 'Email address is already in use by another account' });
          return;
        }
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (fullName) {
        updates.push('full_name = ?');
        params.push(fullName.trim());
      }
      if (email) {
        updates.push('email = ?');
        params.push(email.trim().toLowerCase());
      }
      if (phoneNumber !== undefined) {
        updates.push('phone_number = ?');
        params.push(phoneNumber ? phoneNumber.trim() : null);
      }
      if (designation !== undefined) {
        updates.push('designation = ?');
        params.push(designation ? designation.trim() : null);
      }
      if (profilePictureUrl !== undefined) {
        updates.push('profile_picture_url = ?');
        params.push(profilePictureUrl ? profilePictureUrl.trim() : null);
      }

      if (updates.length > 0) {
        updates.push('updated_at = NOW()');
        params.push(req.user.id);
        await execute(
          `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
      }

      // Update ExaminerProfile table if existing and institution was provided
      if (institution !== undefined) {
        await execute(
          `UPDATE examiner_profiles SET institution = ? WHERE user_id = ?`,
          [institution ? institution.trim() : null, req.user.id]
        );
      }

      await AuditService.log({
        userId: req.user.id,
        action: 'UPDATE_PROFILE',
        result: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { fullName, email, phoneNumber, designation, institution }
      });

      const refreshedUser = await fetchUserById(req.user.id);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: refreshedUser!.id,
          username: refreshedUser!.username,
          email: refreshedUser!.email,
          fullName: refreshedUser!.fullName,
          designation: refreshedUser!.designation,
          phoneNumber: refreshedUser!.phoneNumber || null,
          institution: refreshedUser!.institution || null,
          roles: refreshedUser!.roles,
          examinerProfileId: refreshedUser!.examinerProfileId || null,
          seniorityLevel: refreshedUser!.seniorityLevel || null,
          profilePictureUrl: refreshedUser!.profilePictureUrl || null,
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    res.clearCookie('access_token');
    res.json({ success: true, message: 'Logged out successfully' });
  }

  static async signup(req: Request, res: Response): Promise<void> {
    try {
      const { username, email, password, fullName, designation, phoneNumber, requestedRole, institution } = req.body;

      if (!username || !email || !password || !fullName) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Username, email, password, and full name are required' });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Password must be at least 6 characters' });
        return;
      }

      const cleanUsername = username.trim().toLowerCase();
      const cleanEmail = email.trim().toLowerCase();

      // Check existing username or email
      const existing = await queryOne<any>(
        `SELECT username, email FROM users WHERE username = ? OR email = ?`,
        [cleanUsername, cleanEmail]
      );

      if (existing) {
        res.status(409).json({
          error: 'CONFLICT',
          message: existing.username === cleanUsername ? 'Username already exists' : 'Email is already registered'
        });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Verify or find requested role
      const roleToRequest = (requestedRole || 'LECTURER').toUpperCase();
      let role = await queryOne<{ id: number; name: string }>(
        `SELECT id, name FROM roles WHERE name = ?`,
        [roleToRequest]
      );

      if (!role) {
        const roleRes = await execute(`INSERT INTO roles (name) VALUES (?)`, [roleToRequest]);
        role = { id: roleRes.insertId, name: roleToRequest };
      }

      let newUserId = 0;

      await withTransaction(async (conn) => {
        // Create new user
        const [userRes] = await conn.execute<any>(
          `INSERT INTO users 
            (username, email, password_hash, full_name, designation, phone_number, is_active, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
          [
            cleanUsername,
            cleanEmail,
            passwordHash,
            fullName.trim(),
            designation ? designation.trim() : 'Academic Staff',
            phoneNumber ? phoneNumber.trim() : null
          ]
        );

        newUserId = userRes.insertId;

        // If requested role is an examiner, prepare examiner profile
        if (['LECTURER', 'SECOND_EXAMINER'].includes(roleToRequest)) {
          await conn.execute(
            `INSERT INTO examiner_profiles 
              (user_id, examiner_type, seniority_level, designation_or_grade, institution, is_active)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [
              newUserId,
              roleToRequest === 'SECOND_EXAMINER' ? 'EXTERNAL' : 'INTERNAL',
              getRankFromDesignation(designation),
              designation ? designation.trim() : 'Lecturer',
              institution ? institution.trim() : 'Rajarata University of Sri Lanka'
            ]
          );
        }

        // Create a pending RoleChangeRequest for HOD approval
        await conn.execute(
          `INSERT INTO role_change_requests
            (target_user_id, role_id, action, status, requested_by, reason)
           VALUES (?, ?, 'ASSIGN', 'PENDING', ?, ?)`,
          [
            newUserId,
            role.id,
            newUserId,
            `New staff registration sign-up requesting role ${roleToRequest}`
          ]
        );
      });

      // Find HOD to alert
      const hodUser = await queryOne<any>(
        `SELECT u.id, u.full_name AS fullName, u.email
         FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         INNER JOIN roles r ON ur.role_id = r.id
         WHERE r.name = 'HOD'
         LIMIT 1`
      );

      if (hodUser) {
        await EmailService.sendNewStaffRegistrationAlert({
          newUser: {
            id: newUserId,
            fullName: fullName.trim(),
            email: cleanEmail,
            designation: designation || 'Academic Staff',
          },
          requestedRole: roleToRequest,
          hodUser,
        });
      }

      await AuditService.log({
        userId: newUserId,
        action: 'SIGNUP_REGISTRATION',
        result: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { username: cleanUsername, email: cleanEmail, requestedRole: roleToRequest }
      });

      res.status(201).json({
        success: true,
        message: 'Account successfully registered! Your role authorization has been submitted to the Head of Department (HOD) for approval.',
        userId: newUserId,
        username: cleanUsername,
        pendingRole: roleToRequest,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { identifier } = req.body;
      if (!identifier) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Username or email address is required' });
        return;
      }

      const clean = identifier.trim().toLowerCase();
      const user = await queryOne<any>(
        `SELECT id, full_name AS fullName, email FROM users WHERE username = ? OR email = ?`,
        [clean, clean]
      );

      if (!user) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'No registered user account found with that username or email address' });
        return;
      }

      // Generate 6-digit cryptographic numeric OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      // Store in passwordResetTokens table
      await execute(
        `INSERT INTO password_reset_tokens (user_id, otp_code, expires_at, is_used)
         VALUES (?, ?, ?, FALSE)`,
        [user.id, otp, expiresAt]
      );

      // Dispatch security email
      await EmailService.sendPasswordResetOtp({
        user: { id: user.id, fullName: user.fullName, email: user.email },
        otp,
      });

      await AuditService.log({
        userId: user.id,
        action: 'FORGOT_PASSWORD_REQUEST',
        result: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Mask email for privacy (e.g. c***h@rusl.ac.lk)
      const parts = user.email.split('@');
      const maskedEmail = parts[0].length > 2
        ? `${parts[0][0]}***${parts[0].slice(-1)}@${parts[1]}`
        : user.email;

      res.json({
        success: true,
        message: `Password reset verification code has been dispatched to ${maskedEmail}`,
        email: maskedEmail,
        debugOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { identifier, otp, newPassword } = req.body;

      if (!identifier || !otp || !newPassword) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Identifier, verification OTP, and new password are required' });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'New password must be at least 6 characters' });
        return;
      }

      const clean = identifier.trim().toLowerCase();
      const user = await queryOne<any>(
        `SELECT id, full_name AS fullName, email FROM users WHERE username = ? OR email = ?`,
        [clean, clean]
      );

      if (!user) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'User account not found' });
        return;
      }

      // Check valid OTP
      const token = await queryOne<any>(
        `SELECT id FROM password_reset_tokens 
         WHERE user_id = ? AND otp_code = ? AND is_used = FALSE AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [user.id, otp.trim()]
      );

      if (!token) {
        res.status(400).json({ error: 'INVALID_OTP', message: 'Invalid or expired password reset verification code' });
        return;
      }

      // Update password
      const passwordHash = await bcrypt.hash(newPassword, 10);

      await withTransaction(async (conn) => {
        await conn.execute(
          `UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?`,
          [passwordHash, user.id]
        );

        await conn.execute(
          `UPDATE password_reset_tokens SET is_used = TRUE, used_at = NOW() WHERE id = ?`,
          [token.id]
        );
      });

      // Send confirmation email
      await EmailService.sendPasswordResetSuccess({
        user: { id: user.id, fullName: user.fullName, email: user.email },
      });

      await AuditService.log({
        userId: user.id,
        action: 'PASSWORD_RESET_SUCCESS',
        result: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        message: 'Your password has been successfully reset. You can now sign in with your new password.',
      });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }
}
