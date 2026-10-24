import { Request, Response } from 'express';
import { WorkflowService } from '../services/workflowService';
import { DocumentService } from '../services/documentService';
import { DocumentType, RoleName } from '../types/enums';

export class FirstMarkingController {
  static async requestCollectionOtp(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const { scriptCount } = req.body;
      const user = req.user!;

      const result = await WorkflowService.requestCollectionOtp(
        scheduleId,
        parseInt(scriptCount, 10),
        user.id
      );

      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async arGenerateCollectionOtp(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const { scriptCount } = req.body;
      const user = req.user!;

      const result = await WorkflowService.arGenerateCollectionOtp(
        scheduleId,
        scriptCount ? parseInt(scriptCount, 10) : 50,
        user.id
      );

      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async verifyCollectionOtp(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const { otp } = req.body;
      const user = req.user!;

      if (!otp) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'OTP is required.' });
        return;
      }

      const result = await WorkflowService.verifyCollectionOtp(
        scheduleId,
        String(otp).trim(),
        user.id
      );

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
        res.status(400).json({ error: 'BAD_REQUEST', message: 'First Marking Report PDF file is required.' });
        return;
      }

      // check if step is allowed and not locked before uploading
      await WorkflowService.validateFirstMarkingReportUpload(scheduleId, user.id);

      const document = await DocumentService.uploadDocument(
        scheduleId,
        DocumentType.FIRST_MARKING_REPORT,
        file.buffer,
        file.originalname,
        user.id
      );

      const firstMarking = await WorkflowService.recordFirstMarkingReport(
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
        firstMarking,
      });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async requestReturnOtp(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const user = req.user!;

      const result = await WorkflowService.requestReturnOtp(scheduleId, user.id);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async verifyReturnOtp(req: Request, res: Response): Promise<void> {
    try {
      const scheduleId = parseInt(req.params.id, 10);
      const { otp } = req.body;
      const user = req.user!;

      if (!otp) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'OTP is required.' });
        return;
      }

      const result = await WorkflowService.verifyReturnOtp(
        scheduleId,
        String(otp).trim(),
        user.id
      );

      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }
}
