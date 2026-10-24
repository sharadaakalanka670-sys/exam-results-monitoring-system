import { Request, Response } from 'express';
import { query } from '../config/db';
import { RoleName } from '../types/enums';
import { EmailService } from '../services/emailService';

export class EmailController {
  static async listMyEmails(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const isHod = user.roles.includes(RoleName.HOD);

      // If HOD, can view institutional outbox or their own emails; for other users, view emails addressed to them
      let sql = `
        SELECT id, recipient_user_id AS recipientUserId, recipient_email AS recipientEmail,
               recipient_name AS recipientName, subject, template_key AS templateKey,
               content_html AS contentHtml, content_text AS contentText, exam_schedule_id AS examScheduleId,
               status, sent_at AS sentAt
        FROM email_logs
      `;
      const params: any[] = [];

      if (!isHod) {
        sql += ` WHERE recipient_user_id = ? OR recipient_email = ?`;
        params.push(user.id, user.email);
      }

      sql += ` ORDER BY sent_at DESC LIMIT 50`;

      const emails = await query<any>(sql, params);

      const enriched = emails.map((e) => {
        let senderName = 'RUSL Examination Monitoring System';
        let senderEmail = 'noreply@rusl.ac.lk';

        switch (e.templateKey) {
          case 'EXAM_ENDED_COLLECTION_CALL':
            senderName = 'RUSL Examinations Branch & AR Office';
            senderEmail = 'ar.examinations@rusl.ac.lk';
            break;
          case 'SECOND_EXAMINER_NOMINATION':
            senderName = 'First Examiner via RUSL Portal';
            senderEmail = 'examinations.computing@rusl.ac.lk';
            break;
          case 'NOMINATION_ACCEPTED_HOD_ALERT':
            senderName = 'RUSL Examiner Appointments Desk';
            senderEmail = 'examinations.computing@rusl.ac.lk';
            break;
          case 'SCRIPTS_DISPATCHED_COURIER_NOTICE':
            senderName = 'AR Office Logistics & Courier';
            senderEmail = 'ar.examinations@rusl.ac.lk';
            break;
          case 'SECOND_MARKING_COMPLETED_NOTICE':
            senderName = 'Second Examiner Moderation Desk';
            senderEmail = 'examinations.computing@rusl.ac.lk';
            break;
          case 'HOD_REVIEW_REQUIRED_ALERT':
            senderName = 'First Examiner Submission Desk';
            senderEmail = 'examinations.computing@rusl.ac.lk';
            break;
          case 'HOD_APPROVAL_RELEASE':
            senderName = 'Office of the Head of Department, Computing';
            senderEmail = 'hod.computing@rusl.ac.lk';
            break;
          default:
            senderName = 'RUSL Examination Monitoring System';
            senderEmail = 'noreply@rusl.ac.lk';
        }

        return {
          ...e,
          senderName,
          senderEmail,
          replyTo: 'examinations.computing@rusl.ac.lk',
          securityVerification: 'Signed and verified by Rajarata University of Sri Lanka (rusl.ac.lk)',
        };
      });

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async checkStatus(_req: Request, res: Response): Promise<void> {
    try {
      const status = await EmailService.verifyConnection();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async getSettings(_req: Request, res: Response): Promise<void> {
    try {
      const settings = await EmailService.getSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async saveSettings(req: Request, res: Response): Promise<void> {
    try {
      const { smtpUser, smtpPass, emailFrom, smtpHost, smtpPort, smtpSecure } = req.body;
      if (!smtpUser) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Gmail address (smtpUser) is required.' });
        return;
      }
      const verification = await EmailService.updateSettings({
        smtpUser,
        smtpPass,
        emailFrom,
        smtpHost,
        smtpPort: smtpPort ? parseInt(smtpPort, 10) : undefined,
        smtpSecure: smtpSecure !== undefined ? Boolean(smtpSecure) : undefined,
      });
      res.json({
        success: true,
        message: verification.connected
          ? 'Gmail configuration saved and successfully verified!'
          : 'Settings saved, but Gmail connection check reported: ' + verification.message,
        verification,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async unlink(_req: Request, res: Response): Promise<void> {
    try {
      const result = await EmailService.unlinkSettings();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async testCredentials(req: Request, res: Response): Promise<void> {
    try {
      const { smtpUser, smtpPass, smtpHost, smtpPort, smtpSecure } = req.body;
      if (!smtpUser || !smtpPass) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Both Gmail address and App Password are required to test.' });
        return;
      }
      const result = await EmailService.testCredentials({
        smtpUser,
        smtpPass,
        smtpHost,
        smtpPort: smtpPort ? parseInt(smtpPort, 10) : undefined,
        smtpSecure: smtpSecure !== undefined ? Boolean(smtpSecure) : undefined,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async sendTestEmail(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const recipient = req.body.recipientEmail || user.email;

      const log = await EmailService.sendEmail({
        recipientUserId: user.id,
        recipientEmail: recipient,
        recipientName: user.fullName || 'RUSL User',
        subject: '[Test Email] RUSL Examination Results Monitoring System',
        templateKey: 'SYSTEM_TEST_EMAIL',
        contentText: `This is a test notification confirming that automated emails via Gmail are functioning correctly on the Examination Results Monitoring System.\n\nSent at: ${new Date().toISOString()}`,
        contentHtml: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #1e3a8a, #0f172a); color: white; padding: 24px; text-align: center;">
              <h2 style="margin: 0;">Rajarata University of Sri Lanka</h2>
              <p style="margin: 4px 0 0; font-size: 13px; color: #93c5fd;">Department of Computing • Email Verification</p>
            </div>
            <div style="padding: 24px; background: white;">
              <p>Hello <strong>${user.fullName}</strong>,</p>
              <p>This is a test notification confirming that automated emails via Gmail are functioning properly on the RUSL Examination Results Monitoring System.</p>
              <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 12px; margin: 16px 0;">
                <p style="margin: 0; font-size: 13px; color: #64748b;">Timestamp: <strong>${new Date().toLocaleString()}</strong></p>
                <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Recipient: <strong>${recipient}</strong></p>
              </div>
              <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Examinations Branch & Department of Computing, Faculty of Applied Sciences, RUSL</p>
            </div>
          </div>
        `,
      });

      res.json({ message: 'Test email processed', emailLog: log });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }
}
