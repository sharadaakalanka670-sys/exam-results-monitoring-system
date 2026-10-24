import { queryOne, execute } from '../config/db';
import {
  isValidPdfBuffer,
  computeSha256,
  savePrivateFile,
  generateSignedDownloadToken,
  verifySignedDownloadToken,
  getPrivateFilePath
} from '../utils/storage';
import { DocumentType, RoleName } from '../types/enums';
import { AuditService } from './auditService';
import fs from 'fs';

export class DocumentService {
  /**
   * Uploads and saves a PDF document to private storage and records metadata.
   */
  static async uploadDocument(
    examScheduleId: number,
    documentType: DocumentType,
    fileBuffer: Buffer,
    originalFilename: string,
    uploaderUserId: number
  ) {
    // 1. Verify PDF signature
    if (!isValidPdfBuffer(fileBuffer)) {
      const err: any = new Error('File validation failed: File must be a valid PDF document with %PDF- header.');
      err.status = 400;
      throw err;
    }

    // 2. Compute SHA-256
    const sha256Checksum = computeSha256(fileBuffer);

    // 3. Save to private storage
    const { storageKey } = savePrivateFile(fileBuffer, originalFilename);

    // 4. Determine document version
    const countRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total 
       FROM documents 
       WHERE exam_schedule_id = ? AND document_type = ?`,
      [examScheduleId, documentType]
    );
    const version = (countRow?.total || 0) + 1;

    // 5. Mark previous versions as not current
    await execute(
      `UPDATE documents 
       SET is_current = FALSE 
       WHERE exam_schedule_id = ? AND document_type = ? AND is_current = TRUE`,
      [examScheduleId, documentType]
    );

    // 6. Create document record
    const insertResult = await execute(
      `INSERT INTO documents 
        (exam_schedule_id, document_type, version, original_filename, mime_type, file_size_bytes, sha256_checksum, private_storage_key, uploaded_by, is_current)
       VALUES (?, ?, ?, ?, 'application/pdf', ?, ?, ?, ?, TRUE)`,
      [
        examScheduleId,
        documentType,
        version,
        originalFilename,
        fileBuffer.length,
        sha256Checksum,
        storageKey,
        uploaderUserId
      ]
    );

    const documentId = insertResult.insertId;

    await AuditService.log({
      userId: uploaderUserId,
      examScheduleId,
      action: `UPLOAD_${documentType}`,
      result: 'SUCCESS',
      metadata: { documentId, filename: originalFilename, version, size: fileBuffer.length }
    });

    return {
      id: documentId,
      examScheduleId,
      documentType,
      version,
      originalFilename,
      mimeType: 'application/pdf',
      fileSizeBytes: fileBuffer.length,
      sha256Checksum,
      privateStorageKey: storageKey,
      uploadedBy: uploaderUserId,
      isCurrent: true,
    };
  }

  /**
   * Generates a signed download token after checking authorization.
   */
  static async getDownloadToken(
    documentId: number,
    requestingUserId: number,
    userRoles: RoleName[]
  ): Promise<{ downloadToken: string; filename: string }> {
    // Strictly forbid AR_OFFICE, HOD_CLERK, and DEAN from downloading documents
    const forbiddenRoles = [RoleName.AR_OFFICE, RoleName.HOD_CLERK, RoleName.DEAN];
    const onlyHasForbidden = userRoles.every(r => forbiddenRoles.includes(r));
    if (onlyHasForbidden && !userRoles.includes(RoleName.HOD) && !userRoles.includes(RoleName.LECTURER) && !userRoles.includes(RoleName.SECOND_EXAMINER)) {
      const err: any = new Error('FORBIDDEN: Your role is not authorized to download examination documents.');
      err.status = 403;
      throw err;
    }

    const doc = await queryOne<any>(
      `SELECT d.id, d.original_filename AS originalFilename, d.document_type AS documentType,
              s.id AS examScheduleId, s.first_examiner_user_id AS firstExaminerUserId,
              ep.user_id AS secondExaminerUserId
       FROM documents d
       INNER JOIN exam_schedules s ON d.exam_schedule_id = s.id
       LEFT JOIN examiner_profiles ep ON s.second_examiner_profile_id = ep.id
       WHERE d.id = ?`,
      [documentId]
    );

    if (!doc) {
      const err: any = new Error('Document not found');
      err.status = 404;
      throw err;
    }

    const isHod = userRoles.includes(RoleName.HOD);
    const isFirstExaminer = doc.firstExaminerUserId === requestingUserId;
    const isSecondExaminer = doc.secondExaminerUserId === requestingUserId;

    // Document type specific checks:
    // FIRST_MARKING_REPORT: HOD, First Examiner, Second Examiner
    // SECOND_MARKING_REPORT: HOD, First Examiner, Second Examiner
    // FINAL_MARKSHEET: HOD, First Examiner (Second examiner should not see final marksheet unless HOD)
    if (doc.documentType === DocumentType.FINAL_MARKSHEET) {
      if (!isHod && !isFirstExaminer) {
        const err: any = new Error('FORBIDDEN: Only HOD and assigned First Examiner can access the Final Marksheet.');
        err.status = 403;
        throw err;
      }
    } else {
      if (!isHod && !isFirstExaminer && !isSecondExaminer) {
        const err: any = new Error('FORBIDDEN: You are not assigned to this schedule and cannot access this report.');
        err.status = 403;
        throw err;
      }
    }

    const token = generateSignedDownloadToken({
      documentId: doc.id,
      userId: requestingUserId,
      examScheduleId: doc.examScheduleId,
      documentType: doc.documentType
    });

    return { downloadToken: token, filename: doc.originalFilename };
  }

  /**
   * Redeems signed download token and returns local file path.
   * Re-validates token and checks that file exists on disk.
   */
  static async resolveFileFromToken(token: string): Promise<{ filePath: string; filename: string; mimeType: string }> {
    const payload = verifySignedDownloadToken(token);
    if (!payload) {
      const err: any = new Error('INVALID_TOKEN: Download token is invalid or has expired.');
      err.status = 401;
      throw err;
    }

    const doc = await queryOne<any>(
      `SELECT id, original_filename AS originalFilename, mime_type AS mimeType, private_storage_key AS privateStorageKey
       FROM documents 
       WHERE id = ?`,
      [payload.documentId]
    );

    if (!doc) {
      const err: any = new Error('Document not found');
      err.status = 404;
      throw err;
    }

    const fullPath = getPrivateFilePath(doc.privateStorageKey);

    if (!fs.existsSync(fullPath)) {
      const err: any = new Error('Stored file not found on disk');
      err.status = 404;
      throw err;
    }

    return {
      filePath: fullPath,
      filename: doc.originalFilename,
      mimeType: doc.mimeType
    };
  }
}
