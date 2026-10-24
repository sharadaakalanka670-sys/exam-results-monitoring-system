import { query, queryOne, execute, withTransaction } from '../config/db';
import { WorkflowStatus, OtpActionType, RoleName } from '../types/enums';
import { calculateFirstMarkingDueDate, calculateSecondMarkingDueDate } from '../utils/dates';
import { AuditService } from './auditService';
import { OtpService } from './otpService';
import { EmailService } from './emailService';
import { ScheduleRepository } from './scheduleRepository';

export class WorkflowService {
  // check if schedule is already locked so we dont allow any more changes
  static async assertNotLocked(scheduleId: number): Promise<void> {
    const schedule = await queryOne<{ workflow_status: string; locked_at: Date | null }>(
      `SELECT workflow_status, locked_at FROM exam_schedules WHERE id = ?`,
      [scheduleId]
    );

    if (!schedule) {
      const err: any = new Error('Exam schedule not found');
      err.status = 404;
      throw err;
    }

    if (schedule.workflow_status === WorkflowStatus.APPROVED_LOCKED || schedule.locked_at !== null) {
      const err: any = new Error('WORKFLOW_LOCKED: This exam schedule has been approved and permanently locked against mutations.');
      err.status = 409;
      throw err;
    }
  }

  // activate draft schedule - need both 1st and 2nd exmainer assigned
  // also 2nd examiner must be senior to 1st examiner and have < 3 active subjects
  static async activateSchedule(
    scheduleId: number,
    examDate: Date,
    firstExaminerUserId: number,
    arg4?: number | null,
    arg5?: number
  ) {
    await this.assertNotLocked(scheduleId);

    let secondExaminerProfileId: number | null | undefined = undefined;
    let hodUserId: number;

    if (arg5 !== undefined) {
      secondExaminerProfileId = arg4;
      hodUserId = arg5;
    } else {
      // 4-arg signature: (scheduleId, examDate, firstExaminerUserId, hodUserId)
      hodUserId = arg4 as number;
    }

    const currentSchedule = await queryOne<any>(
      `SELECT id, second_examiner_profile_id AS secondExaminerProfileId FROM exam_schedules WHERE id = ?`,
      [scheduleId]
    );

    if (!currentSchedule) {
      const err: any = new Error('Exam schedule not found.');
      err.status = 404;
      throw err;
    }

    const effectiveSecondExaminerId = secondExaminerProfileId || currentSchedule.secondExaminerProfileId;
    if (!effectiveSecondExaminerId) {
      const err: any = new Error(
        'Cannot plan or activate exam: Both First Examiner and Second Examiner must be assigned in compliance with university examination regulations.'
      );
      err.status = 400;
      throw err;
    }

    // Verify first examiner has an active examiner profile with seniority
    const firstProfile = await queryOne<any>(
      `SELECT ep.id, ep.user_id, ep.seniority_level, ep.designation_or_grade, ep.is_active,
              u.full_name AS fullName, u.designation AS userDesignation
       FROM examiner_profiles ep
       INNER JOIN users u ON ep.user_id = u.id
       WHERE ep.user_id = ?`,
      [firstExaminerUserId]
    );

    if (!firstProfile || !firstProfile.is_active) {
      const err: any = new Error('First examiner must have an active examiner profile.');
      err.status = 400;
      throw err;
    }

    // Verify second examiner has an active examiner profile
    const secondProfile = await queryOne<any>(
      `SELECT ep.id, ep.user_id, ep.seniority_level, ep.designation_or_grade, ep.is_active,
              u.full_name AS fullName, u.designation AS userDesignation
       FROM examiner_profiles ep
       INNER JOIN users u ON ep.user_id = u.id
       WHERE ep.id = ?`,
      [effectiveSecondExaminerId]
    );

    if (!secondProfile || !secondProfile.is_active) {
      const err: any = new Error('Second examiner must have an active examiner profile.');
      err.status = 400;
      throw err;
    }

    // First and Second Examiner cannot be the same person
    if (secondProfile.user_id === firstExaminerUserId) {
      const err: any = new Error('First Examiner and Second Examiner cannot be the same person.');
      err.status = 400;
      throw err;
    }

    // Seniority validation (strictly higher seniority)
    if (secondProfile.seniority_level <= firstProfile.seniority_level) {
      const firstDesig = firstProfile.designation_or_grade || firstProfile.userDesignation || 'First Examiner';
      const secondDesig = secondProfile.designation_or_grade || secondProfile.userDesignation || 'Second Examiner';
      const err: any = new Error(
        `Academic rank compliance failure: Second Examiner (${secondProfile.fullName} - ${secondDesig}) must hold a senior academic rank to First Examiner (${firstProfile.fullName} - ${firstDesig}).`
      );
      err.status = 400;
      throw err;
    }

    // Workload validation (< 3 active schedules)
    const workloadRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM exam_schedules
       WHERE second_examiner_profile_id = ?
         AND id != ?
         AND workflow_status NOT IN ('APPROVED_LOCKED', 'CANCELLED')`,
      [effectiveSecondExaminerId, scheduleId]
    );

    const activeWorkload = workloadRow?.total || 0;
    if (activeWorkload >= 3) {
      const err: any = new Error(
        `Load limit exceeded: Second Examiner ${secondProfile.fullName} has reached maximum workload limit (${activeWorkload}/3 active schedules).`
      );
      err.status = 400;
      throw err;
    }

    await withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE exam_schedules
         SET exam_date = ?,
             first_examiner_user_id = ?,
             second_examiner_profile_id = ?,
             activated_by = ?,
             workflow_status = ?,
             workflow_started_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [examDate, firstExaminerUserId, effectiveSecondExaminerId, hodUserId, WorkflowStatus.SCHEDULED, scheduleId]
      );

      await conn.execute(
        `INSERT INTO first_markings (exam_schedule_id) VALUES (?) ON DUPLICATE KEY UPDATE id=id`,
        [scheduleId]
      );

      await conn.execute(
        `INSERT INTO second_markings (exam_schedule_id) VALUES (?) ON DUPLICATE KEY UPDATE id=id`,
        [scheduleId]
      );

      await conn.execute(
        `INSERT INTO final_results (exam_schedule_id) VALUES (?) ON DUPLICATE KEY UPDATE id=id`,
        [scheduleId]
      );
    });

    const updated = await ScheduleRepository.getById(scheduleId);

    await AuditService.logEvent({
      examScheduleId: scheduleId,
      actorUserId: hodUserId,
      eventType: 'SCHEDULE_ACTIVATED',
      fromStatus: WorkflowStatus.DRAFT,
      toStatus: WorkflowStatus.SCHEDULED,
      description: `Exam schedule planned and activated by HOD with First Examiner (${firstProfile.fullName}) and Second Examiner (${secondProfile.fullName}) with exam date ${examDate.toISOString().split('T')[0]}.`
    });

    if (updated?.courseOffering?.course) {
      await AuditService.notify(
        firstExaminerUserId,
        'Exam Schedule Assigned',
        `You have been assigned as First Examiner for ${updated.courseOffering.course.courseCode}.`,
        'SCHEDULE_ASSIGNED',
        scheduleId
      );

      if (secondProfile.user_id) {
        await AuditService.notify(
          secondProfile.user_id,
          'Second Examiner Assignment Confirmed',
          `You have been assigned as Second Examiner for ${updated.courseOffering.course.courseCode}.`,
          'SCHEDULE_ASSIGNED',
          scheduleId
        );
      }
    }

    return updated;
  }

  // AR generates collection otp for lecturer handover
  static async arGenerateCollectionOtp(
    scheduleId: number,
    scriptCount: number,
    arUserId: number
  ) {
    await this.assertNotLocked(scheduleId);

    const schedule = await queryOne<any>(
      `SELECT s.id, s.exam_date AS examDate, s.first_examiner_user_id AS firstExaminerUserId,
              s.workflow_status AS workflowStatus,
              u.id AS fe_id, u.full_name AS fe_fullName, u.email AS fe_email, u.designation AS fe_designation,
              c.course_code AS courseCode, c.course_title AS courseTitle
       FROM exam_schedules s
       LEFT JOIN users u ON s.first_examiner_user_id = u.id
       LEFT JOIN course_offerings co ON s.course_offering_id = co.id
       LEFT JOIN courses c ON co.course_id = c.id
       WHERE s.id = ?`,
      [scheduleId]
    );

    if (!schedule) {
      const err: any = new Error('Exam schedule not found.');
      err.status = 404;
      throw err;
    }

    if (!schedule.firstExaminerUserId || !schedule.fe_id) {
      const err: any = new Error('Cannot generate collection OTP: First Examiner has not been assigned to this schedule.');
      err.status = 400;
      throw err;
    }

    const effectiveScriptCount = scriptCount && scriptCount > 0 ? scriptCount : 50;

    // Generate single-use OTP for the First Examiner
    const otpRes = await OtpService.requestOtp(scheduleId, schedule.firstExaminerUserId, OtpActionType.SCRIPT_COLLECTION);

    // Upsert First Marking state
    await execute(
      `INSERT INTO first_markings (exam_schedule_id, script_count, collection_requested_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE script_count = VALUES(script_count), collection_requested_at = NOW()`,
      [scheduleId, effectiveScriptCount]
    );

    await execute(
      `UPDATE exam_schedules SET workflow_status = ? WHERE id = ?`,
      [WorkflowStatus.FIRST_COLLECTION_REQUESTED, scheduleId]
    );

    // Auto-customized email alert dispatched to First Examiner
    await EmailService.sendExamEndedCollectionCall({
      scheduleId,
      courseCode: schedule.courseCode || '',
      courseTitle: schedule.courseTitle || '',
      lecturerUser: {
        id: schedule.fe_id,
        fullName: schedule.fe_fullName,
        designation: schedule.fe_designation || undefined,
        email: schedule.fe_email,
      },
      otp: otpRes.otp,
      scriptCount: effectiveScriptCount,
      examDate: schedule.examDate,
    });

    await AuditService.logEvent({
      examScheduleId: scheduleId,
      actorUserId: arUserId,
      eventType: 'COLLECTION_OTP_GENERATED_BY_AR',
      fromStatus: schedule.workflowStatus,
      toStatus: WorkflowStatus.FIRST_COLLECTION_REQUESTED,
      description: `AR Office generated collection OTP (${otpRes.otp}) and dispatched email alert to First Examiner (${schedule.fe_fullName}) for ${effectiveScriptCount} scripts.`
    });

    return {
      success: true,
      otp: otpRes.otp,
      expiresAt: otpRes.expiresAt,
      scriptCount: effectiveScriptCount,
      recipientName: schedule.fe_fullName,
      recipientEmail: schedule.fe_email,
      message: `Collection OTP generated successfully. Email notification sent to ${schedule.fe_fullName}.`
    };
  }

  // lecturer requests collection otp and gives estimated script count
  static async requestCollectionOtp(
    scheduleId: number,
    scriptCount: number,
    lecturerUserId: number
  ) {
    await this.assertNotLocked(scheduleId);

    if (scriptCount <= 0) {
      const err: any = new Error('Script count must be a positive integer.');
      err.status = 400;
      throw err;
    }

    const schedule = await queryOne<any>(
      `SELECT s.id, s.exam_date AS examDate, s.first_examiner_user_id AS firstExaminerUserId,
              s.workflow_status AS workflowStatus,
              u.id AS fe_id, u.full_name AS fe_fullName, u.email AS fe_email, u.designation AS fe_designation,
              c.course_code AS courseCode, c.course_title AS courseTitle
       FROM exam_schedules s
       LEFT JOIN users u ON s.first_examiner_user_id = u.id
       LEFT JOIN course_offerings co ON s.course_offering_id = co.id
       LEFT JOIN courses c ON co.course_id = c.id
       WHERE s.id = ?`,
      [scheduleId]
    );

    if (!schedule || schedule.firstExaminerUserId !== lecturerUserId) {
      const err: any = new Error('Unauthorized: Only the assigned First Examiner can request collection OTP.');
      err.status = 403;
      throw err;
    }

    // Generate OTP
    const otpRes = await OtpService.requestOtp(scheduleId, lecturerUserId, OtpActionType.SCRIPT_COLLECTION);

    // Update first marking script count and collection requested timestamp
    await execute(
      `INSERT INTO first_markings (exam_schedule_id, script_count, collection_requested_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE script_count = VALUES(script_count), collection_requested_at = NOW()`,
      [scheduleId, scriptCount]
    );

    await execute(
      `UPDATE exam_schedules SET workflow_status = ? WHERE id = ?`,
      [WorkflowStatus.FIRST_COLLECTION_REQUESTED, scheduleId]
    );

    // Auto-customized email alert dispatched to First Examiner
    if (schedule.fe_id) {
      await EmailService.sendExamEndedCollectionCall({
        scheduleId,
        courseCode: schedule.courseCode || '',
        courseTitle: schedule.courseTitle || '',
        lecturerUser: {
          id: schedule.fe_id,
          fullName: schedule.fe_fullName,
          designation: schedule.fe_designation || undefined,
          email: schedule.fe_email,
        },
        otp: otpRes.otp,
        scriptCount,
        examDate: schedule.examDate,
      });
    }

    await AuditService.logEvent({
      examScheduleId: scheduleId,
      actorUserId: lecturerUserId,
      eventType: 'COLLECTION_OTP_REQUESTED',
      fromStatus: schedule.workflowStatus,
      toStatus: WorkflowStatus.FIRST_COLLECTION_REQUESTED,
      description: `First examiner requested collection OTP for ${scriptCount} scripts.`
    });

    return {
      otp: otpRes.otp,
      expiresAt: otpRes.expiresAt,
      scriptCount
    };
  }

  // First Examiner confirms receipt of scripts from AR Office using OTP (or AR verifies at counter)
  static async verifyCollectionOtp(
    scheduleId: number,
    candidateOtp: string,
    verifierUserId: number
  ) {
    await this.assertNotLocked(scheduleId);

    const schedule = await queryOne<any>(
      `SELECT s.id, s.first_examiner_user_id AS firstExaminerUserId,
              s.workflow_status AS workflowStatus,
              u.full_name AS fe_fullName
       FROM exam_schedules s
       LEFT JOIN users u ON s.first_examiner_user_id = u.id
       WHERE s.id = ?`,
      [scheduleId]
    );

    if (!schedule) {
      const err: any = new Error('Exam schedule not found.');
      err.status = 404;
      throw err;
    }

    // Check if verifier is the assigned First Examiner or AR / HOD staff
    const isFirstExaminer = schedule.firstExaminerUserId === verifierUserId;
    if (!isFirstExaminer) {
      const staffRoles = await query<any>(
        `SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?`,
        [verifierUserId]
      );
      const roleNames = staffRoles.map((r: any) => r.name);
      const isStaffAuthorized = roleNames.includes(RoleName.AR_OFFICE) || roleNames.includes(RoleName.HOD) || roleNames.includes(RoleName.DEAN);
      if (!isStaffAuthorized) {
        const err: any = new Error('Unauthorized: Only the assigned First Examiner or Examinations Branch (AR Office) can confirm script collection.');
        err.status = 403;
        throw err;
      }
    }

    const verification = await OtpService.verifyOtp(
      scheduleId,
      OtpActionType.SCRIPT_COLLECTION,
      candidateOtp,
      verifierUserId
    );

    if (!verification.success) {
      const err: any = new Error(verification.message);
      err.status = 400;
      throw err;
    }

    const collectedAt = new Date();
    const originalDueDate = calculateFirstMarkingDueDate(collectedAt);

    await withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE first_markings
         SET collected_at = ?, original_due_date = ?
         WHERE exam_schedule_id = ?`,
        [collectedAt, originalDueDate, scheduleId]
      );

      await conn.execute(
        `UPDATE exam_schedules
         SET workflow_status = ?
         WHERE id = ?`,
        [WorkflowStatus.FIRST_MARKING_ACTIVE, scheduleId]
      );
    });

    const eventDescription = isFirstExaminer
      ? `First Examiner (${schedule.fe_fullName || 'Lecturer'}) confirmed physical collection of scripts from AR Office. 3-month grading deadline set to ${originalDueDate.toISOString().split('T')[0]}.`
      : `Physical script collection verified by AR Office for First Examiner (${schedule.fe_fullName || 'Lecturer'}). 3-month grading deadline set to ${originalDueDate.toISOString().split('T')[0]}.`;

    await AuditService.logEvent({
      examScheduleId: scheduleId,
      actorUserId: verifierUserId,
      eventType: 'SCRIPTS_COLLECTED_VERIFIED',
      fromStatus: WorkflowStatus.FIRST_COLLECTION_REQUESTED,
      toStatus: WorkflowStatus.FIRST_MARKING_ACTIVE,
      description: eventDescription
    });

    return {
      success: true,
      collectedAt,
      originalDueDate,
      message: isFirstExaminer
        ? 'Physical script collection successfully confirmed by First Examiner.'
        : 'Physical script collection successfully verified by AR Office.'
    };
  }

  /**
   * First Examiner uploads First Marking Report PDF.
   */
  /**
   * Validates if first marking report can be uploaded.
   * Enforces that scripts have been collected, report hasn't been uploaded yet, and scripts haven't been returned yet.
   */
  static async validateFirstMarkingReportUpload(scheduleId: number, lecturerUserId: number) {
    await this.assertNotLocked(scheduleId);

    const schedule = await queryOne<any>(
      `SELECT s.id, s.first_examiner_user_id AS firstExaminerUserId, s.workflow_status AS workflowStatus,
              fm.collected_at AS collectedAt,
              fm.returned_at AS returnedAt,
              fm.report_document_id AS reportDocumentId
       FROM exam_schedules s
       LEFT JOIN first_markings fm ON fm.exam_schedule_id = s.id
       WHERE s.id = ?`,
      [scheduleId]
    );

    if (!schedule || schedule.firstExaminerUserId !== lecturerUserId) {
      const err: any = new Error('Unauthorized: Only the assigned First Examiner can upload this report.');
      err.status = 403;
      throw err;
    }

    if (!schedule.collectedAt) {
      const err: any = new Error('Step Locked: Scripts must be collected and verified by AR before uploading 1st marking report.');
      err.status = 400;
      throw err;
    }

    if (schedule.reportDocumentId) {
      const err: any = new Error('Step Locked: 1st marking report has already been submitted and is locked.');
      err.status = 400;
      throw err;
    }

    if (schedule.returnedAt) {
      const err: any = new Error('Step Locked: Scripts have already been returned; 1st marking report is locked.');
      err.status = 400;
      throw err;
    }

    return schedule;
  }

  /**
   * First Examiner uploads First Marking Report PDF.
   */
  static async recordFirstMarkingReport(
    scheduleId: number,
    documentId: number,
    lecturerUserId: number
  ) {
    const schedule = await this.validateFirstMarkingReportUpload(scheduleId, lecturerUserId);

    await execute(
      `UPDATE first_markings 
       SET report_document_id = ? 
       WHERE exam_schedule_id = ?`,
      [documentId, scheduleId]
    );

    // Check if scripts already returned
    if (schedule.returnedAt) {
      await execute(
        `UPDATE exam_schedules SET workflow_status = ? WHERE id = ?`,
        [WorkflowStatus.SECOND_MARKING_READY, scheduleId]
      );
    }

    await AuditService.logEvent({
      examScheduleId: scheduleId,
      actorUserId: lecturerUserId,
      eventType: 'FIRST_MARKING_REPORT_UPLOADED',
      fromStatus: schedule.workflowStatus,
      toStatus: schedule.returnedAt ? WorkflowStatus.SECOND_MARKING_READY : schedule.workflowStatus,
      description: 'First Marking Report PDF uploaded by First Examiner.'
    });

    return await queryOne<any>(`SELECT * FROM first_markings WHERE exam_schedule_id = ?`, [scheduleId]);
  }

  // lecturer requests return otp before bringing papers back to AR office
  static async requestReturnOtp(
    scheduleId: number,
    lecturerUserId: number
  ) {
    await this.assertNotLocked(scheduleId);

    const schedule = await queryOne<any>(
      `SELECT s.id, s.first_examiner_user_id AS firstExaminerUserId,
              fm.report_document_id AS reportDocumentId,
              fm.returned_at AS returnedAt
       FROM exam_schedules s
       LEFT JOIN first_markings fm ON fm.exam_schedule_id = s.id
       WHERE s.id = ?`,
      [scheduleId]
    );

    if (!schedule || schedule.firstExaminerUserId !== lecturerUserId) {
      const err: any = new Error('Unauthorized: Only the assigned First Examiner can request return OTP.');
      err.status = 403;
      throw err;
    }

    if (!schedule.reportDocumentId) {
      const err: any = new Error('Step Locked: 1st Marking Report PDF must be uploaded before returning scripts to AR Office.');
      err.status = 400;
      throw err;
    }

    if (schedule.returnedAt) {
      const err: any = new Error('Step Locked: Scripts have already been returned and confirmed by AR.');
      err.status = 400;
      throw err;
    }

    const otpRes = await OtpService.requestOtp(scheduleId, lecturerUserId, OtpActionType.SCRIPT_RETURN);

    await AuditService.logEvent({
      examScheduleId: scheduleId,
      actorUserId: lecturerUserId,
      eventType: 'RETURN_OTP_REQUESTED',
      fromStatus: WorkflowStatus.FIRST_MARKING_ACTIVE,
      toStatus: WorkflowStatus.FIRST_MARKING_ACTIVE,
      description: 'First Examiner generated script return OTP for handover to Examinations Branch (AR Office).'
    });

    return {
      success: true,
      otp: otpRes.otp,
      expiresAt: otpRes.expiresAt,
      message: 'Return handover OTP generated successfully. Provide this code to the AR Office upon script handover.'
    };
  }

  // AR verifies return otp, marks scripts returned
  static async verifyReturnOtp(
    scheduleId: number,
    candidateOtp: string,
    arUserId: number
  ) {
    await this.assertNotLocked(scheduleId);

    const verification = await OtpService.verifyOtp(
      scheduleId,
      OtpActionType.SCRIPT_RETURN,
      candidateOtp,
      arUserId
    );

    if (!verification.success) {
      const err: any = new Error(verification.message);
      err.status = 400;
      throw err;
    }

    const returnedAt = new Date();

    await execute(
      `UPDATE first_markings SET returned_at = ? WHERE exam_schedule_id = ?`,
      [returnedAt, scheduleId]
    );

    const fm = await queryOne<any>(
      `SELECT report_document_id AS reportDocumentId, returned_at AS returnedAt FROM first_markings WHERE exam_schedule_id = ?`,
      [scheduleId]
    );

    // Check if both report uploaded and scripts returned
    const isFirstMarkingComplete = fm?.reportDocumentId !== null && fm?.returnedAt !== null;

    if (isFirstMarkingComplete) {
      await execute(
        `UPDATE exam_schedules SET workflow_status = ? WHERE id = ?`,
        [WorkflowStatus.SECOND_MARKING_READY, scheduleId]
      );
    }

    await AuditService.logEvent({
      examScheduleId: scheduleId,
      actorUserId: arUserId,
      eventType: 'SCRIPTS_RETURNED_VERIFIED',
      fromStatus: WorkflowStatus.FIRST_MARKING_ACTIVE,
      toStatus: isFirstMarkingComplete ? WorkflowStatus.SECOND_MARKING_READY : WorkflowStatus.FIRST_MARKING_ACTIVE,
      description: 'Physical scripts return verified by AR Office.'
    });

    return {
      success: true,
      returnedAt,
      isFirstMarkingComplete,
      message: 'Physical scripts return verified successfully.'
    };
  }

  // AR dispatches scripts to second marker with courier ref, starts 1 month deadline
  static async recordCourierDispatch(
    scheduleId: number,
    courierReference: string | undefined,
    arUserId: number
  ) {
    await this.assertNotLocked(scheduleId);

    const schedule = await queryOne<any>(
      `SELECT s.id, s.second_examiner_profile_id AS secondExaminerProfileId, s.workflow_status AS workflowStatus,
              fm.report_document_id AS fmReportDocId, fm.returned_at AS fmReturnedAt,
              sm.courier_dispatched_at AS smCourierDispatchedAt,
              c.course_code AS courseCode, c.course_title AS courseTitle,
              seu.id AS seuId, seu.full_name AS seuFullName, seu.email AS seuEmail
       FROM exam_schedules s
       LEFT JOIN first_markings fm ON fm.exam_schedule_id = s.id
       LEFT JOIN second_markings sm ON sm.exam_schedule_id = s.id
       LEFT JOIN course_offerings co ON s.course_offering_id = co.id
       LEFT JOIN courses c ON co.course_id = c.id
       LEFT JOIN examiner_profiles sep ON s.second_examiner_profile_id = sep.id
       LEFT JOIN users seu ON sep.user_id = seu.id
       WHERE s.id = ?`,
      [scheduleId]
    );

    if (!schedule) {
      const err: any = new Error('Schedule not found');
      err.status = 404;
      throw err;
    }

    if (schedule.smCourierDispatchedAt) {
      const err: any = new Error('Step Locked: Courier has already been dispatched for this schedule.');
      err.status = 400;
      throw err;
    }

    if (!schedule.secondExaminerProfileId) {
      const err: any = new Error('Second Examiner has not been assigned yet.');
      err.status = 400;
      throw err;
    }

    if (!schedule.fmReportDocId || !schedule.fmReturnedAt) {
      const err: any = new Error('Phase Lock Violation: First marking report and returned scripts are required before courier dispatch.');
      err.status = 400;
      throw err;
    }

    const courierDispatchedAt = new Date();
    const originalDueDate = calculateSecondMarkingDueDate(courierDispatchedAt);

    await withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE second_markings 
         SET courier_dispatched_at = ?, courier_reference = ?, original_due_date = ?
         WHERE exam_schedule_id = ?`,
        [courierDispatchedAt, courierReference ?? null, originalDueDate, scheduleId]
      );

      await conn.execute(
        `UPDATE exam_schedules SET workflow_status = ? WHERE id = ?`,
        [WorkflowStatus.SECOND_MARKING_ACTIVE, scheduleId]
      );
    });

    await AuditService.logEvent({
      examScheduleId: scheduleId,
      actorUserId: arUserId,
      eventType: 'COURIER_DISPATCHED',
      fromStatus: schedule.workflowStatus,
      toStatus: WorkflowStatus.SECOND_MARKING_ACTIVE,
      description: `Scripts dispatched by courier (Ref: ${courierReference || 'N/A'}). 1-month due date set to ${originalDueDate.toISOString().split('T')[0]}.`
    });

    if (schedule.seuId) {
      await AuditService.notify(
        schedule.seuId,
        'Scripts Couriered',
        `Scripts have been dispatched to you for second marking (Ref: ${courierReference || 'N/A'}). Please acknowledge receipt once received.`,
        'COURIER_DISPATCHED',
        scheduleId
      );

      await EmailService.sendCourierDispatched({
        scheduleId,
        courseCode: schedule.courseCode || '',
        courseTitle: schedule.courseTitle || '',
        secondExaminerUser: {
          id: schedule.seuId,
          fullName: schedule.seuFullName,
          email: schedule.seuEmail,
        },
        courierReference,
        dueDate: originalDueDate,
      });
    }

    return {
      success: true,
      courierDispatchedAt,
      originalDueDate,
    };
  }

  // second marker acknowledges they received the courier parcel
  static async acknowledgeCourierReceipt(
    scheduleId: number,
    secondExaminerUserId: number
  ) {
    await this.assertNotLocked(scheduleId);

    const schedule = await queryOne<any>(
      `SELECT s.id, s.workflow_status AS workflowStatus, sep.user_id AS secondExaminerUserId,
              sm.courier_dispatched_at AS courierDispatchedAt,
              sm.acknowledged_at AS acknowledgedAt
       FROM exam_schedules s
       LEFT JOIN examiner_profiles sep ON s.second_examiner_profile_id = sep.id
       LEFT JOIN second_markings sm ON sm.exam_schedule_id = s.id
       WHERE s.id = ?`,
      [scheduleId]
    );

    if (!schedule || schedule.secondExaminerUserId !== secondExaminerUserId) {
      const err: any = new Error('Unauthorized: Only the assigned Second Examiner can acknowledge receipt.');
      err.status = 403;
      throw err;
    }

    if (!schedule.courierDispatchedAt) {
      const err: any = new Error('Step Locked: Courier must be dispatched before acknowledging receipt.');
      err.status = 400;
      throw err;
    }

    if (schedule.acknowledgedAt) {
      const err: any = new Error('Step Locked: Receipt of scripts has already been acknowledged.');
      err.status = 400;
      throw err;
    }

    const acknowledgedAt = new Date();

    await execute(
      `UPDATE second_markings SET acknowledged_at = ? WHERE exam_schedule_id = ?`,
      [acknowledgedAt, scheduleId]
    );

    await AuditService.logEvent({
      examScheduleId: scheduleId,
      actorUserId: secondExaminerUserId,
      eventType: 'COURIER_RECEIPT_ACKNOWLEDGED',
      fromStatus: schedule.workflowStatus,
      toStatus: schedule.workflowStatus,
      description: 'Second examiner acknowledged receipt of physical scripts.'
    });

    return { success: true, acknowledgedAt };
  }

  /**
   * Validates if second marking report can be uploaded.
   * Enforces courier dispatched, receipt acknowledged, report not yet uploaded, and not yet received by AR.
   */
  static async validateSecondMarkingReportUpload(scheduleId: number, secondExaminerUserId: number) {
    await this.assertNotLocked(scheduleId);

    const schedule = await queryOne<any>(
      `SELECT s.id, s.workflow_status AS workflowStatus, sep.user_id AS secondExaminerUserId,
              sm.courier_dispatched_at AS courierDispatchedAt,
              sm.acknowledged_at AS acknowledgedAt,
              sm.report_document_id AS reportDocumentId,
              sm.ar_received_at AS arReceivedAt
       FROM exam_schedules s
       LEFT JOIN examiner_profiles sep ON s.second_examiner_profile_id = sep.id
       LEFT JOIN second_markings sm ON sm.exam_schedule_id = s.id
       WHERE s.id = ?`,
      [scheduleId]
    );

    if (!schedule || schedule.secondExaminerUserId !== secondExaminerUserId) {
      const err: any = new Error('Unauthorized: Only the assigned Second Examiner can upload this report.');
      err.status = 403;
      throw err;
    }

    if (!schedule.courierDispatchedAt) {
      const err: any = new Error('Step Locked: Courier must be dispatched before uploading 2nd marking report.');
      err.status = 400;
      throw err;
    }

    if (!schedule.acknowledgedAt) {
      const err: any = new Error('Step Locked: Receipt of scripts must be acknowledged before uploading 2nd marking report.');
      err.status = 400;
      throw err;
    }

    if (schedule.reportDocumentId) {
      const err: any = new Error('Step Locked: 2nd marking report has already been submitted and is locked.');
      err.status = 400;
      throw err;
    }

    if (schedule.arReceivedAt) {
      const err: any = new Error('Step Locked: Scripts have already been returned to AR; 2nd marking report is locked.');
      err.status = 400;
      throw err;
    }

    return schedule;
  }

  // second examiner uploads report pdf, locks step once uploaded
  static async recordSecondMarkingReport(
    scheduleId: number,
    documentId: number,
    secondExaminerUserId: number
  ) {
    const schedule = await this.validateSecondMarkingReportUpload(scheduleId, secondExaminerUserId);

    await execute(
      `UPDATE second_markings SET report_document_id = ? WHERE exam_schedule_id = ?`,
      [documentId, scheduleId]
    );

    // Check if scripts returned to AR
    if (schedule.arReceivedAt) {
      await execute(
        `UPDATE exam_schedules SET workflow_status = ? WHERE id = ?`,
        [WorkflowStatus.SECOND_MARKING_COMPLETE, scheduleId]
      );
    }

    await AuditService.logEvent({
      examScheduleId: scheduleId,
      actorUserId: secondExaminerUserId,
      eventType: 'SECOND_MARKING_REPORT_UPLOADED',
      fromStatus: schedule.workflowStatus,
      toStatus: schedule.arReceivedAt ? WorkflowStatus.SECOND_MARKING_COMPLETE : schedule.workflowStatus,
      description: 'Second Marker Report PDF uploaded.'
    });

    return await queryOne<any>(`SELECT * FROM second_markings WHERE exam_schedule_id = ?`, [scheduleId]);
  }

  // AR confirms returned scripts arrived back from second examiner
  static async confirmArReceipt(
    scheduleId: number,
    arUserId: number
  ) {
    await this.assertNotLocked(scheduleId);

    const sm = await queryOne<any>(
      `SELECT report_document_id AS reportDocumentId, ar_received_at AS arReceivedAt
       FROM second_markings WHERE exam_schedule_id = ?`,
      [scheduleId]
    );

    if (!sm?.reportDocumentId) {
      const err: any = new Error('Step Locked: Second Examiner must upload 2nd Marking Report before script return can be confirmed.');
      err.status = 400;
      throw err;
    }

    if (sm?.arReceivedAt) {
      const err: any = new Error('Step Locked: Scripts return has already been confirmed by AR Office.');
      err.status = 400;
      throw err;
    }

    const arReceivedAt = new Date();

    await execute(
      `UPDATE second_markings SET ar_received_at = ? WHERE exam_schedule_id = ?`,
      [arReceivedAt, scheduleId]
    );

    const isComplete = sm?.reportDocumentId !== null && arReceivedAt !== null;

    if (isComplete) {
      await execute(
        `UPDATE exam_schedules SET workflow_status = ? WHERE id = ?`,
        [WorkflowStatus.SECOND_MARKING_COMPLETE, scheduleId]
      );

      // Notify First Examiner that Second Marking is complete
      const schedule = await queryOne<any>(
        `SELECT s.id, u.id AS feId, u.full_name AS feFullName, u.email AS feEmail,
                c.course_code AS courseCode, c.course_title AS courseTitle
         FROM exam_schedules s
         LEFT JOIN users u ON s.first_examiner_user_id = u.id
         LEFT JOIN course_offerings co ON s.course_offering_id = co.id
         LEFT JOIN courses c ON co.course_id = c.id
         WHERE s.id = ?`,
        [scheduleId]
      );

      if (schedule?.feId) {
        await AuditService.notify(
          schedule.feId,
          'Second Marking Completed',
          'Second marking report and scripts have been received. You can now download the report and prepare the final marksheet.',
          'SECOND_MARKING_COMPLETE',
          scheduleId
        );

        await EmailService.sendSecondMarkingComplete({
          scheduleId,
          courseCode: schedule.courseCode || '',
          courseTitle: schedule.courseTitle || '',
          firstExaminerUser: {
            id: schedule.feId,
            fullName: schedule.feFullName,
            email: schedule.feEmail,
          }
        });
      }
    }

    await AuditService.logEvent({
      examScheduleId: scheduleId,
      actorUserId: arUserId,
      eventType: 'AR_RECEIVED_RETURNED_SCRIPTS',
      fromStatus: WorkflowStatus.SECOND_MARKING_ACTIVE,
      toStatus: isComplete ? WorkflowStatus.SECOND_MARKING_COMPLETE : WorkflowStatus.SECOND_MARKING_ACTIVE,
      description: 'AR Office confirmed physical receipt of scripts returned from Second Examiner.'
    });

    return { success: true, arReceivedAt, isComplete };
  }

  /**
   * First Examiner uploads Final Marksheet PDF.
   */
  /**
   * Validates if final marksheet can be uploaded.
   * Enforces that second marking scripts return is completed, and marksheet is not already submitted/approved.
   */
  static async validateFinalMarksheetUpload(scheduleId: number, lecturerUserId: number) {
    await this.assertNotLocked(scheduleId);

    const schedule = await queryOne<any>(
      `SELECT s.id, s.first_examiner_user_id AS firstExaminerUserId, s.workflow_status AS workflowStatus,
              sm.report_document_id AS smReportDocId, sm.ar_received_at AS smArReceivedAt,
              fr.submission_status AS frSubmissionStatus
       FROM exam_schedules s
       LEFT JOIN second_markings sm ON sm.exam_schedule_id = s.id
       LEFT JOIN final_results fr ON fr.exam_schedule_id = s.id
       WHERE s.id = ?`,
      [scheduleId]
    );

    if (!schedule || schedule.firstExaminerUserId !== lecturerUserId) {
      const err: any = new Error('Unauthorized: Only the assigned First Examiner can upload the final marksheet.');
      err.status = 403;
      throw err;
    }

    if (!schedule.smReportDocId || !schedule.smArReceivedAt) {
      const err: any = new Error('Step Locked: Phase 2 (Second Marking and script return) must be completed before uploading final marksheet.');
      err.status = 400;
      throw err;
    }

    if (schedule.frSubmissionStatus === 'SUBMITTED' || schedule.frSubmissionStatus === 'APPROVED') {
      const err: any = new Error('Step Locked: Final marksheet has already been submitted to HOD and is locked for review.');
      err.status = 400;
      throw err;
    }

    return schedule;
  }

  /**
   * First Examiner uploads Final Marksheet PDF.
   */
  static async recordFinalMarksheet(
    scheduleId: number,
    documentId: number,
    lecturerUserId: number
  ) {
    const schedule = await this.validateFinalMarksheetUpload(scheduleId, lecturerUserId);

    await execute(
      `UPDATE final_results SET final_marksheet_document_id = ? WHERE exam_schedule_id = ?`,
      [documentId, scheduleId]
    );

    await AuditService.logEvent({
      examScheduleId: scheduleId,
      actorUserId: lecturerUserId,
      eventType: 'FINAL_MARKSHEET_UPLOADED',
      fromStatus: schedule.workflowStatus,
      toStatus: schedule.workflowStatus,
      description: 'Final Marksheet PDF uploaded by First Examiner.'
    });

    return await queryOne<any>(`SELECT * FROM final_results WHERE exam_schedule_id = ?`, [scheduleId]);
  }

  // submit final marksheet to HOD, locks against edits while under review
  static async submitFinalMarksheet(
    scheduleId: number,
    lecturerUserId: number
  ) {
    await this.assertNotLocked(scheduleId);

    const schedule = await queryOne<any>(
      `SELECT s.id, s.first_examiner_user_id AS firstExaminerUserId, s.workflow_status AS workflowStatus,
              sm.report_document_id AS smReportDocId, sm.ar_received_at AS smArReceivedAt,
              fr.final_marksheet_document_id AS frMarksheetDocId,
              fr.submission_status AS frSubmissionStatus,
              u.id AS feId, u.full_name AS feFullName,
              c.course_code AS courseCode, c.course_title AS courseTitle
       FROM exam_schedules s
       LEFT JOIN second_markings sm ON sm.exam_schedule_id = s.id
       LEFT JOIN final_results fr ON fr.exam_schedule_id = s.id
       LEFT JOIN users u ON s.first_examiner_user_id = u.id
       LEFT JOIN course_offerings co ON s.course_offering_id = co.id
       LEFT JOIN courses c ON co.course_id = c.id
       WHERE s.id = ?`,
      [scheduleId]
    );

    if (!schedule || schedule.firstExaminerUserId !== lecturerUserId) {
      const err: any = new Error('Unauthorized: Only the assigned First Examiner can submit the final marksheet.');
      err.status = 403;
      throw err;
    }

    if (!schedule.frMarksheetDocId) {
      const err: any = new Error('Please upload the Final Marksheet PDF before submitting.');
      err.status = 400;
      throw err;
    }

    if (!schedule.smReportDocId || !schedule.smArReceivedAt) {
      const err: any = new Error('Step Locked: Second marking must be completed before submitting final marksheet.');
      err.status = 400;
      throw err;
    }

    if (schedule.frSubmissionStatus === 'SUBMITTED' || schedule.frSubmissionStatus === 'APPROVED') {
      const err: any = new Error('Step Locked: Final marksheet has already been submitted to HOD.');
      err.status = 400;
      throw err;
    }

    const submittedAt = new Date();

    await withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE final_results 
         SET submission_status = 'SUBMITTED', submitted_at = ?
         WHERE exam_schedule_id = ?`,
        [submittedAt, scheduleId]
      );

      await conn.execute(
        `UPDATE exam_schedules SET workflow_status = ? WHERE id = ?`,
        [WorkflowStatus.FINAL_MARKSHEET_SUBMITTED, scheduleId]
      );
    });

    // Alert HOD via email
    const hodUser = await queryOne<any>(
      `SELECT u.id, u.full_name AS fullName, u.email 
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON ur.role_id = r.id
       WHERE r.name = 'HOD'
       LIMIT 1`
    );

    if (hodUser && schedule.feFullName) {
      await EmailService.sendFinalMarksheetSubmitted({
        scheduleId,
        courseCode: schedule.courseCode || '',
        courseTitle: schedule.courseTitle || '',
        firstExaminerUser: {
          fullName: schedule.feFullName,
        },
        hodUser: {
          id: hodUser.id,
          fullName: hodUser.fullName,
          email: hodUser.email,
        }
      });
    }

    await AuditService.logEvent({
      examScheduleId: scheduleId,
      actorUserId: lecturerUserId,
      eventType: 'FINAL_MARKSHEET_SUBMITTED',
      fromStatus: schedule.workflowStatus,
      toStatus: WorkflowStatus.FINAL_MARKSHEET_SUBMITTED,
      description: 'Final Marksheet submitted to HOD for review.'
    });

    return { success: true, submittedAt };
  }

  // HOD can request changes if corrections are needed
  static async requestChanges(
    scheduleId: number,
    revisionReason: string,
    hodUserId: number
  ) {
    await this.assertNotLocked(scheduleId);

    if (!revisionReason || revisionReason.trim().length === 0) {
      const err: any = new Error('A revision reason is required when requesting changes.');
      err.status = 400;
      throw err;
    }

    const schedule = await queryOne<any>(
      `SELECT first_examiner_user_id AS firstExaminerUserId, workflow_status AS workflowStatus 
       FROM exam_schedules WHERE id = ?`,
      [scheduleId]
    );

    await withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE final_results 
         SET submission_status = 'CHANGES_REQUESTED',
             hod_approval_status = 'CHANGES_REQUESTED',
             revision_reason = ?
         WHERE exam_schedule_id = ?`,
        [revisionReason, scheduleId]
      );

      await conn.execute(
        `UPDATE exam_schedules SET workflow_status = ? WHERE id = ?`,
        [WorkflowStatus.FINAL_MARKSHEET_CHANGES_REQUESTED, scheduleId]
      );
    });

    await AuditService.logEvent({
      examScheduleId: scheduleId,
      actorUserId: hodUserId,
      eventType: 'CHANGES_REQUESTED',
      fromStatus: schedule?.workflowStatus || 'UNKNOWN',
      toStatus: WorkflowStatus.FINAL_MARKSHEET_CHANGES_REQUESTED,
      description: `HOD requested changes: "${revisionReason}"`
    });

    if (schedule?.firstExaminerUserId) {
      await AuditService.notify(
        schedule.firstExaminerUserId,
        'Revision Requested for Final Marksheet',
        `HOD has requested revisions: ${revisionReason}`,
        'CHANGES_REQUESTED',
        scheduleId
      );
    }

    return { success: true, message: 'Changes requested successfully.' };
  }

  // HOD grants final approval, permanently locks everything
  static async approveFinalMarksheet(
    scheduleId: number,
    hodUserId: number
  ) {
    await this.assertNotLocked(scheduleId);

    const schedule = await queryOne<any>(
      `SELECT s.id, s.first_examiner_user_id AS firstExaminerUserId, s.second_examiner_profile_id AS secondExaminerProfileId,
              s.workflow_status AS workflowStatus,
              fm.report_document_id AS fmReportDocId, fm.returned_at AS fmReturnedAt,
              sm.report_document_id AS smReportDocId, sm.ar_received_at AS smArReceivedAt,
              fr.final_marksheet_document_id AS frMarksheetDocId, fr.submission_status AS frSubmissionStatus,
              fe.id AS feId, fe.full_name AS feFullName, fe.email AS feEmail,
              c.course_code AS courseCode, c.course_title AS courseTitle
       FROM exam_schedules s
       LEFT JOIN first_markings fm ON fm.exam_schedule_id = s.id
       LEFT JOIN second_markings sm ON sm.exam_schedule_id = s.id
       LEFT JOIN final_results fr ON fr.exam_schedule_id = s.id
       LEFT JOIN users fe ON s.first_examiner_user_id = fe.id
       LEFT JOIN course_offerings co ON s.course_offering_id = co.id
       LEFT JOIN courses c ON co.course_id = c.id
       WHERE s.id = ?`,
      [scheduleId]
    );

    if (!schedule) {
      const err: any = new Error('Exam schedule not found');
      err.status = 404;
      throw err;
    }

    // Verify all checkpoints
    const errors: string[] = [];
    if (!schedule.firstExaminerUserId) errors.push('First Examiner not assigned.');
    if (!schedule.secondExaminerProfileId) errors.push('Second Examiner not assigned.');
    if (!schedule.fmReportDocId) errors.push('First Marking Report PDF not uploaded.');
    if (!schedule.fmReturnedAt) errors.push('First marking scripts not confirmed returned to AR.');
    if (!schedule.smReportDocId) errors.push('Second Marking Report PDF not uploaded.');
    if (!schedule.smArReceivedAt) errors.push('Second marking scripts not confirmed received by AR.');
    if (!schedule.frMarksheetDocId) errors.push('Final Marksheet PDF not uploaded.');
    if (schedule.frSubmissionStatus !== 'SUBMITTED') errors.push('Final Marksheet has not been submitted for review.');

    if (errors.length > 0) {
      const err: any = new Error(`Prerequisites not met for final approval: ${errors.join(', ')}`);
      err.status = 400;
      throw err;
    }

    const approvedAt = new Date();

    await withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE final_results 
         SET hod_approval_status = 'APPROVED',
             hod_approved_by = ?,
             hod_approved_at = ?,
             submission_status = 'APPROVED'
         WHERE exam_schedule_id = ?`,
        [hodUserId, approvedAt, scheduleId]
      );

      await conn.execute(
        `UPDATE exam_schedules 
         SET workflow_status = ?, locked_at = ?
         WHERE id = ?`,
        [WorkflowStatus.APPROVED_LOCKED, approvedAt, scheduleId]
      );
    });

    await AuditService.logEvent({
      examScheduleId: scheduleId,
      actorUserId: hodUserId,
      eventType: 'FINAL_APPROVAL_LOCKED',
      fromStatus: schedule.workflowStatus,
      toStatus: WorkflowStatus.APPROVED_LOCKED,
      description: 'HOD granted final approval. Workflow is now permanently locked.'
    });

    if (schedule.feId) {
      await AuditService.notify(
        schedule.feId,
        'Final Approval Granted',
        'Your final marksheet submission has received final approval from the HOD and the workflow is locked.',
        'FINAL_APPROVAL',
        scheduleId
      );

      const hodUser = await queryOne<{ full_name: string }>(`SELECT full_name FROM users WHERE id = ?`, [hodUserId]);

      await EmailService.sendFinalApprovalLocked({
        scheduleId,
        courseCode: schedule.courseCode || '',
        courseTitle: schedule.courseTitle || '',
        firstExaminerUser: {
          id: schedule.feId,
          fullName: schedule.feFullName,
          email: schedule.feEmail,
        },
        hodUser: {
          fullName: hodUser?.full_name || 'Head of Department'
        }
      });
    }

    return {
      success: true,
      approvedAt,
      message: 'Final approval granted and workflow permanently locked.'
    };
  }
}
