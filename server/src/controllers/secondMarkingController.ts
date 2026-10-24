import { Request, Response } from 'express';
import { WorkflowService } from '../services/workflowService';
import { DocumentService } from '../services/documentService';
import { DocumentType, RoleName } from '../types/enums';

export class SecondMarkingController {
  static async recordCourierDispatch(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const { courierReference } = req.body;
      const user = req.user!;

      const result = await WorkflowService.recordCourierDispatch(
        scheduleId,
        courierReference,
        user.id
      );

      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async acknowledgeReceipt(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const user = req.user!;

      const result = await WorkflowService.acknowledgeCourierReceipt(scheduleId, user.id);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async uploadReport(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const user = req.user!;
      const file = req.file;

      if (!file) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Second Marker Report PDF file is required.' });
        return;
      }

      // verify sequential eligibility before writing file
      await WorkflowService.validateSecondMarkingReportUpload(scheduleId, user.id);

      const document = await DocumentService.uploadDocument(
        scheduleId,
        DocumentType.SECOND_MARKING_REPORT,
        file.buffer,
        file.originalname,
        user.id
      );

      const secondMarking = await WorkflowService.recordSecondMarkingReport(
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
        secondMarking,
      });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async confirmArReceipt(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const user = req.user!;

      const result = await WorkflowService.confirmArReceipt(scheduleId, user.id);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }
}
