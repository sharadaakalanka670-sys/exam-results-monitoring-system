import { query, queryOne } from '../config/db';

/**
 * Maps raw joined SQL database rows into a fully-hydrated, clean TypeScript ExamSchedule structure.
 */
export class ScheduleRepository {
  /**
   * Fetch a single exam schedule by ID with full nested relational data.
   */
  static async getById(scheduleId: number): Promise<any | null> {
    const s = await queryOne<any>(
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

        -- Course Offering details
        co.id AS co_id,
        co.course_id AS co_course_id,
        co.programme_group AS co_programme_group,
        co.batch_label AS co_batch_label,
        co.year_of_study AS co_year_of_study,
        co.semester AS co_semester,
        co.academic_session_start AS co_academic_session_start,
        co.academic_session_end AS co_academic_session_end,
        co.teaching_type AS co_teaching_type,
        co.notes AS co_notes,
        co.source_document AS co_source_document,
        co.source_review_status AS co_source_review_status,

        -- Course details
        c.id AS c_id,
        c.course_code AS c_course_code,
        c.course_title AS c_course_title,
        c.description AS c_description,
        NULL AS c_credits,
        c.active AS c_active,

        -- Lecturer in charge
        sd.id AS lic_id,
        sd.full_name AS lic_full_name,
        sd.source_kind AS lic_source_kind,
        sd.review_status AS lic_review_status,

        -- First Examiner
        fe.id AS fe_id,
        fe.full_name AS fe_full_name,
        fe.email AS fe_email,
        fe.designation AS fe_designation,
        fe.profile_picture_url AS fe_profile_picture_url,
        fep.seniority_level AS fe_seniority_level,

        -- Second Examiner Profile & User
        sep.id AS se_id,
        sep.seniority_level AS se_seniority_level,
        sep.examiner_type AS se_examiner_type,
        sep.institution AS se_institution,
        seu.id AS seu_id,
        seu.full_name AS seu_full_name,
        seu.email AS seu_email,
        seu.designation AS seu_designation,
        seu.profile_picture_url AS seu_profile_picture_url,

        -- First Marking
        fm.id AS fm_id,
        fm.script_count AS fm_script_count,
        fm.collection_requested_at AS fm_collection_requested_at,
        fm.collected_at AS fm_collected_at,
        fm.original_due_date AS fm_original_due_date,
        fm.extended_due_date AS fm_extended_due_date,
        fm.returned_at AS fm_returned_at,
        fm.report_document_id AS fm_report_document_id,

        -- Second Marking
        sm.id AS sm_id,
        sm.courier_dispatched_at AS sm_courier_dispatched_at,
        sm.original_due_date AS sm_original_due_date,
        sm.extended_due_date AS sm_extended_due_date,
        sm.acknowledged_at AS sm_acknowledged_at,
        sm.report_document_id AS sm_report_document_id,
        sm.ar_received_at AS sm_ar_received_at,
        sm.courier_reference AS sm_courier_reference,

        -- Final Result
        fr.id AS fr_id,
        fr.final_marksheet_document_id AS fr_final_marksheet_document_id,
        fr.submission_status AS fr_submission_status,
        fr.submitted_at AS fr_submitted_at,
        fr.hod_approval_status AS fr_hod_approval_status,
        fr.hod_approved_by AS fr_hod_approved_by,
        fr.hod_approved_at AS fr_hod_approved_at,
        fr.hardcopy_submitted_at AS fr_hardcopy_submitted_at,
        fr.revision_reason AS fr_revision_reason

       FROM exam_schedules s
       LEFT JOIN course_offerings co ON s.course_offering_id = co.id
       LEFT JOIN courses c ON co.course_id = c.id
       LEFT JOIN staff_directory sd ON co.lecturer_in_charge_staff_id = sd.id
       LEFT JOIN users fe ON s.first_examiner_user_id = fe.id
       LEFT JOIN examiner_profiles fep ON fep.user_id = fe.id
       LEFT JOIN examiner_profiles sep ON s.second_examiner_profile_id = sep.id
       LEFT JOIN users seu ON sep.user_id = seu.id
       LEFT JOIN first_markings fm ON fm.exam_schedule_id = s.id
       LEFT JOIN second_markings sm ON sm.exam_schedule_id = s.id
       LEFT JOIN final_results fr ON fr.exam_schedule_id = s.id
       WHERE s.id = ?`,
      [scheduleId]
    );

    if (!s) return null;

    // Fetch related documents (isCurrent = true)
    const documents = await query<any>(
      `SELECT id, document_type AS documentType, version, original_filename AS originalFilename,
              file_size_bytes AS fileSizeBytes, uploaded_at AS uploadedAt, uploaded_by AS uploadedBy
       FROM documents 
       WHERE exam_schedule_id = ? AND is_current = TRUE`,
      [scheduleId]
    );

    // Fetch extension requests
    const extensionRequests = await query<any>(
      `SELECT id, exam_schedule_id AS examScheduleId, phase, requested_by AS requestedBy,
              current_due_date AS currentDueDate, requested_due_date AS requestedDueDate,
              reason, status, reviewed_by AS reviewedBy, reviewed_at AS reviewedAt,
              decision_reason AS decisionReason, created_at AS createdAt
       FROM deadline_extension_requests
       WHERE exam_schedule_id = ?
       ORDER BY created_at DESC`,
      [scheduleId]
    );

    // Fetch workflow events with actor details
    const workflowEvents = await query<any>(
      `SELECT we.id, we.event_type AS eventType, we.from_status AS fromStatus,
              we.to_status AS toStatus, we.description, we.created_at AS createdAt,
              u.id AS actor_id, u.full_name AS actor_full_name, u.designation AS actor_designation,
              u.profile_picture_url AS actor_profile_picture_url
       FROM workflow_events we
       LEFT JOIN users u ON we.actor_user_id = u.id
       WHERE we.exam_schedule_id = ?
       ORDER BY we.created_at DESC`,
      [scheduleId]
    );

    const formattedEvents = workflowEvents.map((e: any) => ({
      id: e.id,
      eventType: e.eventType,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      description: e.description,
      createdAt: e.createdAt,
      actor: e.actor_id
        ? {
            id: e.actor_id,
            fullName: e.actor_full_name,
            designation: e.actor_designation,
            profilePictureUrl: e.actor_profile_picture_url || null,
          }
        : null,
    }));

    // Assemble clean nested JSON matching the client interface
    return {
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

      courseOffering: s.co_id
        ? {
            id: s.co_id,
            courseId: s.co_course_id,
            programmeGroup: s.co_programme_group,
            batchLabel: s.co_batch_label,
            yearOfStudy: s.co_year_of_study,
            semester: s.co_semester,
            academicSessionStart: s.co_academic_session_start,
            academicSessionEnd: s.co_academic_session_end,
            teachingType: s.co_teaching_type,
            notes: s.co_notes,
            sourceDocument: s.co_source_document,
            sourceReviewStatus: s.co_source_review_status,
            course: s.c_id
              ? {
                  id: s.c_id,
                  courseCode: s.c_course_code,
                  courseTitle: s.c_course_title,
                  description: s.c_description,
                  credits: s.c_credits,
                  active: Boolean(s.c_active),
                }
              : null,
            lecturerInCharge: s.lic_id
              ? {
                  id: s.lic_id,
                  fullName: s.lic_full_name,
                  sourceKind: s.lic_source_kind,
                  reviewStatus: s.lic_review_status,
                }
              : null,
          }
        : null,

      firstExaminer: s.fe_id
        ? {
            id: s.fe_id,
            fullName: s.fe_full_name,
            email: s.fe_email,
            designation: s.fe_designation,
            profilePictureUrl: s.fe_profile_picture_url || null,
            examinerProfile: s.fe_seniority_level !== null ? { seniorityLevel: s.fe_seniority_level } : null,
          }
        : null,

      secondExaminer: s.se_id
        ? {
            id: s.se_id,
            seniorityLevel: s.se_seniority_level,
            examinerType: s.se_examiner_type,
            institution: s.se_institution,
            user: s.seu_id
              ? {
                  id: s.seu_id,
                  fullName: s.seu_full_name,
                  email: s.seu_email,
                  designation: s.seu_designation,
                  profilePictureUrl: s.seu_profile_picture_url || null,
                }
              : null,
          }
        : null,

      firstMarking: s.fm_id
        ? {
            id: s.fm_id,
            examScheduleId: s.id,
            scriptCount: s.fm_script_count,
            collectionRequestedAt: s.fm_collection_requested_at,
            collectedAt: s.fm_collected_at,
            originalDueDate: s.fm_original_due_date,
            extendedDueDate: s.fm_extended_due_date,
            returnedAt: s.fm_returned_at,
            reportDocumentId: s.fm_report_document_id,
          }
        : null,

      secondMarking: s.sm_id
        ? {
            id: s.sm_id,
            examScheduleId: s.id,
            courierDispatchedAt: s.sm_courier_dispatched_at,
            originalDueDate: s.sm_original_due_date,
            extendedDueDate: s.sm_extended_due_date,
            acknowledgedAt: s.sm_acknowledged_at,
            reportDocumentId: s.sm_report_document_id,
            arReceivedAt: s.sm_ar_received_at,
            courierReference: s.sm_courier_reference,
          }
        : null,

      finalResult: s.fr_id
        ? {
            id: s.fr_id,
            examScheduleId: s.id,
            finalMarksheetDocumentId: s.fr_final_marksheet_document_id,
            submissionStatus: s.fr_submission_status,
            submittedAt: s.fr_submitted_at,
            hodApprovalStatus: s.fr_hod_approval_status,
            hodApprovedBy: s.fr_hod_approved_by,
            hodApprovedAt: s.fr_hod_approved_at,
            hardcopySubmittedAt: s.fr_hardcopy_submitted_at,
            revisionReason: s.fr_revision_reason,
          }
        : null,

      documents,
      workflowEvents: formattedEvents,
      extensionRequests,
      invitations: [],
    };
  }

  /**
   * List schedules with dynamic filters and role scoping.
   */
  static async listSchedules(options: {
    userId?: number;
    onlyMySchedules?: boolean;
    isSupervisoryRole?: boolean;
    status?: string;
    programmeGroup?: string;
    batchLabel?: string;
    semester?: number;
    search?: string;
  }): Promise<any[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    // Role-scoped filtering
    if (options.userId && (!options.isSupervisoryRole || options.onlyMySchedules)) {
      conditions.push('(s.first_examiner_user_id = ? OR sep.user_id = ?)');
      params.push(options.userId, options.userId);
    }

    if (options.status) {
      conditions.push('s.workflow_status = ?');
      params.push(options.status);
    }

    if (options.programmeGroup) {
      conditions.push('co.programme_group = ?');
      params.push(options.programmeGroup);
    }

    if (options.batchLabel) {
      conditions.push('co.batch_label = ?');
      params.push(options.batchLabel);
    }

    if (options.semester) {
      conditions.push('co.semester = ?');
      params.push(options.semester);
    }

    if (options.search) {
      const term = `%${options.search.trim()}%`;
      conditions.push('(c.course_code LIKE ? OR c.course_title LIKE ? OR fe.full_name LIKE ?)');
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query<any>(
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

        -- Course Offering details
        co.id AS co_id,
        co.course_id AS co_course_id,
        co.programme_group AS co_programme_group,
        co.batch_label AS co_batch_label,
        co.year_of_study AS co_year_of_study,
        co.semester AS co_semester,
        co.academic_session_start AS co_academic_session_start,
        co.academic_session_end AS co_academic_session_end,
        co.teaching_type AS co_teaching_type,
        co.notes AS co_notes,
        co.source_document AS co_source_document,
        co.source_review_status AS co_source_review_status,

        -- Course details
        c.id AS c_id,
        c.course_code AS c_course_code,
        c.course_title AS c_course_title,
        c.description AS c_description,
        NULL AS c_credits,
        c.active AS c_active,

        -- Lecturer in charge
        sd.id AS lic_id,
        sd.full_name AS lic_full_name,
        sd.source_kind AS lic_source_kind,
        sd.review_status AS lic_review_status,

        -- First Examiner
        fe.id AS fe_id,
        fe.full_name AS fe_full_name,
        fe.email AS fe_email,
        fe.designation AS fe_designation,
        fe.profile_picture_url AS fe_profile_picture_url,
        fep.seniority_level AS fe_seniority_level,

        -- Second Examiner Profile & User
        sep.id AS se_id,
        sep.seniority_level AS se_seniority_level,
        sep.examiner_type AS se_examiner_type,
        sep.institution AS se_institution,
        seu.id AS seu_id,
        seu.full_name AS seu_full_name,
        seu.email AS seu_email,
        seu.designation AS seu_designation,
        seu.profile_picture_url AS seu_profile_picture_url,

        -- First Marking
        fm.id AS fm_id,
        fm.script_count AS fm_script_count,
        fm.collection_requested_at AS fm_collection_requested_at,
        fm.collected_at AS fm_collected_at,
        fm.original_due_date AS fm_original_due_date,
        fm.extended_due_date AS fm_extended_due_date,
        fm.returned_at AS fm_returned_at,
        fm.report_document_id AS fm_report_document_id,

        -- Second Marking
        sm.id AS sm_id,
        sm.courier_dispatched_at AS sm_courier_dispatched_at,
        sm.original_due_date AS sm_original_due_date,
        sm.extended_due_date AS sm_extended_due_date,
        sm.acknowledged_at AS sm_acknowledged_at,
        sm.report_document_id AS sm_report_document_id,
        sm.ar_received_at AS sm_ar_received_at,
        sm.courier_reference AS sm_courier_reference,

        -- Final Result
        fr.id AS fr_id,
        fr.final_marksheet_document_id AS fr_final_marksheet_document_id,
        fr.submission_status AS fr_submission_status,
        fr.submitted_at AS fr_submitted_at,
        fr.hod_approval_status AS fr_hod_approval_status,
        fr.hod_approved_by AS fr_hod_approved_by,
        fr.hod_approved_at AS fr_hod_approved_at,
        fr.hardcopy_submitted_at AS fr_hardcopy_submitted_at,
        fr.revision_reason AS fr_revision_reason

       FROM exam_schedules s
       LEFT JOIN course_offerings co ON s.course_offering_id = co.id
       LEFT JOIN courses c ON co.course_id = c.id
       LEFT JOIN staff_directory sd ON co.lecturer_in_charge_staff_id = sd.id
       LEFT JOIN users fe ON s.first_examiner_user_id = fe.id
       LEFT JOIN examiner_profiles fep ON fep.user_id = fe.id
       LEFT JOIN examiner_profiles sep ON s.second_examiner_profile_id = sep.id
       LEFT JOIN users seu ON sep.user_id = seu.id
       LEFT JOIN first_markings fm ON fm.exam_schedule_id = s.id
       LEFT JOIN second_markings sm ON sm.exam_schedule_id = s.id
       LEFT JOIN final_results fr ON fr.exam_schedule_id = s.id
       ${whereClause}
       ORDER BY s.exam_date DESC, s.id DESC`,
      params
    );

    return rows.map((s: any) => ({
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

      courseOffering: s.co_id
        ? {
            id: s.co_id,
            courseId: s.co_course_id,
            programmeGroup: s.co_programme_group,
            batchLabel: s.co_batch_label,
            yearOfStudy: s.co_year_of_study,
            semester: s.co_semester,
            academicSessionStart: s.co_academic_session_start,
            academicSessionEnd: s.co_academic_session_end,
            teachingType: s.co_teaching_type,
            notes: s.co_notes,
            sourceDocument: s.co_source_document,
            sourceReviewStatus: s.co_source_review_status,
            course: s.c_id
              ? {
                  id: s.c_id,
                  courseCode: s.c_course_code,
                  courseTitle: s.c_course_title,
                  description: s.c_description,
                  credits: s.c_credits,
                  active: Boolean(s.c_active),
                }
              : null,
            lecturerInCharge: s.lic_id
              ? {
                  id: s.lic_id,
                  fullName: s.lic_full_name,
                  sourceKind: s.lic_source_kind,
                  reviewStatus: s.lic_review_status,
                }
              : null,
          }
        : null,

      firstExaminer: s.fe_id
        ? {
            id: s.fe_id,
            fullName: s.fe_full_name,
            email: s.fe_email,
            designation: s.fe_designation,
            profilePictureUrl: s.fe_profile_picture_url || null,
            examinerProfile: s.fe_seniority_level !== null ? { seniorityLevel: s.fe_seniority_level } : null,
          }
        : null,

      secondExaminer: s.se_id
        ? {
            id: s.se_id,
            seniorityLevel: s.se_seniority_level,
            examinerType: s.se_examiner_type,
            institution: s.se_institution,
            user: s.seu_id
              ? {
                  id: s.seu_id,
                  fullName: s.seu_full_name,
                  email: s.seu_email,
                  designation: s.seu_designation,
                  profilePictureUrl: s.seu_profile_picture_url || null,
                }
              : null,
          }
        : null,

      firstMarking: s.fm_id
        ? {
            id: s.fm_id,
            examScheduleId: s.id,
            scriptCount: s.fm_script_count,
            collectionRequestedAt: s.fm_collection_requested_at,
            collectedAt: s.fm_collected_at,
            originalDueDate: s.fm_original_due_date,
            extendedDueDate: s.fm_extended_due_date,
            returnedAt: s.fm_returned_at,
            reportDocumentId: s.fm_report_document_id,
          }
        : null,

      secondMarking: s.sm_id
        ? {
            id: s.sm_id,
            examScheduleId: s.id,
            courierDispatchedAt: s.sm_courier_dispatched_at,
            originalDueDate: s.sm_original_due_date,
            extendedDueDate: s.sm_extended_due_date,
            acknowledgedAt: s.sm_acknowledged_at,
            reportDocumentId: s.sm_report_document_id,
            arReceivedAt: s.sm_ar_received_at,
            courierReference: s.sm_courier_reference,
          }
        : null,

      finalResult: s.fr_id
        ? {
            id: s.fr_id,
            examScheduleId: s.id,
            finalMarksheetDocumentId: s.fr_final_marksheet_document_id,
            submissionStatus: s.fr_submission_status,
            submittedAt: s.fr_submitted_at,
            hodApprovalStatus: s.fr_hod_approval_status,
            hodApprovedBy: s.fr_hod_approved_by,
            hodApprovedAt: s.fr_hod_approved_at,
            hardcopySubmittedAt: s.fr_hardcopy_submitted_at,
            revisionReason: s.fr_revision_reason,
          }
        : null,
    }));
  }
}
