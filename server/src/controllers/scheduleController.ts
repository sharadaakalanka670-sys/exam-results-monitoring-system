import { Request, Response } from 'express';
import { execute, queryOne, withTransaction } from '../config/db';
import { WorkflowService } from '../services/workflowService';
import { AuditService } from '../services/auditService';
import { ScheduleRepository } from '../services/scheduleRepository';
import { RoleName, WorkflowStatus } from '../types/enums';
import { isOverdue } from '../utils/dates';

export class ScheduleController {
  static async listSchedules(req: Request, res: Response): Promise<void> {
    try {
      const {
        search,
        status,
        programmeGroup,
        batchLabel,
        semester,
        onlyMySchedules,
        overdueOnly
      } = req.query;

      const user = req.user!;
      const isHod = user.roles.includes(RoleName.HOD);
      const isDean = user.roles.includes(RoleName.DEAN);
      const isAr = user.roles.includes(RoleName.AR_OFFICE);
      const isClerk = user.roles.includes(RoleName.HOD_CLERK);

      const schedules = await ScheduleRepository.listSchedules({
        userId: user.id,
        onlyMySchedules: onlyMySchedules === 'true',
        isSupervisoryRole: isHod || isDean || isAr || isClerk,
        status: status ? String(status) : undefined,
        programmeGroup: programmeGroup ? String(programmeGroup) : undefined,
        batchLabel: batchLabel ? String(batchLabel) : undefined,
        semester: semester ? parseInt(String(semester), 10) : undefined,
        search: search ? String(search) : undefined,
      });

      // Compute overdue statuses and format response
      const results = schedules.map(s => {
        const firstOverdue = s.firstMarking?.collectedAt && !s.firstMarking?.returnedAt
          ? isOverdue(s.firstMarking.extendedDueDate || s.firstMarking.originalDueDate)
          : false;

        const secondOverdue = s.secondMarking?.courierDispatchedAt && !s.secondMarking?.arReceivedAt
          ? isOverdue(s.secondMarking.extendedDueDate || s.secondMarking.originalDueDate)
          : false;

        return {
          ...s,
          isOverdue: firstOverdue || secondOverdue,
          firstMarkingOverdue: firstOverdue,
          secondMarkingOverdue: secondOverdue,
        };
      });

      const filteredResults = overdueOnly === 'true'
        ? results.filter(r => r.isOverdue)
        : results;

      res.json(filteredResults);
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async getSchedule(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      if (isNaN(scheduleId)) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid schedule ID' });
        return;
      }

      const schedule = await ScheduleRepository.getById(scheduleId);

      if (!schedule) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Exam schedule not found' });
        return;
      }

      // Check overdue statuses
      const firstOverdue = schedule.firstMarking?.collectedAt && !schedule.firstMarking?.returnedAt
        ? isOverdue(schedule.firstMarking.extendedDueDate || schedule.firstMarking.originalDueDate)
        : false;

      const secondOverdue = schedule.secondMarking?.courierDispatchedAt && !schedule.secondMarking?.arReceivedAt
        ? isOverdue(schedule.secondMarking.extendedDueDate || schedule.secondMarking.originalDueDate)
        : false;

      res.json({
        ...schedule,
        isOverdue: firstOverdue || secondOverdue,
        firstMarkingOverdue: firstOverdue,
        secondMarkingOverdue: secondOverdue,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async createDraft(req: Request, res: Response): Promise<void> {
    try {
      const { courseOfferingId, examDate, firstExaminerUserId, secondExaminerProfileId } = req.body;
      const user = req.user!;

      if (!courseOfferingId) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Course offering ID is required.' });
        return;
      }

      let newScheduleId = 0;

      await withTransaction(async (conn) => {
        const [insertRes] = await conn.execute<any>(
          `INSERT INTO exam_schedules
            (course_offering_id, exam_date, first_examiner_user_id, second_examiner_profile_id, workflow_status, created_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            courseOfferingId,
            examDate ? new Date(examDate) : null,
            firstExaminerUserId || null,
            secondExaminerProfileId || null,
            WorkflowStatus.DRAFT,
            user.id
          ]
        );

        newScheduleId = insertRes.insertId;

        await conn.execute(
          `INSERT INTO first_markings (exam_schedule_id) VALUES (?) ON DUPLICATE KEY UPDATE id=id`,
          [newScheduleId]
        );

        await conn.execute(
          `INSERT INTO second_markings (exam_schedule_id) VALUES (?) ON DUPLICATE KEY UPDATE id=id`,
          [newScheduleId]
        );

        await conn.execute(
          `INSERT INTO final_results (exam_schedule_id) VALUES (?) ON DUPLICATE KEY UPDATE id=id`,
          [newScheduleId]
        );
      });

      const schedule = await ScheduleRepository.getById(newScheduleId);

      await AuditService.logEvent({
        examScheduleId: newScheduleId,
        actorUserId: user.id,
        eventType: 'DRAFT_CREATED',
        fromStatus: 'NONE',
        toStatus: WorkflowStatus.DRAFT,
        description: `Draft schedule created for ${schedule?.courseOffering?.course?.courseCode || 'course'}.`
      });

      res.status(201).json(schedule);
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async updateDraft(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const { examDate, firstExaminerUserId, secondExaminerProfileId } = req.body;

      await WorkflowService.assertNotLocked(scheduleId);

      const updates: string[] = [];
      const params: any[] = [];

      if (examDate !== undefined) {
        updates.push('exam_date = ?');
        params.push(examDate ? new Date(examDate) : null);
      }
      if (firstExaminerUserId !== undefined) {
        updates.push('first_examiner_user_id = ?');
        params.push(firstExaminerUserId || null);
      }
      if (secondExaminerProfileId !== undefined) {
        updates.push('second_examiner_profile_id = ?');
        params.push(secondExaminerProfileId || null);
      }

      if (updates.length > 0) {
        updates.push('updated_at = NOW()');
        params.push(scheduleId);
        await execute(
          `UPDATE exam_schedules SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
      }

      const schedule = await ScheduleRepository.getById(scheduleId);
      res.json(schedule);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async activate(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const { examDate, firstExaminerUserId, secondExaminerProfileId } = req.body;
      const user = req.user!;

      if (!examDate || !firstExaminerUserId) {
        res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Both confirmed exam date and first examiner are required to activate the schedule.'
        });
        return;
      }

      const schedule = await WorkflowService.activateSchedule(
        scheduleId,
        new Date(examDate),
        firstExaminerUserId,
        secondExaminerProfileId,
        user.id
      );

      res.json(schedule);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async cancel(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const { reason } = req.body;
      const user = req.user!;

      await WorkflowService.assertNotLocked(scheduleId);

      const schedule = await queryOne<any>(
        `SELECT s.id, s.workflow_status AS workflowStatus, fm.collected_at AS collectedAt
         FROM exam_schedules s
         LEFT JOIN first_markings fm ON fm.exam_schedule_id = s.id
         WHERE s.id = ?`,
        [scheduleId]
      );

      if (!schedule) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Schedule not found' });
        return;
      }

      if (schedule.collectedAt) {
        res.status(400).json({
          error: 'BAD_REQUEST',
          message: 'Cannot cancel an exam schedule after physical scripts have been collected.'
        });
        return;
      }

      await execute(
        `UPDATE exam_schedules SET workflow_status = ?, updated_at = NOW() WHERE id = ?`,
        [WorkflowStatus.CANCELLED, scheduleId]
      );

      await AuditService.logEvent({
        examScheduleId: scheduleId,
        actorUserId: user.id,
        eventType: 'SCHEDULE_CANCELLED',
        fromStatus: schedule.workflowStatus,
        toStatus: WorkflowStatus.CANCELLED,
        description: `Schedule cancelled by HOD. Reason: ${reason || 'N/A'}`
      });

      res.json({ success: true, message: 'Schedule cancelled successfully.' });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }
}
