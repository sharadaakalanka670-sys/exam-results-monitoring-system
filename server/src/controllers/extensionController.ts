import { Request, Response } from 'express';
import { query, queryOne, execute, withTransaction } from '../config/db';
import { WorkflowService } from '../services/workflowService';
import { AuditService } from '../services/auditService';
import { ExtensionPhase, ExtensionStatus } from '../types/enums';

export class ExtensionController {
  static async requestExtension(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const { phase, requestedDueDate, reason } = req.body;
      const user = req.user!;

      await WorkflowService.assertNotLocked(scheduleId);

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'A reason is mandatory for extension requests.' });
        return;
      }

      if (!requestedDueDate) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Requested new due date is required.' });
        return;
      }

      const schedule = await queryOne<any>(
        `SELECT s.id, s.workflow_status AS workflowStatus,
                fm.extended_due_date AS fmExtendedDueDate, fm.original_due_date AS fmOriginalDueDate,
                sm.extended_due_date AS smExtendedDueDate, sm.original_due_date AS smOriginalDueDate
         FROM exam_schedules s
         LEFT JOIN first_markings fm ON fm.exam_schedule_id = s.id
         LEFT JOIN second_markings sm ON sm.exam_schedule_id = s.id
         WHERE s.id = ?`,
        [scheduleId]
      );

      if (!schedule) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Schedule not found' });
        return;
      }

      let currentDueDate: Date | null = null;
      if (phase === ExtensionPhase.FIRST_MARKING) {
        currentDueDate = schedule.fmExtendedDueDate || schedule.fmOriginalDueDate || null;
      } else if (phase === ExtensionPhase.SECOND_MARKING) {
        currentDueDate = schedule.smExtendedDueDate || schedule.smOriginalDueDate || null;
      }

      if (!currentDueDate) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Current phase has not established an initial due date yet.' });
        return;
      }

      const newDate = new Date(requestedDueDate);
      if (newDate <= new Date(currentDueDate)) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Requested due date must be after the current due date.' });
        return;
      }

      const insertRes = await execute(
        `INSERT INTO deadline_extension_requests 
          (exam_schedule_id, phase, requested_by, current_due_date, requested_due_date, reason, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          scheduleId,
          phase,
          user.id,
          currentDueDate,
          newDate,
          reason,
          ExtensionStatus.PENDING,
        ]
      );

      const extension = await queryOne<any>(
        `SELECT id, exam_schedule_id AS examScheduleId, phase, requested_by AS requestedBy,
                current_due_date AS currentDueDate, requested_due_date AS requestedDueDate,
                reason, status, created_at AS createdAt
         FROM deadline_extension_requests WHERE id = ?`,
        [insertRes.insertId]
      );

      await AuditService.logEvent({
        examScheduleId: scheduleId,
        actorUserId: user.id,
        eventType: 'EXTENSION_REQUESTED',
        fromStatus: schedule.workflowStatus,
        toStatus: schedule.workflowStatus,
        description: `Deadline extension requested for ${phase}. Requested date: ${newDate.toISOString().split('T')[0]}. Reason: ${reason}`
      });

      res.status(201).json(extension);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async reviewExtension(req: Request, res: Response): Promise<void> {
    try {
      const requestId = parseInt(req.params.id, 10);
      const { approved, decisionReason } = req.body;
      const user = req.user!;

      const extension = await queryOne<any>(
        `SELECT er.id, er.exam_schedule_id AS examScheduleId, er.phase, er.requested_by AS requestedBy,
                er.requested_due_date AS requestedDueDate, er.status,
                s.workflow_status AS workflowStatus
         FROM deadline_extension_requests er
         INNER JOIN exam_schedules s ON er.exam_schedule_id = s.id
         WHERE er.id = ?`,
        [requestId]
      );

      if (!extension) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Extension request not found' });
        return;
      }

      if (extension.status !== ExtensionStatus.PENDING) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Extension request has already been reviewed.' });
        return;
      }

      // Self-approval prohibition
      if (extension.requestedBy === user.id) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'Self-approval violation: You cannot approve your own extension request.' });
        return;
      }

      await WorkflowService.assertNotLocked(extension.examScheduleId);

      const nextStatus = approved ? ExtensionStatus.APPROVED : ExtensionStatus.REJECTED;

      await withTransaction(async (conn) => {
        await conn.execute(
          `UPDATE deadline_extension_requests
           SET status = ?, reviewed_by = ?, reviewed_at = NOW(), decision_reason = ?
           WHERE id = ?`,
          [nextStatus, user.id, decisionReason ?? null, requestId]
        );

        if (approved) {
          if (extension.phase === ExtensionPhase.FIRST_MARKING) {
            await conn.execute(
              `UPDATE first_markings SET extended_due_date = ? WHERE exam_schedule_id = ?`,
              [extension.requestedDueDate, extension.examScheduleId]
            );
          } else if (extension.phase === ExtensionPhase.SECOND_MARKING) {
            await conn.execute(
              `UPDATE second_markings SET extended_due_date = ? WHERE exam_schedule_id = ?`,
              [extension.requestedDueDate, extension.examScheduleId]
            );
          }
        }
      });

      await AuditService.logEvent({
        examScheduleId: extension.examScheduleId,
        actorUserId: user.id,
        eventType: approved ? 'EXTENSION_APPROVED' : 'EXTENSION_REJECTED',
        fromStatus: extension.workflowStatus,
        toStatus: extension.workflowStatus,
        description: `HOD ${approved ? 'approved' : 'rejected'} deadline extension for ${extension.phase}. New deadline: ${new Date(extension.requestedDueDate).toISOString().split('T')[0]}.`
      });

      res.json({ success: true, status: nextStatus });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async listExtensions(req: Request, res: Response): Promise<void> {
    try {
      const { status } = req.query;

      const conditions: string[] = [];
      const params: any[] = [];

      if (status) {
        conditions.push('er.status = ?');
        params.push(String(status));
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const rows = await query<any>(
        `SELECT er.id, er.exam_schedule_id AS examScheduleId, er.phase, er.requested_by AS requestedBy,
                er.current_due_date AS currentDueDate, er.requested_due_date AS requestedDueDate,
                er.reason, er.status, er.reviewed_by AS reviewedBy, er.reviewed_at AS reviewedAt,
                er.decision_reason AS decisionReason, er.created_at AS createdAt,
                s.id AS s_id, c.course_code AS s_courseCode, c.course_title AS s_courseTitle
         FROM deadline_extension_requests er
         LEFT JOIN exam_schedules s ON er.exam_schedule_id = s.id
         LEFT JOIN course_offerings co ON s.course_offering_id = co.id
         LEFT JOIN courses c ON co.course_id = c.id
         ${whereSql}
         ORDER BY er.created_at DESC`,
        params
      );

      const formatted = rows.map((r: any) => ({
        id: r.id,
        examScheduleId: r.examScheduleId,
        phase: r.phase,
        requestedBy: r.requestedBy,
        currentDueDate: r.currentDueDate,
        requestedDueDate: r.requestedDueDate,
        reason: r.reason,
        status: r.status,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt,
        decisionReason: r.decisionReason,
        createdAt: r.createdAt,
        examSchedule: r.s_id
          ? {
              id: r.s_id,
              courseOffering: {
                course: {
                  courseCode: r.s_courseCode || '',
                  courseTitle: r.s_courseTitle || '',
                }
              }
            }
          : null,
      }));

      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }
}
