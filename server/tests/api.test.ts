import request from 'supertest';
import { app } from '../src/app';
import { db, queryOne, execute } from '../src/config/db';
import { ExaminerService } from '../src/services/examinerService';
import { WorkflowService } from '../src/services/workflowService';
import { DocumentService } from '../src/services/documentService';

describe('RUSL Exam Results Monitoring API & Services Tests', () => {
  jest.setTimeout(60000);

  afterAll(async () => {
    await db.end();
  });

  describe('Health Check Endpoint', () => {
    test('GET /api/health returns status UP with institutional metadata', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.university).toContain('Rajarata University');
    });
  });

  describe('Authentication API', () => {
    test('POST /api/auth/login succeeds with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'hod', password: 'Password@123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe('hod');
      expect(res.body.user.roles).toContain('HOD');
    });

    test('POST /api/auth/login fails with invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'hod', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    test('PUT /api/auth/profile allows lecturer to update personal data, phone number, and avatar', async () => {
      // Login as charith (lecturer)
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'charith', password: 'Password@123' });
      const token = loginRes.body.token;

      const updateRes = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fullName: 'Dr. Charith Jayasundara (Updated)',
          phoneNumber: '+94 77 999 8888',
          designation: 'Senior Lecturer Grade I',
          institution: 'Department of Computing, Faculty of Applied Sciences',
          profilePictureUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%231e3a8a"/></svg>'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.user.fullName).toBe('Dr. Charith Jayasundara (Updated)');
      expect(updateRes.body.user.phoneNumber).toBe('+94 77 999 8888');
      expect(updateRes.body.user.profilePictureUrl).toContain('data:image/svg+xml');

      // Verify GET /api/auth/me also returns updated phone number and profile picture
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.phoneNumber).toBe('+94 77 999 8888');
      expect(meRes.body.user.fullName).toBe('Dr. Charith Jayasundara (Updated)');
    });

    test('PUT /api/auth/profile rejects unauthenticated requests', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .send({ fullName: 'Hacker' });

      expect(res.status).toBe(401);
    });
  });

  // examiner senority & workload checks
  describe('Examiner Seniority & Active Load Rules', () => {
    test('Rejects assignment if Second Examiner is less senior than First Examiner', async () => {
      // Find First Examiner with Seniority 6 (charith)
      const charith = await queryOne<any>(`SELECT id FROM users WHERE username = ?`, ['charith']);
      // Find Second Examiner candidate with Seniority 4 (palliya profile)
      const palliyaUser = await queryOne<any>(`SELECT id FROM users WHERE username = ?`, ['palliya']);
      const palliyaProfile = await queryOne<any>(`SELECT id FROM examiner_profiles WHERE user_id = ?`, [palliyaUser!.id]);

      const validation = await ExaminerService.validateSeniority(charith!.id, palliyaProfile!.id);
      expect(validation.valid).toBe(false);
      expect(validation.message).toContain('Academic rank validation failed');
    });

    test('Accepts assignment if Second Examiner is strictly more senior than First Examiner', async () => {
      // First Examiner with Seniority 4 (palliya)
      const palliyaUser = await queryOne<any>(`SELECT id FROM users WHERE username = ?`, ['palliya']);
      // Second Examiner candidate with Seniority 12 (gunathilake profile)
      const gunathilakeUser = await queryOne<any>(`SELECT id FROM users WHERE username = ?`, ['gunathilake']);
      const gunathilakeProfile = await queryOne<any>(`SELECT id FROM examiner_profiles WHERE user_id = ?`, [gunathilakeUser!.id]);

      const validation = await ExaminerService.validateSeniority(palliyaUser!.id, gunathilakeProfile!.id);
      expect(validation.valid).toBe(true);
      expect(validation.firstSeniority).toBe(4);
      expect(validation.secondSeniority).toBe(12);
    });

    test('Candidate selector reports correct X/3 active load status', async () => {
      const candidates = await ExaminerService.getCandidates();
      expect(candidates.length).toBeGreaterThan(0);
      for (const c of candidates) {
        expect(c.slotsFilledLabel).toMatch(/^[0-3]\/3 slots filled$/);
        expect(c.maxLimit).toBe(3);
      }
    });
  });

  // lock checks
  describe('Workflow Lock Rules', () => {
    test('Blocks any mutation on APPROVED_LOCKED schedule with 409 WORKFLOW_LOCKED', async () => {
      // Find the locked schedule (COM2307)
      const lockedSchedule = await queryOne<any>(
        `SELECT id FROM exam_schedules WHERE workflow_status = 'APPROVED_LOCKED' LIMIT 1`
      );
      expect(lockedSchedule).toBeDefined();

      await expect(
        WorkflowService.assertNotLocked(lockedSchedule!.id)
      ).rejects.toMatchObject({
        status: 409,
        message: expect.stringContaining('WORKFLOW_LOCKED')
      });
    });
  });

  // role checks
  describe('Examiner Role Permissions & Access Control', () => {
    test('Rejects HOD attempting to request Collection OTP when not the assigned First Examiner', async () => {
      const sch = await queryOne<any>(
        `SELECT s.id 
         FROM exam_schedules s 
         JOIN users u ON s.first_examiner_user_id = u.id 
         WHERE u.username != 'hod' AND s.workflow_status NOT IN ('APPROVED_LOCKED', 'CANCELLED')
         LIMIT 1`
      );
      expect(sch).toBeDefined();

      const hodUser = await queryOne<any>(`SELECT id FROM users WHERE username = 'hod'`);

      await expect(
        WorkflowService.requestCollectionOtp(sch!.id, 50, hodUser!.id)
      ).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining('Only the assigned First Examiner')
      });
    });

    test('Rejects HOD attempting to upload Second Marking Report when not the assigned Second Examiner', async () => {
      const sch = await queryOne<any>(
        `SELECT s.id 
         FROM exam_schedules s 
         JOIN examiner_profiles ep ON s.second_examiner_profile_id = ep.id
         JOIN users u ON ep.user_id = u.id 
         WHERE u.username != 'hod' AND s.workflow_status NOT IN ('APPROVED_LOCKED', 'CANCELLED')
         LIMIT 1`
      );
      expect(sch).toBeDefined();

      const hodUser = await queryOne<any>(`SELECT id FROM users WHERE username = 'hod'`);

      await expect(
        WorkflowService.recordSecondMarkingReport(sch!.id, 9999, hodUser!.id)
      ).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining('Only the assigned Second Examiner')
      });
    });

    test('Rejects HOD attempting to submit Final Marksheet when not the assigned First Examiner', async () => {
      const sch = await queryOne<any>(
        `SELECT s.id 
         FROM exam_schedules s 
         JOIN users u ON s.first_examiner_user_id = u.id 
         WHERE u.username != 'hod' AND s.workflow_status NOT IN ('APPROVED_LOCKED', 'CANCELLED')
         LIMIT 1`
      );
      expect(sch).toBeDefined();

      const hodUser = await queryOne<any>(`SELECT id FROM users WHERE username = 'hod'`);

      await expect(
        WorkflowService.submitFinalMarksheet(sch!.id, hodUser!.id)
      ).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining('Only the assigned First Examiner')
      });
    });

    test('AR Office generates collection OTP with script count, and First Examiner confirms collection', async () => {
      const sch = await queryOne<any>(
        `SELECT s.id, s.first_examiner_user_id AS firstExaminerUserId
         FROM exam_schedules s
         WHERE s.workflow_status = 'SCHEDULED'
         LIMIT 1`
      );
      expect(sch).toBeDefined();

      const arUser = await queryOne<any>(`SELECT id FROM users WHERE username = 'ar'`);
      const feUser = await queryOne<any>(`SELECT id FROM users WHERE id = ?`, [sch!.firstExaminerUserId]);

      const arOtpRes = await WorkflowService.arGenerateCollectionOtp(sch!.id, 85, arUser!.id);
      expect(arOtpRes.otp).toMatch(/^\d{6}$/);
      expect(arOtpRes.scriptCount).toBe(85);

      const schPending = await queryOne<any>(
        `SELECT s.workflow_status AS workflowStatus, fm.script_count AS scriptCount
         FROM exam_schedules s
         JOIN first_markings fm ON fm.exam_schedule_id = s.id
         WHERE s.id = ?`,
        [sch!.id]
      );
      expect(schPending!.workflowStatus).toBe('FIRST_COLLECTION_REQUESTED');
      expect(schPending!.scriptCount).toBe(85);

      const confirmRes = await WorkflowService.verifyCollectionOtp(sch!.id, arOtpRes.otp, feUser!.id);
      expect(confirmRes.success).toBe(true);
      expect(confirmRes.message).toContain('First Examiner');

      const schActive = await queryOne<any>(
        `SELECT s.workflow_status AS workflowStatus, fm.collected_at AS collectedAt, fm.original_due_date AS originalDueDate
         FROM exam_schedules s
         JOIN first_markings fm ON fm.exam_schedule_id = s.id
         WHERE s.id = ?`,
        [sch!.id]
      );
      expect(schActive!.workflowStatus).toBe('FIRST_MARKING_ACTIVE');
      expect(schActive!.collectedAt).toBeDefined();
      expect(schActive!.originalDueDate).toBeDefined();

      await execute(
        `UPDATE exam_schedules SET workflow_status = 'SCHEDULED' WHERE id = ?`,
        [sch!.id]
      );
      await execute(
        `UPDATE first_markings SET collected_at = NULL, original_due_date = NULL WHERE exam_schedule_id = ?`,
        [sch!.id]
      );
    });
  });

  describe('End-to-End Complete Examination Workflow Execution', () => {
    test('HOD approves COM1302 with all required PDF prerequisites and locks permanently', async () => {
      const sch3 = await queryOne<any>(
        `SELECT s.id 
         FROM exam_schedules s
         JOIN course_offerings co ON s.course_offering_id = co.id
         JOIN courses c ON co.course_id = c.id
         WHERE c.course_code = 'COM1302'
         LIMIT 1`
      );
      expect(sch3).toBeDefined();

      // Ensure idempotent test state for repeated test runs
      await execute(
        `UPDATE exam_schedules SET workflow_status = 'FINAL_MARKSHEET_SUBMITTED', locked_at = NULL WHERE id = ?`,
        [sch3!.id]
      );
      await execute(
        `UPDATE final_results SET submission_status = 'SUBMITTED', hod_approval_status = 'PENDING', hod_approved_at = NULL WHERE exam_schedule_id = ?`,
        [sch3!.id]
      );

      const hodUser = await queryOne<any>(`SELECT id FROM users WHERE username = 'hod'`);
      const approval = await WorkflowService.approveFinalMarksheet(sch3!.id, hodUser!.id);
      expect(approval.success).toBe(true);
      expect(approval.approvedAt).toBeDefined();

      const updated = await queryOne<any>(
        `SELECT s.workflow_status AS workflowStatus, s.locked_at AS lockedAt, fr.hod_approval_status AS hodApprovalStatus
         FROM exam_schedules s
         LEFT JOIN final_results fr ON fr.exam_schedule_id = s.id
         WHERE s.id = ?`,
        [sch3!.id]
      );
      expect(updated!.workflowStatus).toBe('APPROVED_LOCKED');
      expect(updated!.lockedAt).toBeDefined();
      expect(updated!.hodApprovalStatus).toBe('APPROVED');
    });

    test('Executes full 100% end-to-end workflow from draft to permanent approval', async () => {
      const hod = await queryOne<any>(`SELECT id FROM users WHERE username = 'hod'`);
      const charith = await queryOne<any>(`SELECT id FROM users WHERE username = 'charith'`); // Seniority 6
      const gunathilake = await queryOne<any>(`SELECT id FROM users WHERE username = 'gunathilake'`);
      const gunathilakeProfile = await queryOne<any>(`SELECT id FROM examiner_profiles WHERE user_id = ?`, [gunathilake!.id]); // Seniority 12
      const arUser = await queryOne<any>(`SELECT id FROM users WHERE username = 'ar'`);

      // 1. Find offering for ICT1306 (Object Oriented Programming)
      const offering = await queryOne<any>(
        `SELECT co.id 
         FROM course_offerings co
         JOIN courses c ON co.course_id = c.id
         WHERE c.course_code = 'ICT1306'
         LIMIT 1`
      );
      expect(offering).toBeDefined();

      // Clean up any existing schedule for ICT1306 to ensure idempotence
      const existingSchedules = await queryOne<any>(
        `SELECT id FROM exam_schedules WHERE course_offering_id = ?`,
        [offering!.id]
      );

      if (existingSchedules) {
        await execute(
          `DELETE FROM deadline_extension_requests WHERE exam_schedule_id IN (SELECT id FROM exam_schedules WHERE course_offering_id = ?)`,
          [offering!.id]
        );
        await execute(
          `DELETE FROM documents WHERE exam_schedule_id IN (SELECT id FROM exam_schedules WHERE course_offering_id = ?)`,
          [offering!.id]
        );
        await execute(
          `DELETE FROM workflow_events WHERE exam_schedule_id IN (SELECT id FROM exam_schedules WHERE course_offering_id = ?)`,
          [offering!.id]
        );
        await execute(
          `DELETE FROM otp_transactions WHERE exam_schedule_id IN (SELECT id FROM exam_schedules WHERE course_offering_id = ?)`,
          [offering!.id]
        );
        await execute(
          `DELETE FROM first_markings WHERE exam_schedule_id IN (SELECT id FROM exam_schedules WHERE course_offering_id = ?)`,
          [offering!.id]
        );
        await execute(
          `DELETE FROM second_markings WHERE exam_schedule_id IN (SELECT id FROM exam_schedules WHERE course_offering_id = ?)`,
          [offering!.id]
        );
        await execute(
          `DELETE FROM final_results WHERE exam_schedule_id IN (SELECT id FROM exam_schedules WHERE course_offering_id = ?)`,
          [offering!.id]
        );
        await execute(
          `DELETE FROM examiner_invitations WHERE exam_schedule_id IN (SELECT id FROM exam_schedules WHERE course_offering_id = ?)`,
          [offering!.id]
        );
        await execute(
          `DELETE FROM exam_schedules WHERE course_offering_id = ?`,
          [offering!.id]
        );
      }

      // 2. Create Draft Schedule
      const insertDraft = await execute(
        `INSERT INTO exam_schedules (course_offering_id, exam_date, first_examiner_user_id, workflow_status, created_by, created_at, updated_at)
         VALUES (?, '2026-08-15', ?, 'DRAFT', ?, NOW(), NOW())`,
        [offering!.id, charith!.id, hod!.id]
      );
      const draftId = insertDraft.insertId;

      await execute(`INSERT INTO first_markings (exam_schedule_id, created_at, updated_at) VALUES (?, NOW(), NOW())`, [draftId]);
      await execute(`INSERT INTO second_markings (exam_schedule_id, created_at, updated_at) VALUES (?, NOW(), NOW())`, [draftId]);
      await execute(`INSERT INTO final_results (exam_schedule_id, created_at, updated_at) VALUES (?, NOW(), NOW())`, [draftId]);

      const draft = { id: draftId, workflowStatus: 'DRAFT' };
      expect(draft.workflowStatus).toBe('DRAFT');

      // 3a. Attempt activating without Second Examiner - MUST FAIL under new regulations
      await expect(
        WorkflowService.activateSchedule(
          draft.id,
          new Date('2026-08-15'),
          charith!.id,
          hod!.id
        )
      ).rejects.toThrow('Cannot plan or activate exam: Both First Examiner and Second Examiner must be assigned');

      // 3b. Activate Schedule with compliant Second Examiner (Prof. Gunathilake Seniority 12 > Charith Seniority 6)
      const seniorityValidation = await ExaminerService.validateSeniority(charith!.id, gunathilakeProfile!.id);
      expect(seniorityValidation.valid).toBe(true);

      const active = await WorkflowService.activateSchedule(
        draft.id,
        new Date('2026-08-15'),
        charith!.id,
        gunathilakeProfile!.id,
        hod!.id
      );
      expect(active.workflowStatus).toBe('SCHEDULED');
      expect(active.secondExaminerProfileId).toBe(gunathilakeProfile!.id);

      // 4. First Examiner: Request Collection OTP
      const collectionOtpRes = await WorkflowService.requestCollectionOtp(
        active.id,
        75,
        charith!.id
      );
      expect(collectionOtpRes.otp).toMatch(/^\d{6}$/);

      // 5. AR Office: Verify Collection OTP (3-month deadline started)
      const verifyCollection = await WorkflowService.verifyCollectionOtp(
        active.id,
        collectionOtpRes.otp,
        arUser!.id
      );
      expect(verifyCollection.success).toBe(true);

      const schAfterCollection = await queryOne<any>(
        `SELECT s.workflow_status AS workflowStatus, fm.script_count AS scriptCount, fm.collected_at AS collectedAt, fm.original_due_date AS originalDueDate
         FROM exam_schedules s
         LEFT JOIN first_markings fm ON fm.exam_schedule_id = s.id
         WHERE s.id = ?`,
        [active.id]
      );
      expect(schAfterCollection!.workflowStatus).toBe('FIRST_MARKING_ACTIVE');
      expect(schAfterCollection!.scriptCount).toBe(75);
      expect(schAfterCollection!.collectedAt).toBeDefined();
      expect(schAfterCollection!.originalDueDate).toBeDefined();

      // 6. First Examiner: Upload 1st Marking Report PDF
      const dummyPdf = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000055 00000 n \n0000000104 00000 n \n0000000161 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n231\n%%EOF'
      );
      const doc1 = await DocumentService.uploadDocument(
        active.id,
        'FIRST_MARKING_REPORT' as any,
        dummyPdf,
        'ICT1306_First_Marking_Report.pdf',
        charith!.id
      );
      await WorkflowService.recordFirstMarkingReport(active.id, doc1.id, charith!.id);

      // 7. First Examiner: Request Return OTP
      const returnOtpRes = await WorkflowService.requestReturnOtp(active.id, charith!.id);
      expect(returnOtpRes.otp).toMatch(/^\d{6}$/);

      // 8. AR Office: Verify Return OTP -> transitions to SECOND_MARKING_READY
      const verifyReturn = await WorkflowService.verifyReturnOtp(
        active.id,
        returnOtpRes.otp,
        arUser!.id
      );
      expect(verifyReturn.success).toBe(true);

      const schAfterReturn = await queryOne<any>(
        `SELECT s.workflow_status AS workflowStatus, fm.returned_at AS returnedAt
         FROM exam_schedules s
         LEFT JOIN first_markings fm ON fm.exam_schedule_id = s.id
         WHERE s.id = ?`,
        [active.id]
      );
      expect(schAfterReturn!.workflowStatus).toBe('SECOND_MARKING_READY');
      expect(schAfterReturn!.returnedAt).toBeDefined();

      // 9. AR Office: Courier Dispatch -> transitions to SECOND_MARKING_ACTIVE (1-month deadline started)
      const dispatch = await WorkflowService.recordCourierDispatch(
        active.id,
        'SPEEDPOST-99921',
        arUser!.id
      );
      expect(dispatch.success).toBe(true);

      const schAfterDispatch = await queryOne<any>(
        `SELECT s.workflow_status AS workflowStatus, sm.courier_dispatched_at AS courierDispatchedAt
         FROM exam_schedules s
         LEFT JOIN second_markings sm ON sm.exam_schedule_id = s.id
         WHERE s.id = ?`,
        [active.id]
      );
      expect(schAfterDispatch!.workflowStatus).toBe('SECOND_MARKING_ACTIVE');
      expect(schAfterDispatch!.courierDispatchedAt).toBeDefined();

      // 10. Second Examiner: Acknowledge Receipt
      const ack = await WorkflowService.acknowledgeCourierReceipt(active.id, gunathilake!.id);
      expect(ack.success).toBe(true);

      // 11. Second Examiner: Upload 2nd Marking Report PDF
      const doc2 = await DocumentService.uploadDocument(
        active.id,
        'SECOND_MARKING_REPORT' as any,
        dummyPdf,
        'ICT1306_Second_Marking_Report.pdf',
        gunathilake!.id
      );
      await WorkflowService.recordSecondMarkingReport(active.id, doc2.id, gunathilake!.id);

      // 12. AR Office: Confirm Returned Scripts Received -> transitions to SECOND_MARKING_COMPLETE
      const arConfirm = await WorkflowService.confirmArReceipt(active.id, arUser!.id);
      expect(arConfirm.success).toBe(true);

      const schAfterArConfirm = await queryOne<any>(
        `SELECT workflow_status AS workflowStatus FROM exam_schedules WHERE id = ?`,
        [active.id]
      );
      expect(schAfterArConfirm!.workflowStatus).toBe('SECOND_MARKING_COMPLETE');

      // 13. First Examiner: Upload Final Marksheet PDF
      const doc3 = await DocumentService.uploadDocument(
        active.id,
        'FINAL_MARKSHEET' as any,
        dummyPdf,
        'ICT1306_Final_Marksheet.pdf',
        charith!.id
      );
      await WorkflowService.recordFinalMarksheet(active.id, doc3.id, charith!.id);

      // 14. First Examiner: Submit Final Marksheet for Review -> FINAL_MARKSHEET_SUBMITTED
      const submitRes = await WorkflowService.submitFinalMarksheet(active.id, charith!.id);
      expect(submitRes.success).toBe(true);

      const schSubmitted = await queryOne<any>(
        `SELECT workflow_status AS workflowStatus FROM exam_schedules WHERE id = ?`,
        [active.id]
      );
      expect(schSubmitted!.workflowStatus).toBe('FINAL_MARKSHEET_SUBMITTED');

      // 15. HOD: Request Changes (revisions workflow)
      const reqChanges = await WorkflowService.requestChanges(
        active.id,
        'Please recheck CA mark weighting for assignment 2',
        hod!.id
      );
      expect(reqChanges.success).toBe(true);

      const schChanges = await queryOne<any>(
        `SELECT s.workflow_status AS workflowStatus, fr.revision_reason AS revisionReason
         FROM exam_schedules s
         LEFT JOIN final_results fr ON fr.exam_schedule_id = s.id
         WHERE s.id = ?`,
        [active.id]
      );
      expect(schChanges!.workflowStatus).toBe('FINAL_MARKSHEET_CHANGES_REQUESTED');
      expect(schChanges!.revisionReason).toContain('assignment 2');

      // 16. First Examiner: Upload revised final marksheet & re-submit
      const doc3v2 = await DocumentService.uploadDocument(
        active.id,
        'FINAL_MARKSHEET' as any,
        dummyPdf,
        'ICT1306_Final_Marksheet_v2.pdf',
        charith!.id
      );
      await WorkflowService.recordFinalMarksheet(active.id, doc3v2.id, charith!.id);
      await WorkflowService.submitFinalMarksheet(active.id, charith!.id);

      const schResubmitted = await queryOne<any>(
        `SELECT workflow_status AS workflowStatus FROM exam_schedules WHERE id = ?`,
        [active.id]
      );
      expect(schResubmitted!.workflowStatus).toBe('FINAL_MARKSHEET_SUBMITTED');

      // 17. HOD: Final Approval & Permanent Irreversible Lock
      const finalApproval = await WorkflowService.approveFinalMarksheet(active.id, hod!.id);
      expect(finalApproval.success).toBe(true);

      const schFinal = await queryOne<any>(
        `SELECT s.workflow_status AS workflowStatus, s.locked_at AS lockedAt, fr.hod_approval_status AS hodApprovalStatus
         FROM exam_schedules s
         LEFT JOIN final_results fr ON fr.exam_schedule_id = s.id
         WHERE s.id = ?`,
        [active.id]
      );
      expect(schFinal!.workflowStatus).toBe('APPROVED_LOCKED');
      expect(schFinal!.lockedAt).toBeDefined();
      expect(schFinal!.hodApprovalStatus).toBe('APPROVED');

      // 18. Verify subsequent mutation is permanently blocked with 409
      await expect(
        WorkflowService.assertNotLocked(active.id)
      ).rejects.toMatchObject({
        status: 409
      });
    });
  });
});
