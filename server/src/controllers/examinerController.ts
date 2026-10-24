import { Request, Response } from 'express';
import { query, queryOne, execute, withTransaction } from '../config/db';
import { ExaminerService } from '../services/examinerService';
import { WorkflowService } from '../services/workflowService';
import { AuditService } from '../services/auditService';
import { ExaminerType, InvitationStatus, RoleName } from '../types/enums';
import { EmailService } from '../services/emailService';

export class ExaminerController {
  static async getCandidates(req: Request, res: Response): Promise<void> {
    try {
      const firstExaminerUserId = req.query.firstExaminerUserId
        ? parseInt(String(req.query.firstExaminerUserId), 10)
        : undefined;

      const candidates = await ExaminerService.getCandidates(firstExaminerUserId);
      res.json(candidates);
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async assignSecondExaminer(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const { secondExaminerProfileId } = req.body;
      const user = req.user!;

      await WorkflowService.assertNotLocked(scheduleId);

      const schedule = await queryOne<any>(
        `SELECT id, first_examiner_user_id AS firstExaminerUserId, workflow_status AS workflowStatus
         FROM exam_schedules WHERE id = ?`,
        [scheduleId]
      );

      if (!schedule || !schedule.firstExaminerUserId) {
        res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Schedule must have an assigned First Examiner before assigning a Second Examiner.'
        });
        return;
      }

      // 1. Validate Seniority (second.seniorityLevel > first.seniorityLevel)
      const seniorityCheck = await ExaminerService.validateSeniority(
        schedule.firstExaminerUserId,
        secondExaminerProfileId
      );

      if (!seniorityCheck.valid) {
        res.status(400).json({
          error: 'SENIORITY_VALIDATION_FAILED',
          message: seniorityCheck.message,
          firstSeniority: seniorityCheck.firstSeniority,
          secondSeniority: seniorityCheck.secondSeniority,
        });
        return;
      }

      // 2. Validate Load Limit (max 3 active subjects)
      const loadCheck = await ExaminerService.validateLoadLimit(secondExaminerProfileId, scheduleId);
      if (!loadCheck.valid) {
        res.status(400).json({
          error: 'LOAD_LIMIT_EXCEEDED',
          message: loadCheck.message,
          activeCount: loadCheck.activeCount,
          maxLimit: loadCheck.maxLimit,
        });
        return;
      }

      // Execute assignment
      await execute(
        `UPDATE exam_schedules SET second_examiner_profile_id = ?, updated_at = NOW() WHERE id = ?`,
        [secondExaminerProfileId, scheduleId]
      );

      const updated = await queryOne<any>(
        `SELECT s.id, s.second_examiner_profile_id AS secondExaminerProfileId,
                ep.id AS se_id, ep.seniority_level AS se_seniorityLevel, ep.designation_or_grade AS se_designationOrGrade,
                u.id AS u_id, u.full_name AS u_fullName, u.email AS u_email, u.designation AS u_designation
         FROM exam_schedules s
         LEFT JOIN examiner_profiles ep ON s.second_examiner_profile_id = ep.id
         LEFT JOIN users u ON ep.user_id = u.id
         WHERE s.id = ?`,
        [scheduleId]
      );

      const secondExaminerObj = updated.se_id
        ? {
            id: updated.se_id,
            seniorityLevel: updated.se_seniorityLevel,
            designationOrGrade: updated.se_designationOrGrade,
            user: {
              id: updated.u_id,
              fullName: updated.u_fullName,
              email: updated.u_email,
              designation: updated.u_designation,
            }
          }
        : null;

      await AuditService.logEvent({
        examScheduleId: scheduleId,
        actorUserId: user.id,
        eventType: 'SECOND_EXAMINER_ASSIGNED',
        fromStatus: schedule.workflowStatus,
        toStatus: schedule.workflowStatus,
        description: `Second Examiner assigned: ${secondExaminerObj?.user.fullName} (${secondExaminerObj?.designationOrGrade || secondExaminerObj?.user.designation || 'Second Examiner'}).`
      });

      res.json({
        id: updated.id,
        secondExaminerProfileId: updated.secondExaminerProfileId,
        secondExaminer: secondExaminerObj,
      });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async listInvitations(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const { scheduleId, status } = req.query;

      const conditions: string[] = [];
      const params: any[] = [];

      if (scheduleId) {
        conditions.push('ei.exam_schedule_id = ?');
        params.push(parseInt(String(scheduleId), 10));
      }
      if (status) {
        conditions.push('ei.status = ?');
        params.push(String(status));
      }

      // Non-HOD users only see invitations for their schedules or directed to them
      const isHod = user.roles.includes(RoleName.HOD);
      if (!isHod) {
        conditions.push('(ei.requested_examiner_profile_id = ? OR ei.requested_email = ? OR ei.requested_by = ? OR s.first_examiner_user_id = ?)');
        params.push(user.examinerProfileId || -1, user.email, user.id, user.id);
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const rows = await query<any>(
        `SELECT ei.id, ei.exam_schedule_id AS examScheduleId, ei.requested_examiner_profile_id AS requestedExaminerProfileId,
                ei.requested_name AS requestedName, ei.requested_email AS requestedEmail,
                ei.requested_affiliation AS requestedAffiliation, ei.examiner_type AS examinerType,
                ei.requested_by AS requestedBy, ei.status, ei.expires_at AS expiresAt,
                ei.responded_at AS respondedAt, ei.hod_decision_by AS hodDecisionBy,
                ei.hod_decision_at AS hodDecisionAt, ei.hod_decision_reason AS hodDecisionReason,
                ei.created_at AS createdAt,

                -- Schedule info
                s.id AS s_id, s.exam_date AS s_examDate, s.workflow_status AS s_workflowStatus,
                fe.id AS fe_id, fe.full_name AS fe_fullName, fe.email AS fe_email,
                c.course_code AS c_courseCode, c.course_title AS c_courseTitle,

                -- Nominee profile info
                ep.id AS ep_id, ep.seniority_level AS ep_seniorityLevel,
                epu.id AS epu_id, epu.full_name AS epu_fullName, epu.email AS epu_email
         FROM examiner_invitations ei
         LEFT JOIN exam_schedules s ON ei.exam_schedule_id = s.id
         LEFT JOIN course_offerings co ON s.course_offering_id = co.id
         LEFT JOIN courses c ON co.course_id = c.id
         LEFT JOIN users fe ON s.first_examiner_user_id = fe.id
         LEFT JOIN examiner_profiles ep ON ei.requested_examiner_profile_id = ep.id
         LEFT JOIN users epu ON ep.user_id = epu.id
         ${whereSql}
         ORDER BY ei.created_at DESC`,
        params
      );

      const formatted = rows.map((r: any) => ({
        id: r.id,
        examScheduleId: r.examScheduleId,
        requestedExaminerProfileId: r.requestedExaminerProfileId,
        requestedName: r.requestedName,
        requestedEmail: r.requestedEmail,
        requestedAffiliation: r.requestedAffiliation,
        examinerType: r.examinerType,
        requestedBy: r.requestedBy,
        status: r.status,
        expiresAt: r.expiresAt,
        respondedAt: r.respondedAt,
        hodDecisionBy: r.hodDecisionBy,
        hodDecisionAt: r.hodDecisionAt,
        hodDecisionReason: r.hodDecisionReason,
        createdAt: r.createdAt,
        examSchedule: r.s_id
          ? {
              id: r.s_id,
              examDate: r.s_examDate,
              workflowStatus: r.s_workflowStatus,
              firstExaminer: r.fe_id
                ? {
                    id: r.fe_id,
                    fullName: r.fe_fullName,
                    email: r.fe_email,
                  }
                : null,
              courseOffering: {
                course: {
                  courseCode: r.c_courseCode || '',
                  courseTitle: r.c_courseTitle || '',
                }
              }
            }
          : null,
        examinerProfile: r.ep_id
          ? {
              id: r.ep_id,
              seniorityLevel: r.ep_seniorityLevel,
              user: r.epu_id
                ? {
                    id: r.epu_id,
                    fullName: r.epu_fullName,
                    email: r.epu_email,
                  }
                : null,
            }
          : null,
      }));

      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async createInvitation(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const {
        requestedExaminerProfileId,
        requestedName,
        requestedEmail,
        requestedAffiliation,
        examinerType
      } = req.body;
      const user = req.user!;

      await WorkflowService.assertNotLocked(scheduleId);

      const schedule = await queryOne<any>(
        `SELECT s.id, s.first_examiner_user_id AS firstExaminerUserId, s.workflow_status AS workflowStatus,
                fe.id AS fe_id, fe.full_name AS fe_fullName, fe.email AS fe_email, fe.designation AS fe_designation,
                c.course_code AS courseCode, c.course_title AS courseTitle, co.batch_label AS batchLabel
         FROM exam_schedules s
         LEFT JOIN users fe ON s.first_examiner_user_id = fe.id
         LEFT JOIN course_offerings co ON s.course_offering_id = co.id
         LEFT JOIN courses c ON co.course_id = c.id
         WHERE s.id = ?`,
        [scheduleId]
      );

      if (!schedule || !schedule.firstExaminerUserId) {
        res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Schedule must have an assigned First Examiner before inviting a Second Examiner.'
        });
        return;
      }

      // If internal examiner, check seniority and load immediately
      let nomineeUser: any = null;
      if (requestedExaminerProfileId) {
        const candidateProfile = await queryOne<any>(
          `SELECT ep.id, ep.user_id, ep.seniority_level, u.id AS u_id, u.full_name, u.email, u.designation
           FROM examiner_profiles ep
           INNER JOIN users u ON ep.user_id = u.id
           WHERE ep.id = ?`,
          [requestedExaminerProfileId]
        );

        if (candidateProfile) {
          nomineeUser = {
            id: candidateProfile.u_id,
            fullName: candidateProfile.full_name,
            email: candidateProfile.email,
            designation: candidateProfile.designation,
          };

          const seniorityCheck = await ExaminerService.validateSeniority(
            schedule.firstExaminerUserId,
            requestedExaminerProfileId
          );
          if (!seniorityCheck.valid) {
            res.status(400).json({
              error: 'SENIORITY_VALIDATION_FAILED',
              message: seniorityCheck.message
            });
            return;
          }

          const loadCheck = await ExaminerService.validateLoadLimit(requestedExaminerProfileId);
          if (!loadCheck.valid) {
            res.status(400).json({
              error: 'LOAD_LIMIT_EXCEEDED',
              message: loadCheck.message
            });
            return;
          }
        }
      }

      const initialStatus = examinerType === ExaminerType.EXTERNAL
        ? InvitationStatus.PENDING_HOD_APPROVAL
        : InvitationStatus.INVITED;

      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

      const insertRes = await execute(
        `INSERT INTO examiner_invitations
          (exam_schedule_id, requested_examiner_profile_id, requested_name, requested_email, requested_affiliation, examiner_type, requested_by, status, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          scheduleId,
          requestedExaminerProfileId || null,
          nomineeUser?.fullName || requestedName,
          nomineeUser?.email || requestedEmail,
          requestedAffiliation || (nomineeUser ? 'Department of Computing, RUSL' : 'External'),
          examinerType || ExaminerType.INTERNAL,
          user.id,
          initialStatus,
          expiresAt
        ]
      );

      const invitation = await queryOne<any>(
        `SELECT * FROM examiner_invitations WHERE id = ?`,
        [insertRes.insertId]
      );

      // Dispatch auto-customized email invitation to nominee if internal or email present
      if (nomineeUser && schedule.fe_fullName) {
        await EmailService.sendSecondExaminerNomination({
          scheduleId,
          courseCode: schedule.courseCode || '',
          courseTitle: schedule.courseTitle || '',
          batchLabel: schedule.batchLabel || '',
          firstExaminerUser: {
            fullName: schedule.fe_fullName,
            designation: schedule.fe_designation || undefined,
          },
          candidateUser: {
            id: nomineeUser.id,
            fullName: nomineeUser.fullName,
            designation: nomineeUser.designation || undefined,
            email: nomineeUser.email,
          },
          invitationId: invitation.id,
        });
      }

      await AuditService.logEvent({
        examScheduleId: scheduleId,
        actorUserId: user.id,
        eventType: 'EXAMINER_INVITATION_CREATED',
        fromStatus: schedule.workflowStatus,
        toStatus: schedule.workflowStatus,
        description: `Invitation created for ${nomineeUser?.fullName || requestedName} (${examinerType}). Status: ${initialStatus}.`
      });

      res.status(201).json(invitation);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async reviewExternalInvitation(req: Request, res: Response): Promise<void> {
    try {
      const invitationId = parseInt(req.params.id, 10);
      const { approved, decisionReason } = req.body;
      const user = req.user!;

      const invitation = await queryOne<any>(
        `SELECT ei.id, ei.exam_schedule_id AS examScheduleId, ei.requested_examiner_profile_id AS requestedExaminerProfileId,
                ei.requested_name AS requestedName, ei.requested_email AS requestedEmail, ei.status,
                s.id AS s_id, s.first_examiner_user_id AS firstExaminerUserId,
                fe.id AS fe_id, fe.full_name AS fe_fullName, fe.email AS fe_email,
                c.course_code AS courseCode, c.course_title AS courseTitle,
                epu.id AS epu_id, epu.full_name AS epu_fullName, epu.email AS epu_email
         FROM examiner_invitations ei
         INNER JOIN exam_schedules s ON ei.exam_schedule_id = s.id
         LEFT JOIN course_offerings co ON s.course_offering_id = co.id
         LEFT JOIN courses c ON co.course_id = c.id
         LEFT JOIN users fe ON s.first_examiner_user_id = fe.id
         LEFT JOIN examiner_profiles ep ON ei.requested_examiner_profile_id = ep.id
         LEFT JOIN users epu ON ep.user_id = epu.id
         WHERE ei.id = ?`,
        [invitationId]
      );

      if (!invitation) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Invitation not found' });
        return;
      }

      const profileId = invitation.requestedExaminerProfileId;

      if (approved) {
        if (profileId) {
          // Re-verify seniority & load limit
          if (invitation.firstExaminerUserId) {
            const seniorityCheck = await ExaminerService.validateSeniority(
              invitation.firstExaminerUserId,
              profileId
            );
            if (!seniorityCheck.valid) {
              res.status(400).json({
                error: 'SENIORITY_VALIDATION_FAILED',
                message: seniorityCheck.message
              });
              return;
            }
          }

          const loadCheck = await ExaminerService.validateLoadLimit(profileId);
          if (!loadCheck.valid) {
            res.status(400).json({
              error: 'LOAD_LIMIT_EXCEEDED',
              message: loadCheck.message
            });
            return;
          }
        }

        // Approved: Assign to schedule and set invitation status to APPROVED
        await withTransaction(async (conn) => {
          await conn.execute(
            `UPDATE examiner_invitations
             SET status = ?, hod_decision_by = ?, hod_decision_at = NOW(), hod_decision_reason = ?
             WHERE id = ?`,
            [InvitationStatus.APPROVED, user.id, decisionReason ?? null, invitationId]
          );

          if (profileId) {
            await conn.execute(
              `UPDATE exam_schedules SET second_examiner_profile_id = ?, updated_at = NOW() WHERE id = ?`,
              [profileId, invitation.examScheduleId]
            );
          }
        });

        // Send confirmation email
        const candidateUser = invitation.epu_id
          ? { id: invitation.epu_id, fullName: invitation.epu_fullName, email: invitation.epu_email }
          : { id: undefined, fullName: invitation.requestedName, email: invitation.requestedEmail };

        if (invitation.fe_id) {
          await EmailService.sendHodApprovalConfirmed({
            scheduleId: invitation.examScheduleId,
            courseCode: invitation.courseCode || '',
            courseTitle: invitation.courseTitle || '',
            candidateUser,
            firstExaminerUser: {
              id: invitation.fe_id,
              fullName: invitation.fe_fullName,
              email: invitation.fe_email,
            },
            hodUser: {
              fullName: user.fullName
            }
          });
        }

        await AuditService.logEvent({
          examScheduleId: invitation.examScheduleId,
          actorUserId: user.id,
          eventType: 'SECOND_EXAMINER_HOD_APPROVED',
          fromStatus: invitation.status,
          toStatus: InvitationStatus.APPROVED,
          description: `HOD approved 2nd Examiner nomination for ${invitation.requestedName}. Assigned to schedule. Remark: ${decisionReason || 'N/A'}`
        });

        res.json({ success: true, status: InvitationStatus.APPROVED, message: 'Second Examiner officially approved and assigned.' });
      } else {
        // Rejected
        await execute(
          `UPDATE examiner_invitations
           SET status = ?, hod_decision_by = ?, hod_decision_at = NOW(), hod_decision_reason = ?
           WHERE id = ?`,
          [InvitationStatus.REJECTED, user.id, decisionReason ?? null, invitationId]
        );

        await AuditService.logEvent({
          examScheduleId: invitation.examScheduleId,
          actorUserId: user.id,
          eventType: 'SECOND_EXAMINER_HOD_REJECTED',
          fromStatus: invitation.status,
          toStatus: InvitationStatus.REJECTED,
          description: `HOD rejected 2nd Examiner nomination for ${invitation.requestedName}. Reason: ${decisionReason || 'N/A'}`
        });

        const updated = await queryOne<any>(`SELECT * FROM examiner_invitations WHERE id = ?`, [invitationId]);
        res.json(updated);
      }
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async respondToInvitation(req: Request, res: Response): Promise<void> {
    try {
      const invitationId = parseInt(req.params.id, 10);
      const { accept } = req.body;
      const user = req.user!;

      const invitation = await queryOne<any>(
        `SELECT ei.id, ei.exam_schedule_id AS examScheduleId, ei.requested_examiner_profile_id AS requestedExaminerProfileId,
                ei.status,
                fe.id AS fe_id, fe.full_name AS fe_fullName, fe.email AS fe_email,
                c.course_code AS courseCode, c.course_title AS courseTitle
         FROM examiner_invitations ei
         INNER JOIN exam_schedules s ON ei.exam_schedule_id = s.id
         LEFT JOIN course_offerings co ON s.course_offering_id = co.id
         LEFT JOIN courses c ON co.course_id = c.id
         LEFT JOIN users fe ON s.first_examiner_user_id = fe.id
         WHERE ei.id = ?`,
        [invitationId]
      );

      if (!invitation) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Invitation not found' });
        return;
      }

      if (invitation.status !== InvitationStatus.INVITED) {
        res.status(400).json({ error: 'BAD_REQUEST', message: `Cannot respond to invitation with status ${invitation.status}` });
        return;
      }

      if (accept) {
        const profileId = invitation.requestedExaminerProfileId || user.examinerProfileId;
        if (!profileId) {
          res.status(400).json({ error: 'BAD_REQUEST', message: 'No examiner profile associated with this account' });
          return;
        }

        const candidateProfile = await queryOne<any>(
          `SELECT ep.id, ep.seniority_level AS seniorityLevel, ep.institution, ep.designation_or_grade AS designationOrGrade,
                  u.full_name AS fullName, u.designation AS userDesignation
           FROM examiner_profiles ep
           INNER JOIN users u ON ep.user_id = u.id
           WHERE ep.id = ?`,
          [profileId]
        );

        // Recheck load limit
        const loadCheck = await ExaminerService.validateLoadLimit(profileId);
        if (!loadCheck.valid) {
          res.status(400).json({
            error: 'LOAD_LIMIT_EXCEEDED',
            message: loadCheck.message
          });
          return;
        }

        const nextStatus = InvitationStatus.ACCEPTED_PENDING_HOD;

        await execute(
          `UPDATE examiner_invitations 
           SET status = ?, responded_at = NOW(), requested_examiner_profile_id = ?
           WHERE id = ?`,
          [nextStatus, profileId, invitationId]
        );

        // Find HOD and dispatch email
        const hodUser = await queryOne<any>(
          `SELECT u.id, u.full_name AS fullName, u.email 
           FROM users u
           INNER JOIN user_roles ur ON ur.user_id = u.id
           INNER JOIN roles r ON ur.role_id = r.id
           WHERE r.name = 'HOD'
           LIMIT 1`
        );

        if (hodUser && candidateProfile && invitation.fe_fullName) {
          await EmailService.sendNominationAcceptedToHod({
            scheduleId: invitation.examScheduleId,
            courseCode: invitation.courseCode || '',
            courseTitle: invitation.courseTitle || '',
            candidateUser: {
              fullName: candidateProfile.fullName,
              designation: candidateProfile.designationOrGrade || candidateProfile.userDesignation || undefined,
              institution: candidateProfile.institution || 'RUSL',
            },
            candidateSeniority: candidateProfile.seniorityLevel,
            candidateLoad: loadCheck.activeCount,
            firstExaminerUser: {
              fullName: invitation.fe_fullName,
            },
            hodUser: {
              id: hodUser.id,
              fullName: hodUser.fullName,
              email: hodUser.email,
            }
          });
        }

        await AuditService.logEvent({
          examScheduleId: invitation.examScheduleId,
          actorUserId: user.id,
          eventType: 'SECOND_EXAMINER_ACCEPTED_PENDING_HOD',
          fromStatus: invitation.status,
          toStatus: nextStatus,
          description: `${candidateProfile?.fullName || user.fullName} accepted 2nd Examiner nomination. Submitted to HOD for final review and approval.`
        });

        res.json({
          success: true,
          status: nextStatus,
          message: 'Nomination accepted successfully! Forwarded to Head of Department for final review and approval.'
        });
      } else {
        const nextStatus = InvitationStatus.DECLINED;
        await execute(
          `UPDATE examiner_invitations SET status = ?, responded_at = NOW() WHERE id = ?`,
          [nextStatus, invitationId]
        );

        await AuditService.logEvent({
          examScheduleId: invitation.examScheduleId,
          actorUserId: user.id,
          eventType: 'SECOND_EXAMINER_DECLINED_NOMINATION',
          fromStatus: invitation.status,
          toStatus: nextStatus,
          description: `Nominated candidate declined 2nd Examiner invitation for schedule ${invitation.examScheduleId}.`
        });

        res.json({ success: true, status: nextStatus, message: 'Nomination declined.' });
      }
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }
}
