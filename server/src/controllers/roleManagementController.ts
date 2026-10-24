import { Request, Response } from 'express';
import { query, queryOne, execute } from '../config/db';
import { RoleName } from '../types/enums';
import { AuditService } from '../services/auditService';
import { EmailService } from '../services/emailService';
import { getRankFromDesignation } from '../utils/academicDesignations';

export class RoleManagementController {
  /**
   * 1. List all users with their roles and pending requests.
   * Accessible to: HOD, HOD_CLERK.
   */
  static async listUsers(req: Request, res: Response): Promise<void> {
    try {
      // 1. Fetch all users with examiner profile details
      const users = await query<any>(
        `SELECT 
           u.id,
           u.username,
           u.email,
           u.full_name AS fullName,
           u.designation,
           u.phone_number AS phoneNumber,
           u.is_active AS isActive,
           u.profile_picture_url AS profilePictureUrl,
           ep.id AS examinerProfileId,
           ep.institution,
           ep.examiner_type AS examinerType,
           ep.seniority_level AS seniorityLevel,
           ep.seniority_approved_at AS seniorityApprovedAt
         FROM users u
         LEFT JOIN examiner_profiles ep ON ep.user_id = u.id
         ORDER BY u.full_name ASC`
      );

      // 2. Fetch all user roles in a single batch
      const userRoles = await query<any>(
        `SELECT ur.user_id AS userId, r.name AS roleName
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id`
      );

      const rolesByUserId: Record<number, string[]> = {};
      for (const ur of userRoles) {
        if (!rolesByUserId[ur.userId]) {
          rolesByUserId[ur.userId] = [];
        }
        rolesByUserId[ur.userId].push(ur.roleName);
      }

      // 3. Fetch all pending role requests in a single batch
      const pendingRequests = await query<any>(
        `SELECT 
           rcr.id,
           rcr.target_user_id AS targetUserId,
           rcr.action,
           rcr.status,
           rcr.reason,
           rcr.created_at AS createdAt,
           r.name AS roleName,
           req_u.full_name AS requestedByFullName
         FROM role_change_requests rcr
         JOIN roles r ON rcr.role_id = r.id
         LEFT JOIN users req_u ON rcr.requested_by = req_u.id
         WHERE rcr.status = 'PENDING'`
      );

      const requestsByUserId: Record<number, any[]> = {};
      for (const pr of pendingRequests) {
        if (!requestsByUserId[pr.targetUserId]) {
          requestsByUserId[pr.targetUserId] = [];
        }
        requestsByUserId[pr.targetUserId].push({
          id: pr.id,
          roleName: pr.roleName,
          action: pr.action,
          status: pr.status,
          requestedBy: pr.requestedByFullName || 'Self Registration',
          reason: pr.reason,
          createdAt: pr.createdAt,
        });
      }

      const formatted = users.map((u: any) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        fullName: u.fullName,
        designation: u.designation,
        phoneNumber: u.phoneNumber,
        isActive: Boolean(u.isActive),
        profilePictureUrl: u.profilePictureUrl,
        institution: u.institution || null,
        examinerType: u.examinerType || 'INTERNAL',
        seniorityLevel: u.seniorityLevel || null,
        isVerified: !!u.seniorityApprovedAt,
        examinerProfileId: u.examinerProfileId || null,
        roles: rolesByUserId[u.id] || [],
        pendingRequests: requestsByUserId[u.id] || [],
      }));

      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * 2. List all available roles in the system.
   * Accessible to: HOD, HOD_CLERK.
   */
  static async listRoles(req: Request, res: Response): Promise<void> {
    try {
      const roles = await query<any>(
        `SELECT id, name, created_at AS createdAt
         FROM roles
         ORDER BY name ASC`
      );
      res.json(roles);
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * 3. Create a new custom role.
   * Accessible to: HOD, HOD_CLERK.
   */
  static async createRole(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Role name is required' });
        return;
      }

      const formattedName = name.trim().toUpperCase().replace(/[\s-]+/g, '_');

      // Check if role exists
      const existing = await queryOne<any>(
        `SELECT id, name FROM roles WHERE name = ?`,
        [formattedName]
      );

      if (existing) {
        res.status(409).json({ error: 'CONFLICT', message: `Role "${formattedName}" already exists` });
        return;
      }

      const insertResult = await execute(
        `INSERT INTO roles (name, created_at) VALUES (?, NOW())`,
        [formattedName]
      );

      const newRole = {
        id: insertResult.insertId,
        name: formattedName,
      };

      await AuditService.log({
        userId: req.user!.id,
        action: 'CREATE_ROLE',
        result: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { roleName: formattedName },
      });

      res.status(201).json({
        success: true,
        message: `Role "${formattedName}" created successfully`,
        role: newRole,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * 4. Request or Modify a User Role.
   * If HOD: immediately applied and approved.
   * If HOD_CLERK: creates a PENDING request for HOD approval.
   */
  static async requestRoleChange(req: Request, res: Response): Promise<void> {
    try {
      const currentUser = req.user!;
      const isHod = currentUser.roles.includes(RoleName.HOD);
      const { targetUserId, roleName, action, reason } = req.body;

      if (!targetUserId || !roleName) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'targetUserId and roleName are required' });
        return;
      }

      const validAction = action === 'REMOVE' ? 'REMOVE' : 'ADD';
      const parsedUserId = parseInt(targetUserId, 10);

      // Find target user
      const targetUser = await queryOne<any>(
        `SELECT id, email, full_name AS fullName, designation FROM users WHERE id = ?`,
        [parsedUserId]
      );

      if (!targetUser) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Target user not found' });
        return;
      }

      const examinerProfile = await queryOne<any>(
        `SELECT id FROM examiner_profiles WHERE user_id = ?`,
        [parsedUserId]
      );

      // Find or create role
      const cleanRoleName = roleName.trim().toUpperCase();
      let role = await queryOne<any>(
        `SELECT id, name FROM roles WHERE name = ?`,
        [cleanRoleName]
      );

      if (!role) {
        const roleInsert = await execute(
          `INSERT INTO roles (name, created_at) VALUES (?, NOW())`,
          [cleanRoleName]
        );
        role = { id: roleInsert.insertId, name: cleanRoleName };
      }

      // If HOD is doing this, direct instant execution!
      if (isHod) {
        if (validAction === 'ADD') {
          const existingUr = await queryOne<any>(
            `SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?`,
            [parsedUserId, role.id]
          );

          if (!existingUr) {
            await execute(
              `INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at) VALUES (?, ?, ?, NOW())`,
              [parsedUserId, role.id, currentUser.id]
            );

            // Ensure ExaminerProfile exists if examiner
            if (['LECTURER', 'SECOND_EXAMINER'].includes(cleanRoleName) && !examinerProfile) {
              const rank = getRankFromDesignation(targetUser.designation);
              await execute(
                `INSERT INTO examiner_profiles 
                  (user_id, examiner_type, seniority_level, designation_or_grade, institution, is_active)
                 VALUES (?, ?, ?, ?, 'Rajarata University of Sri Lanka', TRUE)`,
                [
                  parsedUserId,
                  cleanRoleName === 'SECOND_EXAMINER' ? 'EXTERNAL' : 'INTERNAL',
                  rank,
                  targetUser.designation || 'Lecturer',
                ]
              );
            }
          }
        } else {
          // REMOVE
          await execute(
            `DELETE FROM user_roles WHERE user_id = ? AND role_id = ?`,
            [parsedUserId, role.id]
          );
        }

        // Record approved request
        await execute(
          `INSERT INTO role_change_requests 
             (target_user_id, role_id, action, status, requested_by, reviewed_by, reviewed_at, reason, created_at, updated_at)
           VALUES (?, ?, ?, 'APPROVED', ?, ?, NOW(), ?, NOW(), NOW())`,
          [
            parsedUserId,
            role.id,
            validAction,
            currentUser.id,
            currentUser.id,
            reason || 'Direct HOD administrative role assignment',
          ]
        );

        // Notify staff member
        if (validAction === 'ADD') {
          await EmailService.sendRoleApprovedNotice({
            user: { id: targetUser.id, fullName: targetUser.fullName, email: targetUser.email },
            roleName: cleanRoleName,
            hodName: currentUser.fullName,
          });
        }

        await AuditService.log({
          userId: currentUser.id,
          action: 'DIRECT_ROLE_CHANGE',
          result: 'SUCCESS',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: { targetUserId: targetUser.id, roleName: cleanRoleName, action: validAction },
        });

        res.json({
          success: true,
          message: `Role "${cleanRoleName}" ${validAction === 'ADD' ? 'assigned to' : 'removed from'} ${targetUser.fullName} successfully`,
        });
        return;
      }

      // If CLERK is proposing, create a PENDING request for HOD approval
      const insertReq = await execute(
        `INSERT INTO role_change_requests 
           (target_user_id, role_id, action, status, requested_by, reason, created_at, updated_at)
         VALUES (?, ?, ?, 'PENDING', ?, ?, NOW(), NOW())`,
        [
          parsedUserId,
          role.id,
          validAction,
          currentUser.id,
          reason || 'Proposed by Clerk for departmental examiner adjustment',
        ]
      );

      const newRequest = {
        id: insertReq.insertId,
        targetUserId: parsedUserId,
        roleId: role.id,
        action: validAction,
        status: 'PENDING',
        requestedBy: currentUser.id,
        reason: reason || 'Proposed by Clerk for departmental examiner adjustment',
      };

      // Find HOD to alert
      const hodUser = await queryOne<any>(
        `SELECT u.id, u.email, u.full_name AS fullName
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON ur.role_id = r.id
         WHERE r.name = 'HOD'
         LIMIT 1`
      );

      if (hodUser) {
        await EmailService.sendClerkRoleRequestAlertToHod({
          clerkName: currentUser.fullName,
          targetUserName: targetUser.fullName,
          roleName: cleanRoleName,
          action: validAction,
          hodUser,
          reason,
        });
      }

      await AuditService.log({
        userId: currentUser.id,
        action: 'PROPOSE_ROLE_CHANGE',
        result: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { targetUserId: targetUser.id, roleName: cleanRoleName, action: validAction, requestId: newRequest.id },
      });

      res.status(201).json({
        success: true,
        message: `Role change proposal submitted to Head of Department (HOD) for authorization.`,
        request: newRequest,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * 5. List all role change requests.
   * Accessible to: HOD, HOD_CLERK.
   */
  static async listRequests(req: Request, res: Response): Promise<void> {
    try {
      const rawRequests = await query<any>(
        `SELECT 
           rcr.id,
           rcr.target_user_id AS targetUserId,
           rcr.role_id AS roleId,
           rcr.action,
           rcr.status,
           rcr.requested_by AS requestedBy,
           rcr.reviewed_by AS reviewedBy,
           rcr.reviewed_at AS reviewedAt,
           rcr.reason,
           rcr.review_notes AS reviewNotes,
           rcr.created_at AS createdAt,
           r.id AS r_id,
           r.name AS r_name,
           tu.id AS tu_id,
           tu.full_name AS tu_full_name,
           tu.username AS tu_username,
           tu.email AS tu_email,
           tu.designation AS tu_designation,
           req_u.id AS req_u_id,
           req_u.full_name AS req_u_full_name,
           req_u.username AS req_u_username,
           rev_u.id AS rev_u_id,
           rev_u.full_name AS rev_u_full_name
         FROM role_change_requests rcr
         JOIN roles r ON rcr.role_id = r.id
         JOIN users tu ON rcr.target_user_id = tu.id
         LEFT JOIN users req_u ON rcr.requested_by = req_u.id
         LEFT JOIN users rev_u ON rcr.reviewed_by = rev_u.id
         ORDER BY rcr.created_at DESC`
      );

      const formatted = rawRequests.map((r: any) => ({
        id: r.id,
        targetUserId: r.targetUserId,
        roleId: r.roleId,
        action: r.action,
        status: r.status,
        requestedBy: r.requestedBy,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt,
        reason: r.reason,
        reviewNotes: r.reviewNotes,
        createdAt: r.createdAt,
        role: {
          id: r.r_id,
          name: r.r_name,
        },
        targetUser: {
          id: r.tu_id,
          fullName: r.tu_full_name,
          username: r.tu_username,
          email: r.tu_email,
          designation: r.tu_designation,
        },
        requestedByUser: r.req_u_id ? {
          id: r.req_u_id,
          fullName: r.req_u_full_name,
          username: r.req_u_username,
        } : null,
        reviewedByUser: r.rev_u_id ? {
          id: r.rev_u_id,
          fullName: r.rev_u_full_name,
        } : null,
      }));

      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * 6. HOD Approves Role Request.
   * Accessible to: HOD ONLY.
   */
  static async approveRequest(req: Request, res: Response): Promise<void> {
    try {
      const currentUser = req.user!;
      const requestId = parseInt(req.params.id, 10);
      const { reviewNotes } = req.body;

      const roleReq = await queryOne<any>(
        `SELECT 
           rcr.id,
           rcr.target_user_id AS targetUserId,
           rcr.role_id AS roleId,
           rcr.action,
           rcr.status,
           r.name AS roleName,
           tu.id AS tu_id,
           tu.full_name AS tu_full_name,
           tu.email AS tu_email,
           tu.designation AS tu_designation,
           ep.id AS ep_id
         FROM role_change_requests rcr
         JOIN roles r ON rcr.role_id = r.id
         JOIN users tu ON rcr.target_user_id = tu.id
         LEFT JOIN examiner_profiles ep ON ep.user_id = tu.id
         WHERE rcr.id = ?`,
        [requestId]
      );

      if (!roleReq) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Role request not found' });
        return;
      }

      if (roleReq.status !== 'PENDING') {
        res.status(400).json({ error: 'ALREADY_DECIDED', message: `Request is already ${roleReq.status}` });
        return;
      }

      // Execute role assignment or removal
      if (roleReq.action === 'ADD' || roleReq.action === 'ASSIGN') {
        const existingUr = await queryOne<any>(
          `SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?`,
          [roleReq.targetUserId, roleReq.roleId]
        );

        if (!existingUr) {
          await execute(
            `INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at) VALUES (?, ?, ?, NOW())`,
            [roleReq.targetUserId, roleReq.roleId, currentUser.id]
          );
        }

        // Ensure ExaminerProfile exists if examiner
        if (
          ['LECTURER', 'SECOND_EXAMINER'].includes(roleReq.roleName) &&
          !roleReq.ep_id
        ) {
          const rank = getRankFromDesignation(roleReq.tu_designation);
          await execute(
            `INSERT INTO examiner_profiles 
              (user_id, examiner_type, seniority_level, designation_or_grade, institution, is_active)
             VALUES (?, ?, ?, ?, 'Rajarata University of Sri Lanka', TRUE)`,
            [
              roleReq.targetUserId,
              roleReq.roleName === 'SECOND_EXAMINER' ? 'EXTERNAL' : 'INTERNAL',
              rank,
              roleReq.tu_designation || 'Lecturer',
            ]
          );
        }
      } else if (roleReq.action === 'REMOVE') {
        await execute(
          `DELETE FROM user_roles WHERE user_id = ? AND role_id = ?`,
          [roleReq.targetUserId, roleReq.roleId]
        );
      }

      // Mark request APPROVED
      await execute(
        `UPDATE role_change_requests 
         SET status = 'APPROVED', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?, updated_at = NOW()
         WHERE id = ?`,
        [currentUser.id, reviewNotes || null, requestId]
      );

      const updated = await queryOne<any>(
        `SELECT * FROM role_change_requests WHERE id = ?`,
        [requestId]
      );

      // Dispatch congratulatory/activation notification to staff member
      await EmailService.sendRoleApprovedNotice({
        user: {
          id: roleReq.tu_id,
          fullName: roleReq.tu_full_name,
          email: roleReq.tu_email,
        },
        roleName: roleReq.roleName,
        hodName: currentUser.fullName,
      });

      await AuditService.log({
        userId: currentUser.id,
        action: 'APPROVE_ROLE_REQUEST',
        result: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          requestId,
          targetUserId: roleReq.targetUserId,
          roleName: roleReq.roleName,
          action: roleReq.action,
        },
      });

      res.json({
        success: true,
        message: `Role request for ${roleReq.tu_full_name} (${roleReq.roleName}) APPROVED successfully!`,
        request: updated,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * 7. HOD Rejects Role Request.
   * Accessible to: HOD ONLY.
   */
  static async rejectRequest(req: Request, res: Response): Promise<void> {
    try {
      const currentUser = req.user!;
      const requestId = parseInt(req.params.id, 10);
      const { reason } = req.body;

      const roleReq = await queryOne<any>(
        `SELECT 
           rcr.id,
           rcr.target_user_id AS targetUserId,
           rcr.status,
           r.name AS roleName,
           tu.full_name AS tu_full_name
         FROM role_change_requests rcr
         JOIN roles r ON rcr.role_id = r.id
         JOIN users tu ON rcr.target_user_id = tu.id
         WHERE rcr.id = ?`,
        [requestId]
      );

      if (!roleReq) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Role request not found' });
        return;
      }

      if (roleReq.status !== 'PENDING') {
        res.status(400).json({ error: 'ALREADY_DECIDED', message: `Request is already ${roleReq.status}` });
        return;
      }

      await execute(
        `UPDATE role_change_requests 
         SET status = 'REJECTED', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?, updated_at = NOW()
         WHERE id = ?`,
        [currentUser.id, reason || 'Declined by Head of Department', requestId]
      );

      const updated = await queryOne<any>(
        `SELECT * FROM role_change_requests WHERE id = ?`,
        [requestId]
      );

      await AuditService.log({
        userId: currentUser.id,
        action: 'REJECT_ROLE_REQUEST',
        result: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          requestId,
          targetUserId: roleReq.targetUserId,
          roleName: roleReq.roleName,
          reason,
        },
      });

      res.json({
        success: true,
        message: `Role request for ${roleReq.tu_full_name} rejected.`,
        request: updated,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * 8. HOD Reviews, Verifies, and Edits Member Academic Profile.
   * Accessible to: HOD ONLY.
   */
  static async updateMemberProfile(req: Request, res: Response): Promise<void> {
    try {
      const currentUser = req.user!;
      const memberId = parseInt(req.params.id, 10);
      const { fullName, designation, institution, examinerType, isActive } = req.body;

      const user = await queryOne<any>(
        `SELECT 
           u.id,
           u.full_name AS fullName,
           u.designation,
           u.is_active AS isActive,
           ep.id AS examinerProfileId
         FROM users u
         LEFT JOIN examiner_profiles ep ON ep.user_id = u.id
         WHERE u.id = ?`,
        [memberId]
      );

      if (!user) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Staff member not found.' });
        return;
      }

      const calculatedSeniority = designation ? getRankFromDesignation(designation) : undefined;

      // Update User details
      const userUpdates: string[] = [];
      const userParams: any[] = [];

      if (fullName) {
        userUpdates.push('full_name = ?');
        userParams.push(fullName.trim());
      }
      if (designation) {
        userUpdates.push('designation = ?');
        userParams.push(designation.trim());
      }
      if (isActive !== undefined) {
        userUpdates.push('is_active = ?');
        userParams.push(Boolean(isActive));
      }

      if (userUpdates.length > 0) {
        userUpdates.push('updated_at = NOW()');
        userParams.push(memberId);
        await execute(
          `UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`,
          userParams
        );
      }

      // Update or create ExaminerProfile
      if (user.examinerProfileId) {
        const epUpdates: string[] = [];
        const epParams: any[] = [];

        if (designation) {
          epUpdates.push('designation_or_grade = ?');
          epParams.push(designation.trim());
        }
        if (institution) {
          epUpdates.push('institution = ?');
          epParams.push(institution.trim());
        }
        if (examinerType) {
          epUpdates.push('examiner_type = ?');
          epParams.push(examinerType);
        }
        if (calculatedSeniority !== undefined) {
          epUpdates.push('seniority_level = ?');
          epParams.push(calculatedSeniority);
        }

        epUpdates.push('seniority_approved_by = ?', 'seniority_approved_at = NOW()');
        epParams.push(currentUser.id, user.examinerProfileId);

        await execute(
          `UPDATE examiner_profiles SET ${epUpdates.join(', ')} WHERE id = ?`,
          epParams
        );
      } else if (designation) {
        await execute(
          `INSERT INTO examiner_profiles 
            (user_id, examiner_type, seniority_level, designation_or_grade, institution, seniority_approved_by, seniority_approved_at, is_active)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), TRUE)`,
          [
            memberId,
            examinerType || 'INTERNAL',
            calculatedSeniority || 6,
            designation.trim(),
            institution ? institution.trim() : 'Rajarata University of Sri Lanka',
            currentUser.id,
          ]
        );
      }

      const updatedUser = await queryOne<any>(
        `SELECT id, username, email, full_name AS fullName, designation, is_active AS isActive, updated_at AS updatedAt FROM users WHERE id = ?`,
        [memberId]
      );

      await AuditService.log({
        userId: currentUser.id,
        action: 'VERIFY_AND_UPDATE_EXAMINER_PROFILE',
        result: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          targetUserId: memberId,
          updatedDesignation: designation,
          allocatedRank: calculatedSeniority,
        },
      });

      res.json({
        success: true,
        message: `Academic profile for ${updatedUser.fullName} verified and updated successfully.`,
        user: updatedUser,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }
}
