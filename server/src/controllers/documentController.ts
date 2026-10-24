import { Request, Response } from 'express';
import { DocumentService } from '../services/documentService';

export class DocumentController {
  static async getDownloadLink(req: Request, res: Response): Promise<void> {
    try {
      const documentId = parseInt(req.params.id, 10);
      const user = req.user!;

      const result = await DocumentService.getDownloadToken(
        documentId,
        user.id,
        user.roles
      );

      res.json({
        downloadUrl: `/api/documents/download?token=${result.downloadToken}`,
        filename: result.filename,
        expiresIn: '5m'
      });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }

  static async downloadFile(req: Request, res: Response): Promise<void> {
    try {
      const token = req.query.token as string;

      if (!token) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Download token is required' });
        return;
      }

      const fileInfo = await DocumentService.resolveFileFromToken(token);

      res.setHeader('Content-Type', fileInfo.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.filename}"`);
      res.sendFile(fileInfo.filePath);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.status ? 'ERROR' : 'SERVER_ERROR', message: err.message });
    }
  }
}
