import { Request, Response } from 'express';
import { query, queryOne } from '../config/db';
import { ExaminerService } from '../services/examinerService';
import { isOverdue } from '../utils/dates';

export class DashboardController {
  /**
   * 1. HOD Dashboard: Executive Metrics, Action Queue & Departmental Load
   */
  static async getHodDashboard(req: Request, res: Response): Promise<void> {
    try {
      // 1. Metric Counts
      const totalRow = await queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM exam_schedules`);
      const scheduledRow = await queryOne<{ count: number }>(
        `SELECT COUNT(*) AS count FROM exam_schedules WHERE workflow_status = 'SCHEDULED'`
      );
      const firstActiveRow = await queryOne<{ count: number }>(
        `SELECT COUNT(*) AS count FROM exam_schedules WHERE workflow_status IN ('FIRST_COLLECTION_REQUESTED', 'FIRST_MARKING_ACTIVE')`
      );
      const secondActiveRow = await queryOne<{ count: number }>(
        `SELECT COUNT(*) AS count FROM exam_schedules WHERE workflow_status IN ('SECOND_MARKING_READY', 'SECOND_MARKING_ACTIVE')`
      );
      const pendingApprovalRow = await queryOne<{ count: number }>(
        `SELECT COUNT(*) AS count FROM exam_schedules WHERE workflow_status = 'FINAL_MARKSHEET_SUBMITTED'`
      );
      const approvedLockedRow = await queryOne<{ count: number }>(
        `SELECT COUNT(*) AS count FROM exam_schedules WHERE workflow_status = 'APPROVED_LOCKED'`
      );

      const totalSchedules = Number(totalRow?.count || 0);
      const scheduledCount = Number(scheduledRow?.count || 0);
      const firstMarkingActive = Number(firstActiveRow?.count || 0);
      const secondMarkingActive = Number(secondActiveRow?.count || 0);
      const pendingApprovalCount = Number(pendingApprovalRow?.count || 0);
      const approvedLockedCount = Number(approvedLockedRow?.count || 0);

      // 2. Overdue calculation
      const activeRows = await query<any>(
        `SELECT 
           s.id,
           fm.collected_at AS fm_collected_at,
           fm.returned_at AS fm_returned_at,
           fm.original_due_date AS fm_original_due_date,
           fm.extended_due_date AS fm_extended_due_date,
           sm.courier_dispatched_at AS sm_courier_dispatched_at,
           sm.ar_received_at AS sm_ar_received_at,
           sm.original_due_date AS sm_original_due_date,
           sm.extended_due_date AS sm_extended_due_date
         FROM exam_schedules s
         LEFT JOIN first_markings fm ON fm.exam_schedule_id = s.id
         LEFT JOIN second_markings sm ON sm.exam_schedule_id = s.id
         WHERE s.workflow_status NOT IN ('APPROVED_LOCKED', 'CANCELLED', 'DRAFT')`
      );

      const overdueCount = activeRows.filter((s: any) => {
        const firstOver = s.fm_collected_at && !s.fm_returned_at
          ? isOverdue(s.fm_extended_due_date || s.fm_original_due_date)
          : false;
        const secondOver = s.sm_courier_dispatched_at && !s.sm_ar_received_at
          ? isOverdue(s.sm_extended_due_date || s.sm_original_due_date)
          : false;
        return firstOver || secondOver;
      }).length;

      // 3. Action Queue
      // a. Pending examiner invitations & nominations requiring HOD approval
      const rawPendingInvitations = await query<any>(
        `SELECT 
           ei.id,
           ei.exam_schedule_id AS examScheduleId,
           ei.requested_examiner_profile_id AS requestedExaminerProfileId,
           ei.requested_email AS requestedEmail,
           ei.examiner_type AS invitationType,
           ei.status,
           ei.invitation_token_hash AS token,
           ei.created_at AS createdAt,
           ei.expires_at AS expiresAt,
           s.id AS s_id,
           s.exam_date AS s_exam_date,
           s.workflow_status AS s_workflow_status,
           co.id AS co_id,
           c.id AS c_id,
           c.course_code AS c_course_code,
           c.course_title AS c_course_title,
           fe.id AS fe_id,
           fe.full_name AS fe_full_name,
           fe.email AS fe_email,
           ep.id AS ep_id,
           ep.institution AS ep_institution,
           ep.seniority_level AS ep_seniority_level,
           epu.id AS epu_id,
           epu.full_name AS epu_full_name,
           epu.email AS epu_email
         FROM examiner_invitations ei
         JOIN exam_schedules s ON ei.exam_schedule_id = s.id
         LEFT JOIN course_offerings co ON s.course_offering_id = co.id
         LEFT JOIN courses c ON co.course_id = c.id
         LEFT JOIN users fe ON s.first_examiner_user_id = fe.id
         LEFT JOIN examiner_profiles ep ON ei.requested_examiner_profile_id = ep.id
         LEFT JOIN users epu ON ep.user_id = epu.id
         WHERE ei.status IN ('PENDING_HOD_APPROVAL', 'ACCEPTED_PENDING_HOD')
         ORDER BY ei.created_at DESC`
      );

      const pendingInvitations = rawPendingInvitations.map((inv: any) => ({
        id: inv.id,
        examScheduleId: inv.examScheduleId,
        requestedExaminerProfileId: inv.requestedExaminerProfileId,
        requestedEmail: inv.requestedEmail,
        invitationType: inv.invitationType,
        status: inv.status,
        token: inv.token,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        examSchedule: {
          id: inv.s_id,
          examDate: inv.s_exam_date,
          workflowStatus: inv.s_workflow_status,
          courseOffering: inv.co_id ? {
            id: inv.co_id,
            course: inv.c_id ? {
              id: inv.c_id,
              courseCode: inv.c_course_code,
              courseTitle: inv.c_course_title,
            } : null,
          } : null,
          firstExaminer: inv.fe_id ? {
            id: inv.fe_id,
            fullName: inv.fe_full_name,
            email: inv.fe_email,
          } : null,
        },
        examinerProfile: inv.ep_id ? {
          id: inv.ep_id,
          institution: inv.ep_institution,
          seniorityLevel: inv.ep_seniority_level,
          user: inv.epu_id ? {
            id: inv.epu_id,
            fullName: inv.epu_full_name,
            email: inv.epu_email,
          } : null,
        } : null,
      }));

      // b. Pending extension requests
      const rawPendingExtensions = await query<any>(
        `SELECT 
           der.id,
           der.exam_schedule_id AS examScheduleId,
           der.phase,
           der.requested_by AS requestedBy,
           der.current_due_date AS currentDueDate,
           der.requested_due_date AS requestedDueDate,
           der.reason,
           der.status,
           der.created_at AS createdAt,
           s.id AS s_id,
           s.exam_date AS s_exam_date,
           s.workflow_status AS s_workflow_status,
           co.id AS co_id,
           c.id AS c_id,
           c.course_code AS c_course_code,
           c.course_title AS c_course_title,
           req_u.full_name AS requester_name
         FROM deadline_extension_requests der
         JOIN exam_schedules s ON der.exam_schedule_id = s.id
         LEFT JOIN course_offerings co ON s.course_offering_id = co.id
         LEFT JOIN courses c ON co.course_id = c.id
         LEFT JOIN users req_u ON der.requested_by = req_u.id
         WHERE der.status = 'PENDING'
         ORDER BY der.created_at DESC`
      );

      const pendingExtensions = rawPendingExtensions.map((ext: any) => ({
        id: ext.id,
        examScheduleId: ext.examScheduleId,
        phase: ext.phase,
        requestedBy: ext.requestedBy,
        requesterName: ext.requester_name,
        currentDueDate: ext.currentDueDate,
        requestedDueDate: ext.requestedDueDate,
        reason: ext.reason,
        status: ext.status,
        createdAt: ext.createdAt,
        examSchedule: {
          id: ext.s_id,
          examDate: ext.s_exam_date,
          workflowStatus: ext.s_workflow_status,
          courseOffering: ext.co_id ? {
            id: ext.co_id,
            course: ext.c_id ? {
              id: ext.c_id,
              courseCode: ext.c_course_code,
              courseTitle: ext.c_course_title,
            } : null,
          } : null,
        },
      }));

      // c. Pending final marksheet approvals
      const rawFinalSubmissions = await query<any>(
        `SELECT 
           s.id,
           s.exam_date AS examDate,
           s.workflow_status AS workflowStatus,
           s.updated_at AS updatedAt,
           co.id AS co_id,
           c.id AS c_id,
           c.course_code AS c_course_code,
           c.course_title AS c_course_title,
           fe.id AS fe_id,
           fe.full_name AS fe_full_name,
           fe.email AS fe_email,
           fr.id AS fr_id,
           fr.final_marksheet_document_id AS fr_final_marksheet_document_id,
           fr.submission_status AS fr_submission_status,
           fr.submitted_at AS fr_submitted_at,
           fr.hardcopy_submitted_at AS fr_hardcopy_submitted_at,
           fr.revision_reason AS fr_revision_reason
         FROM exam_schedules s
         LEFT JOIN course_offerings co ON s.course_offering_id = co.id
         LEFT JOIN courses c ON co.course_id = c.id
         LEFT JOIN users fe ON s.first_examiner_user_id = fe.id
         LEFT JOIN final_results fr ON fr.exam_schedule_id = s.id
         WHERE s.workflow_status = 'FINAL_MARKSHEET_SUBMITTED'
         ORDER BY s.updated_at DESC`
      );

      const pendingFinalSubmissions = rawFinalSubmissions.map((sub: any) => ({
        id: sub.id,
        examDate: sub.examDate,
        workflowStatus: sub.workflowStatus,
        updatedAt: sub.updatedAt,
        courseOffering: sub.co_id ? {
          id: sub.co_id,
          course: sub.c_id ? {
            id: sub.c_id,
            courseCode: sub.c_course_code,
            courseTitle: sub.c_course_title,
          } : null,
        } : null,
        firstExaminer: sub.fe_id ? {
          id: sub.fe_id,
          fullName: sub.fe_full_name,
          email: sub.fe_email,
        } : null,
        finalResult: sub.fr_id ? {
          id: sub.fr_id,
          finalMarksheetDocumentId: sub.fr_final_marksheet_document_id,
          submissionStatus: sub.fr_submission_status,
          submittedAt: sub.fr_submitted_at,
          hardcopySubmittedAt: sub.fr_hardcopy_submitted_at,
          revisionReason: sub.fr_revision_reason,
        } : null,
      }));

      // 4. Examiner load overview
      const examinerLoad = await ExaminerService.getCandidates();

      res.json({
        metrics: {
          totalSchedules,
          scheduledCount,
          firstMarkingActive,
          secondMarkingActive,
          pendingApprovalCount,
          approvedLockedCount,
          overdueCount,
        },
        actionQueue: {
          pendingInvitations,
          pendingExtensions,
          pendingFinalSubmissions,
        },
        examinerLoad,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * 2. Lecturer Dashboard: Schedules where user is assigned as First Examiner
   */
  static async getLecturerDashboard(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;

      // Fetch schedules where first_examiner_user_id = user.id
      const schedules = await query<any>(
        `SELECT 
           s.id,
           s.course_offering_id AS courseOfferingId,
           s.exam_date AS examDate,
           s.first_examiner_user_id AS firstExaminerUserId,
           s.second_examiner_profile_id AS secondExaminerProfileId,
           s.workflow_status AS workflowStatus,
           s.workflow_started_at AS workflowStartedAt,
           s.locked_at AS lockedAt,
           NULL AS lockedBy,
           s.created_by AS createdBy,
           s.activated_by AS activatedBy,
           s.created_at AS createdAt,
           s.updated_at AS updatedAt,
           co.id AS co_id,
           co.course_id AS co_course_id,
           co.programme_group AS co_programme_group,
           co.batch_label AS co_batch_label,
           co.year_of_study AS co_year_of_study,
           co.semester AS co_semester,
           c.id AS c_id,
           c.course_code AS c_course_code,
           c.course_title AS c_course_title,
           NULL AS c_credits,
           lic.id AS lic_id,
           lic.full_name AS lic_full_name,
           sep.id AS se_id,
           sep.seniority_level AS se_seniority_level,
           sep.examiner_type AS se_examiner_type,
           sep.institution AS se_institution,
           seu.id AS seu_id,
           seu.full_name AS seu_full_name,
           seu.email AS seu_email,
           seu.designation AS seu_designation,
           fm.id AS fm_id,
           fm.script_count AS fm_script_count,
           fm.collection_requested_at AS fm_collection_requested_at,
           fm.collected_at AS fm_collected_at,
           fm.original_due_date AS fm_original_due_date,
           fm.extended_due_date AS fm_extended_due_date,
           fm.returned_at AS fm_returned_at,
           fm.report_document_id AS fm_report_document_id,
           sm.id AS sm_id,
           sm.courier_dispatched_at AS sm_courier_dispatched_at,
           sm.original_due_date AS sm_original_due_date,
           sm.extended_due_date AS sm_extended_due_date,
           sm.acknowledged_at AS sm_acknowledged_at,
           sm.report_document_id AS sm_report_document_id,
           sm.ar_received_at AS sm_ar_received_at,
           sm.courier_reference AS sm_courier_reference,
           fr.id AS fr_id,
           fr.final_marksheet_document_id AS fr_final_marksheet_document_id,
           fr.submission_status AS fr_submission_status,
           fr.submitted_at AS fr_submitted_at,
           fr.hod_approval_status AS fr_hod_approval_status,
           fr.revision_reason AS fr_revision_reason
         FROM exam_schedules s
         LEFT JOIN course_offerings co ON s.course_offering_id = co.id
         LEFT JOIN courses c ON co.course_id = c.id
         LEFT JOIN staff_directory lic ON co.lecturer_in_charge_staff_id = lic.id
         LEFT JOIN examiner_profiles sep ON s.second_examiner_profile_id = sep.id
         LEFT JOIN users seu ON sep.user_id = seu.id
         LEFT JOIN first_markings fm ON fm.exam_schedule_id = s.id
         LEFT JOIN second_markings sm ON sm.exam_schedule_id = s.id
         LEFT JOIN final_results fr ON fr.exam_schedule_id = s.id
         WHERE s.first_examiner_user_id = ?
         ORDER BY s.exam_date DESC, s.id DESC`,
        [user.id]
      );

      const scheduleIds = schedules.map((s: any) => s.id);

      // Fetch pending invitations for these schedules
      let invitationsBySchedule: Record<number, any[]> = {};
      let extensionsBySchedule: Record<number, any[]> = {};

      if (scheduleIds.length > 0) {
        const placeholders = scheduleIds.map(() => '?').join(',');
        const rawInvitations = await query<any>(
          `SELECT id, exam_schedule_id AS examScheduleId, requested_examiner_profile_id AS requestedExaminerProfileId,
                  requested_email AS requestedEmail, examiner_type AS invitationType, status, created_at AS createdAt
           FROM examiner_invitations
           WHERE exam_schedule_id IN (${placeholders})
             AND status IN ('INVITED', 'PENDING_HOD_APPROVAL')`,
          scheduleIds
        );
        for (const inv of rawInvitations) {
          if (!invitationsBySchedule[inv.examScheduleId]) {
            invitationsBySchedule[inv.examScheduleId] = [];
          }
          invitationsBySchedule[inv.examScheduleId].push(inv);
        }

        const rawExtensions = await query<any>(
          `SELECT id, exam_schedule_id AS examScheduleId, phase, requested_by AS requestedBy,
                  current_due_date AS currentDueDate, requested_due_date AS requestedDueDate,
                  reason, status, created_at AS createdAt
           FROM deadline_extension_requests
           WHERE exam_schedule_id IN (${placeholders})
           ORDER BY created_at DESC`,
          scheduleIds
        );
        for (const ext of rawExtensions) {
          if (!extensionsBySchedule[ext.examScheduleId]) {
            extensionsBySchedule[ext.examScheduleId] = [];
          }
          extensionsBySchedule[ext.examScheduleId].push(ext);
        }
      }

      const formatted = schedules.map((s: any) => ({
        id: s.id,
        courseOfferingId: s.courseOfferingId,
        examDate: s.examDate,
        firstExaminerUserId: s.firstExaminerUserId,
        secondExaminerProfileId: s.secondExaminerProfileId,
        workflowStatus: s.workflowStatus,
        workflowStartedAt: s.workflowStartedAt,
        lockedAt: s.lockedAt,
        lockedBy: s.lockedBy,
        createdBy: s.createdBy,
        activatedBy: s.activatedBy,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        courseOffering: s.co_id ? {
          id: s.co_id,
          courseId: s.co_course_id,
          programmeGroup: s.co_programme_group,
          batchLabel: s.co_batch_label,
          yearOfStudy: s.co_year_of_study,
          semester: s.co_semester,
          course: s.c_id ? {
            id: s.c_id,
            courseCode: s.c_course_code,
            courseTitle: s.c_course_title,
            credits: s.c_credits,
          } : null,
          lecturerInCharge: s.lic_id ? {
            id: s.lic_id,
            fullName: s.lic_full_name,
          } : null,
        } : null,
        secondExaminer: s.se_id ? {
          id: s.se_id,
          seniorityLevel: s.se_seniority_level,
          examinerType: s.se_examiner_type,
          institution: s.se_institution,
          user: s.seu_id ? {
            id: s.seu_id,
            fullName: s.seu_full_name,
            email: s.seu_email,
            designation: s.seu_designation,
          } : null,
        } : null,
        firstMarking: s.fm_id ? {
          id: s.fm_id,
          scriptCount: s.fm_script_count,
          collectionRequestedAt: s.fm_collection_requested_at,
          collectedAt: s.fm_collected_at,
          originalDueDate: s.fm_original_due_date,
          extendedDueDate: s.fm_extended_due_date,
          returnedAt: s.fm_returned_at,
          reportDocumentId: s.fm_report_document_id,
        } : null,
        secondMarking: s.sm_id ? {
          id: s.sm_id,
          courierDispatchedAt: s.sm_courier_dispatched_at,
          originalDueDate: s.sm_original_due_date,
          extendedDueDate: s.sm_extended_due_date,
          acknowledgedAt: s.sm_acknowledged_at,
          reportDocumentId: s.sm_report_document_id,
          arReceivedAt: s.sm_ar_received_at,
          courierReference: s.sm_courier_reference,
        } : null,
        finalResult: s.fr_id ? {
          id: s.fr_id,
          finalMarksheetDocumentId: s.fr_final_marksheet_document_id,
          submissionStatus: s.fr_submission_status,
          submittedAt: s.fr_submitted_at,
          hodApprovalStatus: s.fr_hod_approval_status,
          revisionReason: s.fr_revision_reason,
        } : null,
        invitations: invitationsBySchedule[s.id] || [],
        extensionRequests: extensionsBySchedule[s.id] || [],
      }));

      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * 3. Second Examiner Dashboard: Assigned subjects & pending invitations
   */
  static async getSecondExaminerDashboard(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const profileId = user.examinerProfileId;

      // 1. Invitations pending response or awaiting HOD approval
      const invitationParams: any[] = [];
      let whereClause = '';

      if (profileId) {
        whereClause = `(ei.requested_examiner_profile_id = ? OR ei.requested_email = ?)`;
        invitationParams.push(profileId, user.email);
      } else {
        whereClause = `ei.requested_email = ?`;
        invitationParams.push(user.email);
      }

      const rawInvitations = await query<any>(
        `SELECT 
           ei.id,
           ei.exam_schedule_id AS examScheduleId,
           ei.requested_examiner_profile_id AS requestedExaminerProfileId,
           ei.requested_email AS requestedEmail,
           ei.examiner_type AS invitationType,
           ei.status,
           ei.invitation_token_hash AS token,
           ei.created_at AS createdAt,
           ei.expires_at AS expiresAt,
           s.id AS s_id,
           s.exam_date AS s_exam_date,
           s.workflow_status AS s_workflow_status,
           co.id AS co_id,
           c.id AS c_id,
           c.course_code AS c_course_code,
           c.course_title AS c_course_title,
           fe.id AS fe_id,
           fe.full_name AS fe_full_name,
           fe.email AS fe_email
         FROM examiner_invitations ei
         JOIN exam_schedules s ON ei.exam_schedule_id = s.id
         LEFT JOIN course_offerings co ON s.course_offering_id = co.id
         LEFT JOIN courses c ON co.course_id = c.id
         LEFT JOIN users fe ON s.first_examiner_user_id = fe.id
         WHERE ${whereClause}
           AND ei.status IN ('INVITED', 'ACCEPTED_PENDING_HOD')
         ORDER BY ei.created_at DESC`,
        invitationParams
      );

      const invitations = rawInvitations.map((inv: any) => ({
        id: inv.id,
        examScheduleId: inv.examScheduleId,
        requestedExaminerProfileId: inv.requestedExaminerProfileId,
        requestedEmail: inv.requestedEmail,
        invitationType: inv.invitationType,
        status: inv.status,
        token: inv.token,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        examSchedule: {
          id: inv.s_id,
          examDate: inv.s_exam_date,
          workflowStatus: inv.s_workflow_status,
          courseOffering: inv.co_id ? {
            id: inv.co_id,
            course: inv.c_id ? {
              id: inv.c_id,
              courseCode: inv.c_course_code,
              courseTitle: inv.c_course_title,
            } : null,
          } : null,
          firstExaminer: inv.fe_id ? {
            id: inv.fe_id,
            fullName: inv.fe_full_name,
            email: inv.fe_email,
          } : null,
        },
      }));

      // 2. Assigned subjects
      let assignedSchedules: any[] = [];
      if (profileId) {
        const rawAssigned = await query<any>(
          `SELECT 
             s.id,
             s.exam_date AS examDate,
             s.workflow_status AS workflowStatus,
             co.id AS co_id,
             c.id AS c_id,
             c.course_code AS c_course_code,
             c.course_title AS c_course_title,
             fe.id AS fe_id,
             fe.full_name AS fe_full_name,
             fe.email AS fe_email,
             sm.id AS sm_id,
             sm.courier_dispatched_at AS sm_courier_dispatched_at,
             sm.original_due_date AS sm_original_due_date,
             sm.extended_due_date AS sm_extended_due_date,
             sm.acknowledged_at AS sm_acknowledged_at,
             sm.report_document_id AS sm_report_document_id,
             sm.ar_received_at AS sm_ar_received_at,
             sm.courier_reference AS sm_courier_reference
           FROM exam_schedules s
           LEFT JOIN course_offerings co ON s.course_offering_id = co.id
           LEFT JOIN courses c ON co.course_id = c.id
           LEFT JOIN users fe ON s.first_examiner_user_id = fe.id
           LEFT JOIN second_markings sm ON sm.exam_schedule_id = s.id
           WHERE s.second_examiner_profile_id = ?
           ORDER BY s.exam_date DESC`,
          [profileId]
        );

        const assignedIds = rawAssigned.map((a: any) => a.id);
        let extensionsBySchedule: Record<number, any[]> = {};

        if (assignedIds.length > 0) {
          const placeholders = assignedIds.map(() => '?').join(',');
          const rawExtensions = await query<any>(
            `SELECT id, exam_schedule_id AS examScheduleId, phase, requested_by AS requestedBy,
                    current_due_date AS currentDueDate, requested_due_date AS requestedDueDate,
                    reason, status, created_at AS createdAt
             FROM deadline_extension_requests
             WHERE exam_schedule_id IN (${placeholders})
             ORDER BY created_at DESC`,
            assignedIds
          );
          for (const ext of rawExtensions) {
            if (!extensionsBySchedule[ext.examScheduleId]) {
              extensionsBySchedule[ext.examScheduleId] = [];
            }
            extensionsBySchedule[ext.examScheduleId].push(ext);
          }
        }

        assignedSchedules = rawAssigned.map((s: any) => ({
          id: s.id,
          examDate: s.examDate,
          workflowStatus: s.workflowStatus,
          courseOffering: s.co_id ? {
            id: s.co_id,
            course: s.c_id ? {
              id: s.c_id,
              courseCode: s.c_course_code,
              courseTitle: s.c_course_title,
            } : null,
          } : null,
          firstExaminer: s.fe_id ? {
            id: s.fe_id,
            fullName: s.fe_full_name,
            email: s.fe_email,
          } : null,
          secondMarking: s.sm_id ? {
            id: s.sm_id,
            courierDispatchedAt: s.sm_courier_dispatched_at,
            originalDueDate: s.sm_original_due_date,
            extendedDueDate: s.sm_extended_due_date,
            acknowledgedAt: s.sm_acknowledged_at,
            reportDocumentId: s.sm_report_document_id,
            arReceivedAt: s.sm_ar_received_at,
            courierReference: s.sm_courier_reference,
          } : null,
          extensionRequests: extensionsBySchedule[s.id] || [],
        }));
      }

      res.json({
        invitations,
        assignedSchedules,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * 4. AR Dashboard: Script Collection, Return, Courier Dispatch & Receipt Queues
   */
  static async getArDashboard(req: Request, res: Response): Promise<void> {
    try {
      // Helper function to query schedules for AR operational queues
      const queryArSchedules = async (whereClause: string) => {
        const rows = await query<any>(
          `SELECT 
             s.id,
             s.exam_date AS examDate,
             s.workflow_status AS workflowStatus,
             co.id AS co_id,
             c.id AS c_id,
             c.course_code AS c_course_code,
             c.course_title AS c_course_title,
             fe.id AS fe_id,
             fe.full_name AS fe_full_name,
             fe.email AS fe_email,
             sep.id AS se_id,
             seu.id AS seu_id,
             seu.full_name AS seu_full_name,
             fm.id AS fm_id,
             fm.script_count AS fm_script_count,
             fm.collection_requested_at AS fm_collection_requested_at,
             fm.collected_at AS fm_collected_at,
             fm.original_due_date AS fm_original_due_date,
             fm.extended_due_date AS fm_extended_due_date,
             fm.returned_at AS fm_returned_at,
             fm.report_document_id AS fm_report_document_id,
             sm.id AS sm_id,
             sm.courier_dispatched_at AS sm_courier_dispatched_at,
             sm.original_due_date AS sm_original_due_date,
             sm.extended_due_date AS sm_extended_due_date,
             sm.acknowledged_at AS sm_acknowledged_at,
             sm.ar_received_at AS sm_ar_received_at,
             sm.courier_reference AS sm_courier_reference
           FROM exam_schedules s
           LEFT JOIN course_offerings co ON s.course_offering_id = co.id
           LEFT JOIN courses c ON co.course_id = c.id
           LEFT JOIN users fe ON s.first_examiner_user_id = fe.id
           LEFT JOIN examiner_profiles sep ON s.second_examiner_profile_id = sep.id
           LEFT JOIN users seu ON sep.user_id = seu.id
           LEFT JOIN first_markings fm ON fm.exam_schedule_id = s.id
           LEFT JOIN second_markings sm ON sm.exam_schedule_id = s.id
           WHERE ${whereClause}
           ORDER BY s.exam_date ASC`
        );

        return rows.map((r: any) => ({
          id: r.id,
          examDate: r.examDate,
          workflowStatus: r.workflowStatus,
          courseOffering: r.co_id ? {
            id: r.co_id,
            course: r.c_id ? {
              id: r.c_id,
              courseCode: r.c_course_code,
              courseTitle: r.c_course_title,
            } : null,
          } : null,
          firstExaminer: r.fe_id ? {
            id: r.fe_id,
            fullName: r.fe_full_name,
            email: r.fe_email,
          } : null,
          secondExaminer: r.se_id ? {
            id: r.se_id,
            user: r.seu_id ? {
              id: r.seu_id,
              fullName: r.seu_full_name,
            } : null,
          } : null,
          firstMarking: r.fm_id ? {
            id: r.fm_id,
            scriptCount: r.fm_script_count,
            collectionRequestedAt: r.fm_collection_requested_at,
            collectedAt: r.fm_collected_at,
            originalDueDate: r.fm_original_due_date,
            extendedDueDate: r.fm_extended_due_date,
            returnedAt: r.fm_returned_at,
            reportDocumentId: r.fm_report_document_id,
          } : null,
          secondMarking: r.sm_id ? {
            id: r.sm_id,
            courierDispatchedAt: r.sm_courier_dispatched_at,
            originalDueDate: r.sm_original_due_date,
            extendedDueDate: r.sm_extended_due_date,
            acknowledgedAt: r.sm_acknowledged_at,
            arReceivedAt: r.sm_ar_received_at,
            courierReference: r.sm_courier_reference,
          } : null,
        }));
      };

      // 1. Collection OTP queue (schedules ready for packet count or awaiting examiner collection)
      const collectionQueue = await queryArSchedules(`s.workflow_status IN ('SCHEDULED', 'FIRST_COLLECTION_REQUESTED')`);

      // 2. Return OTP queue
      const returnQueue = await queryArSchedules(
        `s.workflow_status = 'FIRST_MARKING_ACTIVE' AND fm.collected_at IS NOT NULL AND fm.returned_at IS NULL`
      );

      // 3. Courier Dispatch queue
      const courierQueue = await queryArSchedules(`s.workflow_status = 'SECOND_MARKING_READY'`);

      // 4. Returned scripts receipt queue
      const receiptQueue = await queryArSchedules(
        `s.workflow_status = 'SECOND_MARKING_ACTIVE' AND sm.courier_dispatched_at IS NOT NULL AND sm.ar_received_at IS NULL`
      );

      res.json({
        collectionQueue,
        returnQueue,
        courierQueue,
        receiptQueue,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  /**
   * 5. Dean Dashboard: High-Level Faculty Analytics & Progression Overview
   * Strictly aggregate metrics only — NO document references, NO individual marks, NO OTPs
   */
  static async getDeanDashboard(req: Request, res: Response): Promise<void> {
    try {
      const totalRow = await queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM exam_schedules`);
      const approvedRow = await queryOne<{ count: number }>(
        `SELECT COUNT(*) AS count FROM exam_schedules WHERE workflow_status = 'APPROVED_LOCKED'`
      );
      const inProgressRow = await queryOne<{ count: number }>(
        `SELECT COUNT(*) AS count FROM exam_schedules WHERE workflow_status NOT IN ('DRAFT', 'APPROVED_LOCKED', 'CANCELLED')`
      );

      const totalSchedules = Number(totalRow?.count || 0);
      const approvedCount = Number(approvedRow?.count || 0);
      const inProgressCount = Number(inProgressRow?.count || 0);

      // Programme breakdown
      const offeringRows = await query<any>(
        `SELECT 
           co.programme_group AS programmeGroup,
           s.id AS scheduleId,
           s.workflow_status AS workflowStatus,
           fm.collected_at AS fm_collected_at,
           fm.returned_at AS fm_returned_at,
           fm.original_due_date AS fm_original_due_date,
           fm.extended_due_date AS fm_extended_due_date,
           sm.courier_dispatched_at AS sm_courier_dispatched_at,
           sm.ar_received_at AS sm_ar_received_at,
           sm.original_due_date AS sm_original_due_date,
           sm.extended_due_date AS sm_extended_due_date
         FROM course_offerings co
         LEFT JOIN exam_schedules s ON s.course_offering_id = co.id
         LEFT JOIN first_markings fm ON fm.exam_schedule_id = s.id
         LEFT JOIN second_markings sm ON sm.exam_schedule_id = s.id`
      );

      const programmeMap: Record<string, { total: number; completed: number; inProgress: number; overdue: number }> = {};

      for (const row of offeringRows) {
        const prog = row.programmeGroup || 'Unassigned';
        if (!programmeMap[prog]) {
          programmeMap[prog] = { total: 0, completed: 0, inProgress: 0, overdue: 0 };
        }

        if (row.scheduleId) {
          programmeMap[prog].total++;
          if (row.workflowStatus === 'APPROVED_LOCKED') {
            programmeMap[prog].completed++;
          } else if (row.workflowStatus !== 'DRAFT' && row.workflowStatus !== 'CANCELLED') {
            programmeMap[prog].inProgress++;
            const firstOver = row.fm_collected_at && !row.fm_returned_at
              ? isOverdue(row.fm_extended_due_date || row.fm_original_due_date)
              : false;
            const secondOver = row.sm_courier_dispatched_at && !row.sm_ar_received_at
              ? isOverdue(row.sm_extended_due_date || row.sm_original_due_date)
              : false;
            if (firstOver || secondOver) {
              programmeMap[prog].overdue++;
            }
          }
        }
      }

      // Workflow Stage breakdown
      const stageRows = await query<any>(
        `SELECT workflow_status AS workflowStatus, COUNT(*) AS count
         FROM exam_schedules
         GROUP BY workflow_status`
      );

      res.json({
        summary: {
          totalSchedules,
          approvedCount,
          inProgressCount,
          completionRate: totalSchedules > 0 ? Math.round((approvedCount / totalSchedules) * 100) : 0,
        },
        programmeBreakdown: Object.entries(programmeMap).map(([programme, stats]) => ({
          programme,
          ...stats,
        })),
        stageBreakdown: stageRows.map((s: any) => ({
          stage: s.workflowStatus,
          count: Number(s.count),
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }
}
