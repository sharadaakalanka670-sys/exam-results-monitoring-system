import { Request, Response } from 'express';
import { WorkflowService } from '../services/workflowService';
import { DocumentService } from '../services/documentService';
import { DocumentType, RoleName } from '../types/enums';
import { execute, queryOne } from '../config/db';

export class FinalMarksheetController {
  static async uploadMarksheet(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const user = req.user!;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Final Marksheet PDF file is required.' });
        return;
      }

      // verify that phase 2 is finished and marksheet not locked before writing file
      await WorkflowService.validateFinalMarksheetUpload(scheduleId, user.id);

      const document = await DocumentService.uploadDocument(
        scheduleId,
        DocumentType.FINAL_MARKSHEET,
        file.buffer,
        file.originalname,
        user.id
      );

      const finalResult = await WorkflowService.recordFinalMarksheet(
        scheduleId,
        document.id,
        user.id
      );

      res.json({
        success: true,
        document: {
          id: document.id,
          filename: document.originalFilename,
          version: document.version,
          size: document.fileSizeBytes,
        },
        finalResult,
      });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async submitMarksheet(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const user = req.user!;

      const result = await WorkflowService.submitFinalMarksheet(scheduleId, user.id);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async requestChanges(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const { revisionReason } = req.body;
      const user = req.user!;

      const result = await WorkflowService.requestChanges(
        scheduleId,
        revisionReason,
        user.id
      );

      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async approve(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const user = req.user!;

      const result = await WorkflowService.approveFinalMarksheet(scheduleId, user.id);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async recordHardcopy(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const { hardcopySubmittedAt } = req.body;

      await WorkflowService.assertNotLocked(scheduleId);

      const dateToSet = hardcopySubmittedAt ? new Date(hardcopySubmittedAt) : new Date();
      await execute(
        `UPDATE final_results SET hardcopy_submitted_at = ? WHERE exam_schedule_id = ?`,
        [dateToSet, scheduleId]
      );

      const updated = await queryOne<any>(
        `SELECT id, exam_schedule_id AS examScheduleId, hardcopy_submitted_at AS hardcopySubmittedAt
         FROM final_results WHERE exam_schedule_id = ?`,
        [scheduleId]
      );

      res.json(updated);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }
}
