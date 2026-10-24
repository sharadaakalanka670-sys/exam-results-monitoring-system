import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { query, queryOne, execute } from '../config/db';
import { ENV } from '../config/env';
import { AuditService } from './auditService';

export interface EmailPayload {
  recipientUserId?: number;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  templateKey: string;
  examScheduleId?: number;
  contentHtml: string;
  contentText: string;
}

interface SmtpSettings {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  emailFrom: string;
}

let cachedSettings: SmtpSettings | null = null;
let transporterInstance: Transporter | null = null;

async function resolveSettings(): Promise<SmtpSettings> {
  if (cachedSettings) return cachedSettings;

  try {
    const rows = await query<{ setting_key: string; setting_value: string }>(
      `SELECT setting_key, setting_value 
       FROM system_settings 
       WHERE setting_key IN ('smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'email_from')`
    );

    const map = new Map<string, string>();
    for (const r of rows) {
      map.set(r.setting_key, r.setting_value);
    }

    cachedSettings = {
      smtpHost: map.get('smtp_host') || ENV.SMTP_HOST || 'smtp.gmail.com',
      smtpPort: parseInt(map.get('smtp_port') || String(ENV.SMTP_PORT || '465'), 10),
      smtpSecure: map.has('smtp_secure') ? map.get('smtp_secure') === 'true' : ENV.SMTP_SECURE,
      smtpUser: map.get('smtp_user') || ENV.SMTP_USER || '',
      smtpPass: map.get('smtp_pass') || ENV.SMTP_PASS || '',
      emailFrom: map.get('email_from') || ENV.EMAIL_FROM || 'RUSL Exam Monitoring <noreply@rusl.ac.lk>',
    };
  } catch (err) {
    cachedSettings = {
      smtpHost: ENV.SMTP_HOST || 'smtp.gmail.com',
      smtpPort: ENV.SMTP_PORT || 465,
      smtpSecure: ENV.SMTP_SECURE,
      smtpUser: ENV.SMTP_USER || '',
      smtpPass: ENV.SMTP_PASS || '',
      emailFrom: ENV.EMAIL_FROM || 'RUSL Exam Monitoring <noreply@rusl.ac.lk>',
    };
  }

  return cachedSettings;
}

async function getTransporter(): Promise<{ transporter: Transporter | null; settings: SmtpSettings }> {
  const settings = await resolveSettings();
  if (!settings.smtpUser || !settings.smtpPass) {
    return { transporter: null, settings };
  }
  if (!transporterInstance) {
    transporterInstance = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
    });
  }
  return { transporter: transporterInstance, settings };
}

export class EmailService {
  /**
   * Retrieves active email settings (without exposing plaintext password).
   */
  static async getSettings() {
    const s = await resolveSettings();
    const linkedAtRecord = await queryOne<{ setting_value: string }>(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'smtp_linked_at'`
    ).catch(() => null);

    return {
      isLinked: !!(s.smtpUser && s.smtpPass),
      smtpHost: s.smtpHost,
      smtpPort: s.smtpPort,
      smtpSecure: s.smtpSecure,
      smtpUser: s.smtpUser,
      smtpPassConfigured: !!s.smtpPass,
      emailFrom: s.emailFrom,
      linkedAt: linkedAtRecord?.setting_value || null,
    };
  }

  /**
   * Updates SMTP/Gmail settings in MySQL system_settings and updates active transporter.
   */
  static async updateSettings(newSettings: {
    smtpUser: string;
    smtpPass?: string;
    emailFrom?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
  }) {
    const current = await resolveSettings();
    const finalPass = newSettings.smtpPass && newSettings.smtpPass.trim() ? newSettings.smtpPass.trim() : current.smtpPass;
    const finalUser = newSettings.smtpUser.trim();
    const finalHost = newSettings.smtpHost?.trim() || 'smtp.gmail.com';
    const finalPort = newSettings.smtpPort || 465;
    const finalSecure = newSettings.smtpSecure !== undefined ? newSettings.smtpSecure : true;
    const finalFrom = newSettings.emailFrom?.trim() || `RUSL Exam Monitoring <${finalUser}>`;

    const upserts = [
      { key: 'smtp_user', val: finalUser, desc: 'SMTP / Gmail Username' },
      { key: 'smtp_pass', val: finalPass, desc: 'SMTP / Gmail App Password' },
      { key: 'smtp_host', val: finalHost, desc: 'SMTP Host' },
      { key: 'smtp_port', val: String(finalPort), desc: 'SMTP Port' },
      { key: 'smtp_secure', val: String(finalSecure), desc: 'SMTP SSL/TLS' },
      { key: 'email_from', val: finalFrom, desc: 'Default Sender From header' },
      { key: 'smtp_linked_at', val: new Date().toISOString(), desc: 'Timestamp when Gmail account was linked' },
    ];

    for (const item of upserts) {
      await execute(
        `INSERT INTO system_settings (setting_key, setting_value, description)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
        [item.key, item.val, item.desc]
      );
    }

    cachedSettings = null;
    transporterInstance = null;

    return await EmailService.verifyConnection();
  }

  /**
   * Unlinks / disconnects the configured Gmail account from system settings.
   */
  static async unlinkSettings() {
    await execute(
      `DELETE FROM system_settings 
       WHERE setting_key IN ('smtp_user', 'smtp_pass', 'email_from', 'smtp_linked_at')`
    );

    cachedSettings = null;
    if (transporterInstance) {
      try {
        transporterInstance.close();
      } catch {
        // ignore
      }
      transporterInstance = null;
    }

    return {
      success: true,
      message: 'Gmail account unlinked successfully. Automated email dispatch has been reset.'
    };
  }

  /**
   * Tests ad-hoc credentials before saving.
   */
  static async testCredentials(creds: {
    smtpHost?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
    smtpUser: string;
    smtpPass: string;
  }) {
    try {
      const testTransport = nodemailer.createTransport({
        host: creds.smtpHost || 'smtp.gmail.com',
        port: creds.smtpPort || 465,
        secure: creds.smtpSecure !== undefined ? creds.smtpSecure : true,
        auth: {
          user: creds.smtpUser.trim(),
          pass: creds.smtpPass.trim(),
        },
      });
      await testTransport.verify();
      return { connected: true, message: 'Google SMTP verification successful! Credentials are valid.' };
    } catch (err: any) {
      return { connected: false, message: err.message || 'Failed to authenticate with Gmail SMTP.' };
    }
  }

  /**
   * Verifies the active SMTP/Gmail connection status.
   */
  static async verifyConnection(): Promise<{ connected: boolean; message: string }> {
    const { transporter, settings } = await getTransporter();
    if (!transporter || !settings.smtpUser || !settings.smtpPass) {
      return {
        connected: false,
        message: 'Gmail credentials (User and App Password) are not configured yet.',
      };
    }
    try {
      await transporter.verify();
      return { connected: true, message: 'Successfully connected to Gmail SMTP server.' };
    } catch (err: any) {
      return { connected: false, message: err.message };
    }
  }

  /**
   * Dispatches and logs an auto-customized email.
   * - If Gmail SMTP credentials are configured, sends real email via Gmail.
   * - If not, logs simulation cleanly.
   * - Always persists to EmailLog and in-app Notification database.
   */
  static async sendEmail(payload: EmailPayload) {
    console.log(`[EmailService] Dispatched email: "${payload.subject}" to ${payload.recipientEmail} (${payload.recipientName})`);

    let deliveryStatus = 'SIMULATED';
    const { transporter, settings } = await getTransporter();

    if (transporter) {
      try {
        const info = await transporter.sendMail({
          from: settings.emailFrom || `RUSL Exam Monitoring <${settings.smtpUser}>`,
          to: `"${payload.recipientName}" <${payload.recipientEmail}>`,
          subject: payload.subject,
          text: payload.contentText,
          html: payload.contentHtml,
        });
        console.log(`✔ [EmailService:Gmail] Dispatched to ${payload.recipientEmail} (MessageId: ${info.messageId})`);
        deliveryStatus = 'DELIVERED';
      } catch (err: any) {
        console.error(`❌ [EmailService:Gmail Error] Failed to send email to ${payload.recipientEmail}:`, err.message);
        deliveryStatus = 'FAILED';
      }
    }

    const logResult = await execute(
      `INSERT INTO email_logs 
        (recipient_user_id, recipient_email, recipient_name, subject, template_key, content_html, content_text, exam_schedule_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.recipientUserId ?? null,
        payload.recipientEmail,
        payload.recipientName,
        payload.subject,
        payload.templateKey,
        payload.contentHtml,
        payload.contentText,
        payload.examScheduleId ?? null,
        deliveryStatus,
      ]
    );

    const emailLog = {
      id: logResult.insertId,
      recipientUserId: payload.recipientUserId,
      recipientEmail: payload.recipientEmail,
      recipientName: payload.recipientName,
      subject: payload.subject,
      templateKey: payload.templateKey,
      contentHtml: payload.contentHtml,
      contentText: payload.contentText,
      examScheduleId: payload.examScheduleId,
      status: deliveryStatus,
    };

    // Also persist an in-app notification for the user
    if (payload.recipientUserId) {
      await execute(
        `INSERT INTO notifications 
          (recipient_user_id, exam_schedule_id, type, title, body)
         VALUES (?, ?, ?, ?, ?)`,
        [
          payload.recipientUserId,
          payload.examScheduleId ?? null,
          payload.templateKey,
          payload.subject,
          payload.contentText,
        ]
      );
    }

    return emailLog;
  }

  // ==========================================
  // Auto-Customized Email Templates
  // ==========================================

  /**
   * 1. Exam Ended: AR generates OTP and alerts 1st Examiner to collect paper packets.
   */
  static async sendExamEndedCollectionCall(params: {
    scheduleId: number;
    courseCode: string;
    courseTitle: string;
    lecturerUser: { id: number; fullName: string; designation?: string; email: string };
    otp: string;
    scriptCount?: number;
    examDate?: Date | null;
  }) {
    const { scheduleId, courseCode, courseTitle, lecturerUser, otp, scriptCount, examDate } = params;
    const formattedDate = examDate ? new Date(examDate).toLocaleDateString() : 'Recent';

    const subject = `[Action Required] Exam Concluded: Collect Paper Packets for ${courseCode} (Handover OTP: ${otp})`;

    const contentText = `Dear ${lecturerUser.fullName},
${lecturerUser.designation || 'Lecturer / First Examiner'},

The examination for ${courseCode} (${courseTitle}) conducted on ${formattedDate} has concluded. The physical examination paper packets (approx. ${scriptCount || 50} scripts) have been deposited and secured at the Examinations Branch (AR Office).

Please proceed to the AR Office to collect your paper packets.

==================================================
YOUR PHYSICAL SCRIPT COLLECTION OTP:
>>> ${otp} <<<
==================================================

INSTRUCTIONS FOR HANDOVER:
1. Visit the Examinations Branch counter in person.
2. Tell this single-use 6-digit OTP code to the Senior Assistant Registrar (Examinations).
3. The AR Office will verify the code in the system to confirm physical packet handover.
4. Upon verification, your 3-calendar-month first marking deadline will officially commence.

Examinations Branch & Department of Computing
Faculty of Applied Sciences, Rajarata University of Sri Lanka`;

    const contentHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #881337, #4c0519); color: white; padding: 24px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">Rajarata University of Sri Lanka</h2>
          <p style="margin: 4px 0 0; font-size: 13px; color: #fecdd3;">Examinations Branch • Script Handover Call</p>
        </div>
        <div style="padding: 24px;">
          <p style="font-size: 15px; margin-top: 0;">Dear <strong>${lecturerUser.fullName}</strong>,<br>
          <span style="color: #64748b; font-size: 13px;">${lecturerUser.designation || 'First Examiner'}</span></p>

          <p>The examination for <strong>${courseCode} (${courseTitle})</strong> has concluded. The physical answer script packets are ready for collection at the AR Office.</p>

          <div style="background: #f8fafc; border: 2px dashed #94a3b8; border-radius: 10px; padding: 18px; text-align: center; margin: 20px 0;">
            <span style="font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Single-Use Collection Handover OTP</span>
            <div style="font-size: 32px; font-family: monospace; font-weight: bold; color: #881337; letter-spacing: 6px; margin: 8px 0;">
              ${otp}
            </div>
            <span style="font-size: 12px; color: #475569;">Tell this code to the AR Office officer upon in-person collection.</span>
          </div>

          <p style="font-size: 13px; color: #475569;"><strong>Important Note:</strong> Verification of this OTP by AR confirms physical handover of answer scripts and begins your 3-month marking timeline.</p>
        </div>
        <div style="background: #f1f5f9; padding: 14px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
          Department of Computing • Faculty of Applied Sciences • Mihintale
        </div>
      </div>
    `;

    return this.sendEmail({
      recipientUserId: lecturerUser.id,
      recipientEmail: lecturerUser.email,
      recipientName: lecturerUser.fullName,
      subject,
      templateKey: 'EXAM_ENDED_COLLECTION_CALL',
      examScheduleId: scheduleId,
      contentHtml,
      contentText,
    });
  }

  /**
   * 2. First Examiner nominates/requests Second Examiner.
   */
  static async sendSecondExaminerNomination(params: {
    scheduleId: number;
    courseCode: string;
    courseTitle: string;
    batchLabel?: string;
    firstExaminerUser: { fullName: string; designation?: string };
    candidateUser: { id?: number; fullName: string; email: string; designation?: string };
    invitationId: number;
  }) {
    const { scheduleId, courseCode, courseTitle, batchLabel, firstExaminerUser, candidateUser } = params;

    const subject = `Nomination as Second Examiner: ${courseCode} (${courseTitle})`;

    const contentText = `Dear ${candidateUser.fullName},
${candidateUser.designation || 'Colleague / External Academic'},

You have been nominated by ${firstExaminerUser.fullName} (${firstExaminerUser.designation || 'First Examiner'}) to serve as the Second Examiner for the following course:

Course Code: ${courseCode}
Course Title: ${courseTitle}
Batch / Session: Batch ${batchLabel || 'Current'}

WORKFLOW RESPONSIBILITIES:
- Acknowledge receipt of couriered script sample.
- Independently evaluate and submit the Second Marker Report PDF within 1 calendar month.
- Return scripts to the AR Office.

Please sign in to the RUSL Exam Results Monitoring System to Review and Accept or Decline this nomination.
Upon your acceptance, the appointment will be submitted to the Head of Department for final review and approval.

Department of Computing
Faculty of Applied Sciences, Rajarata University of Sri Lanka`;

    const contentHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1e3a8a, #0f172a); color: white; padding: 24px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">Second Examiner Nomination</h2>
          <p style="margin: 4px 0 0; font-size: 13px; color: #93c5fd;">Department of Computing • Faculty of Applied Sciences</p>
        </div>
        <div style="padding: 24px;">
          <p style="font-size: 15px; margin-top: 0;">Dear <strong>${candidateUser.fullName}</strong>,<br>
          <span style="color: #64748b; font-size: 13px;">${candidateUser.designation || 'Examiner Candidate'}</span></p>

          <p>You have been nominated by <strong>${firstExaminerUser.fullName}</strong> to serve as Second Examiner for:</p>
          <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;">
            <strong style="color: #1e40af; font-size: 15px;">${courseCode}: ${courseTitle}</strong><br>
            <span style="font-size: 13px; color: #475569;">Batch ${batchLabel || 'Current'}</span>
          </div>

          <p style="font-size: 13px;">Please sign in to the examination portal to <strong>Accept</strong> or <strong>Decline</strong> this nomination. Once accepted, the appointment will be forwarded to the Head of Department for final confirmation.</p>
        </div>
      </div>
    `;

    return this.sendEmail({
      recipientUserId: candidateUser.id,
      recipientEmail: candidateUser.email,
      recipientName: candidateUser.fullName,
      subject,
      templateKey: 'SECOND_EXAMINER_NOMINATION',
      examScheduleId: scheduleId,
      contentHtml,
      contentText,
    });
  }

  /**
   * 3. Second Examiner accepts nomination -> Alerts HOD for final review & approval.
   */
  static async sendNominationAcceptedToHod(params: {
    scheduleId: number;
    courseCode: string;
    courseTitle: string;
    candidateUser: { fullName: string; designation?: string; institution?: string };
    candidateSeniority: number;
    candidateLoad: number;
    firstExaminerUser: { fullName: string };
    hodUser: { id: number; fullName: string; email: string };
  }) {
    const { scheduleId, courseCode, courseTitle, candidateUser, candidateSeniority, candidateLoad, firstExaminerUser, hodUser } = params;

    const subject = `[Action Required] 2nd Examiner Accepted: Review & Approve for ${courseCode} (${candidateUser.fullName})`;

    const contentText = `Dear ${hodUser.fullName},
Head of Department,

${candidateUser.fullName} (${candidateUser.designation || 'Examiner'}, ${candidateUser.institution || 'RUSL'}) has ACCEPTED the nomination by ${firstExaminerUser.fullName} to serve as Second Examiner for ${courseCode} (${courseTitle}).

QUALIFICATION & REGULATORY CHECK:
- Candidate Academic Rank: ${candidateUser.designation || 'Examiner'}
- Current Active Subject Workload: ${candidateLoad}/3 active subjects

In accordance with RUSL Examination Regulations, please sign in to the HOD Dashboard to review this accepted nomination and grant Final Approval to confirm the assignment.

Department of Computing
Faculty of Applied Sciences, Rajarata University of Sri Lanka`;

    const contentHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #065f46, #064e3b); color: white; padding: 24px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">HOD Action Required: Confirm 2nd Examiner</h2>
          <p style="margin: 4px 0 0; font-size: 13px; color: #a7f3d0;">Candidate Accepted Nomination</p>
        </div>
        <div style="padding: 24px;">
          <p style="font-size: 15px; margin-top: 0;">Dear <strong>${hodUser.fullName}</strong> (HOD),</p>
          <p><strong>${candidateUser.fullName}</strong> has accepted the nomination to serve as Second Examiner for <strong>${courseCode} (${courseTitle})</strong>.</p>

          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Nominated By:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${firstExaminerUser.fullName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Candidate Academic Rank:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #065f46;">${candidateUser.designation || 'Examiner'}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Active Subject Load:</td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${candidateLoad}/3 subjects</td></tr>
          </table>

          <p style="font-size: 13px;">Please review and click <strong>Approve</strong> in the HOD Actions Queue to finalize this assignment.</p>
        </div>
      </div>
    `;

    return this.sendEmail({
      recipientUserId: hodUser.id,
      recipientEmail: hodUser.email,
      recipientName: hodUser.fullName,
      subject,
      templateKey: 'SECOND_EXAMINER_ACCEPTED_HOD_REVIEW',
      examScheduleId: scheduleId,
      contentHtml,
      contentText,
    });
  }

  /**
   * 4. HOD confirms 2nd Examiner approval -> Notifies 1st Examiner & 2nd Examiner.
   */
  static async sendHodApprovalConfirmed(params: {
    scheduleId: number;
    courseCode: string;
    courseTitle: string;
    candidateUser: { id?: number; fullName: string; email: string };
    firstExaminerUser: { id: number; fullName: string; email: string };
    hodUser: { fullName: string };
  }) {
    const { scheduleId, courseCode, courseTitle, candidateUser, firstExaminerUser, hodUser } = params;

    const subject = `Official Appointment Confirmed: Second Examiner for ${courseCode}`;

    const textToFirst = `Dear ${firstExaminerUser.fullName},

The Head of Department (${hodUser.fullName}) has officially reviewed and approved ${candidateUser.fullName} as the Second Examiner for ${courseCode} (${courseTitle}).

The assignment is now active on the examination schedule.

Department of Computing
Faculty of Applied Sciences, Rajarata University of Sri Lanka`;

    const htmlToFirst = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h3 style="color: #065f46;">Second Examiner Appointment Confirmed</h3>
        <p>Dear ${firstExaminerUser.fullName},</p>
        <p>The appointment of <strong>${candidateUser.fullName}</strong> as Second Examiner for <strong>${courseCode} (${courseTitle})</strong> has been officially approved by the Head of Department (<strong>${hodUser.fullName}</strong>).</p>
      </div>
    `;

    await this.sendEmail({
      recipientUserId: firstExaminerUser.id,
      recipientEmail: firstExaminerUser.email,
      recipientName: firstExaminerUser.fullName,
      subject,
      templateKey: 'SECOND_EXAMINER_APPROVED_CONFIRMATION',
      examScheduleId: scheduleId,
      contentHtml: htmlToFirst,
      contentText: textToFirst,
    });

    if (candidateUser.id) {
      const textToCandidate = `Dear ${candidateUser.fullName},

Your appointment as Second Examiner for ${courseCode} (${courseTitle}) has been officially approved by the Head of Department (${hodUser.fullName}).

Once First Marking is complete and scripts are couriered by the AR Office, you will be alerted to acknowledge receipt and begin second marking.

Department of Computing
Faculty of Applied Sciences, Rajarata University of Sri Lanka`;

      await this.sendEmail({
        recipientUserId: candidateUser.id,
        recipientEmail: candidateUser.email,
        recipientName: candidateUser.fullName,
        subject,
        templateKey: 'SECOND_EXAMINER_APPROVED_CONFIRMATION',
        examScheduleId: scheduleId,
        contentHtml: htmlToFirst,
        contentText: textToCandidate,
      });
    }
  }

  /**
   * 5. Courier Dispatched to Second Examiner.
   */
  static async sendCourierDispatched(params: {
    scheduleId: number;
    courseCode: string;
    courseTitle: string;
    secondExaminerUser: { id?: number; fullName: string; email: string };
    courierReference?: string;
    dueDate: Date;
  }) {
    const { scheduleId, courseCode, courseTitle, secondExaminerUser, courierReference, dueDate } = params;

    const subject = `[Scripts Dispatched] Courier Reference for ${courseCode} Second Marking`;
    const formattedDue = dueDate.toLocaleDateString();

    const contentText = `Dear ${secondExaminerUser.fullName},

Answer scripts for ${courseCode} (${courseTitle}) have been dispatched to you via courier by the AR Office (Examinations Branch).

Courier Tracking Reference: ${courierReference || 'N/A'}
Second Marking Due Date: ${formattedDue} (1 Calendar Month)

Please sign in to acknowledge receipt upon receiving the physical package.

Examinations Branch,
Rajarata University of Sri Lanka`;

    const contentHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h3 style="color: #6b21a8;">Scripts Dispatched via Courier</h3>
        <p>Dear ${secondExaminerUser.fullName},</p>
        <p>Answer scripts for <strong>${courseCode} (${courseTitle})</strong> have been dispatched by the AR Office.</p>
        <p><strong>Tracking Ref:</strong> ${courierReference || 'N/A'}<br>
        <strong>1-Month Due Date:</strong> ${formattedDue}</p>
        <p>Please acknowledge receipt once you receive the physical parcel.</p>
      </div>
    `;

    return this.sendEmail({
      recipientUserId: secondExaminerUser.id,
      recipientEmail: secondExaminerUser.email,
      recipientName: secondExaminerUser.fullName,
      subject,
      templateKey: 'COURIER_DISPATCHED_TO_SECOND_EXAMINER',
      examScheduleId: scheduleId,
      contentHtml,
      contentText,
    });
  }

  /**
   * 6. Second Marking Complete -> Alert First Examiner to Prepare Final Marksheet.
   */
  static async sendSecondMarkingComplete(params: {
    scheduleId: number;
    courseCode: string;
    courseTitle: string;
    firstExaminerUser: { id: number; fullName: string; email: string };
  }) {
    const { scheduleId, courseCode, courseTitle, firstExaminerUser } = params;

    const subject = `Second Marking Completed: Prepare Final Marksheet for ${courseCode}`;

    const contentText = `Dear ${firstExaminerUser.fullName},

Second marking for ${courseCode} (${courseTitle}) is now complete. The Second Marker Report PDF has been uploaded and scripts have been safely returned to the AR Office.

You can now download the Second Marker Report from the portal, compile your Continuous Assessment (CA) marks, and upload/submit the Final Marksheet for HOD approval.

Department of Computing,
Rajarata University of Sri Lanka`;

    const contentHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h3 style="color: #0369a1;">Second Marking Completed</h3>
        <p>Dear ${firstExaminerUser.fullName},</p>
        <p>Second marking for <strong>${courseCode} (${courseTitle})</strong> is complete. You may now download the second marking report and submit the final marksheet for review.</p>
      </div>
    `;

    return this.sendEmail({
      recipientUserId: firstExaminerUser.id,
      recipientEmail: firstExaminerUser.email,
      recipientName: firstExaminerUser.fullName,
      subject,
      templateKey: 'SECOND_MARKING_COMPLETED_PREPARE_MARKSHEET',
      examScheduleId: scheduleId,
      contentHtml,
      contentText,
    });
  }

  /**
   * 7. Final Marksheet Submitted -> Alert HOD.
   */
  static async sendFinalMarksheetSubmitted(params: {
    scheduleId: number;
    courseCode: string;
    courseTitle: string;
    firstExaminerUser: { fullName: string };
    hodUser: { id: number; fullName: string; email: string };
  }) {
    const { scheduleId, courseCode, courseTitle, firstExaminerUser, hodUser } = params;

    const subject = `[HOD Review Required] Final Marksheet Submitted: ${courseCode} (${firstExaminerUser.fullName})`;

    const contentText = `Dear ${hodUser.fullName},
Head of Department,

The Final Marksheet for ${courseCode} (${courseTitle}) has been compiled and submitted by the First Examiner (${firstExaminerUser.fullName}).

All prerequisite checkpoints (First Report, Scripts Returned, Second Report, AR Received) have been completed.

Please sign in to the HOD Dashboard to review the marksheet and either grant Final Approval (which permanently locks the workflow) or request revisions.

Department of Computing,
Rajarata University of Sri Lanka`;

    const contentHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h3 style="color: #881337;">Final Marksheet Submitted for Review</h3>
        <p>Dear ${hodUser.fullName} (HOD),</p>
        <p><strong>${firstExaminerUser.fullName}</strong> has submitted the Final Marksheet for <strong>${courseCode} (${courseTitle})</strong>. Please review and grant final approval.</p>
      </div>
    `;

    return this.sendEmail({
      recipientUserId: hodUser.id,
      recipientEmail: hodUser.email,
      recipientName: hodUser.fullName,
      subject,
      templateKey: 'FINAL_MARKSHEET_SUBMITTED_FOR_HOD_APPROVAL',
      examScheduleId: scheduleId,
      contentHtml,
      contentText,
    });
  }

  /**
   * 8. Final Results Approved & Workflow Locked.
   */
  static async sendFinalApprovalLocked(params: {
    scheduleId: number;
    courseCode: string;
    courseTitle: string;
    firstExaminerUser: { id: number; fullName: string; email: string };
    hodUser: { fullName: string };
  }) {
    const { scheduleId, courseCode, courseTitle, firstExaminerUser, hodUser } = params;

    const subject = `[Approved & Locked] Final Results Released: ${courseCode}`;

    const contentText = `Dear ${firstExaminerUser.fullName},

The Final Marksheet for ${courseCode} (${courseTitle}) has received FINAL APPROVAL from the Head of Department (${hodUser.fullName}).

Pursuant to RUSL Examination Regulations, the examination results workflow has been permanently locked. No further modifications or document replacements are permitted.

Department of Computing,
Rajarata University of Sri Lanka`;

    const contentHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h3 style="color: #065f46;">Results Approved & Workflow Permanently Locked</h3>
        <p>Dear ${firstExaminerUser.fullName},</p>
        <p>Final approval has been granted by <strong>${hodUser.fullName}</strong> (HOD) for <strong>${courseCode} (${courseTitle})</strong>. Workflow is now locked.</p>
      </div>
    `;

    return this.sendEmail({
      recipientUserId: firstExaminerUser.id,
      recipientEmail: firstExaminerUser.email,
      recipientName: firstExaminerUser.fullName,
      subject,
      templateKey: 'FINAL_RESULTS_APPROVED_LOCKED',
      examScheduleId: scheduleId,
      contentHtml,
      contentText,
    });
  }

  /**
   * 9. Password Reset Verification OTP Dispatch.
   */
  static async sendPasswordResetOtp(params: {
    user: { id: number; fullName: string; email: string };
    otp: string;
  }) {
    const { user, otp } = params;
    const subject = `[Security Alert] Password Reset Verification Code: ${otp}`;

    const contentText = `Dear ${user.fullName},

We received a request to reset your password for the RUSL Examination Results Monitoring System.

Your 6-digit Password Reset Verification Code is:
${otp}

This code is valid for 15 minutes. For security reasons, never share this verification code with anyone.

If you did not initiate this password reset request, please contact the System Administrator or Head of Department immediately.

Department of Computing • Faculty of Applied Sciences
Rajarata University of Sri Lanka`;

    const contentHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1e293b, #0f172a); color: white; padding: 24px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">Rajarata University of Sri Lanka</h2>
          <p style="margin: 4px 0 0; font-size: 13px; color: #cbd5e1;">Account Security • Password Reset Verification</p>
        </div>
        <div style="padding: 24px;">
          <p style="margin-top: 0;">Dear <strong>${user.fullName}</strong>,</p>
          <p>We received an official request to reset your password for the <strong>RUSL Examination Results Monitoring System</strong>.</p>

          <div style="background: #f8fafc; border: 2px dashed #dc2626; border-radius: 10px; padding: 18px; text-align: center; margin: 20px 0;">
            <span style="font-size: 11px; font-weight: bold; color: #dc2626; text-transform: uppercase; letter-spacing: 1.5px;">6-Digit Security Reset OTP</span>
            <div style="font-size: 34px; font-family: monospace; font-weight: bold; color: #991b1b; letter-spacing: 8px; margin: 8px 0;">
              ${otp}
            </div>
            <span style="font-size: 12px; color: #64748b;">Valid for 15 minutes. Do not share this code.</span>
          </div>

          <p style="font-size: 12px; color: #64748b;">If you did not initiate this password reset, please notify the Department of Computing administration immediately.</p>
        </div>
        <div style="background: #f1f5f9; padding: 12px; text-align: center; font-size: 11px; color: #64748b;">
          Department of Computing • Faculty of Applied Sciences • RUSL
        </div>
      </div>
    `;

    return this.sendEmail({
      recipientUserId: user.id,
      recipientEmail: user.email,
      recipientName: user.fullName,
      subject,
      templateKey: 'PASSWORD_RESET_OTP',
      contentHtml,
      contentText,
    });
  }

  /**
   * 10. Password Reset Successful Confirmation.
   */
  static async sendPasswordResetSuccess(params: {
    user: { id: number; fullName: string; email: string };
  }) {
    const { user } = params;
    const subject = `[Security Notice] Your Password Was Successfully Reset`;

    const contentText = `Dear ${user.fullName},

This is an automated confirmation that your password for the RUSL Examination Results Monitoring System was successfully changed.

If you performed this action, you can safely disregard this email.
If you did not make this change, please report this incident immediately to the Head of Department.

Department of Computing • Faculty of Applied Sciences
Rajarata University of Sri Lanka`;

    const contentHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h3 style="color: #047857; margin-top: 0;">Password Successfully Reset</h3>
        <p>Dear <strong>${user.fullName}</strong>,</p>
        <p>Your password for the RUSL Examination Results Monitoring System has been successfully updated.</p>
        <p style="font-size: 12px; color: #64748b;">If you did not authorize this change, please contact departmental administration immediately.</p>
      </div>
    `;

    return this.sendEmail({
      recipientUserId: user.id,
      recipientEmail: user.email,
      recipientName: user.fullName,
      subject,
      templateKey: 'PASSWORD_RESET_SUCCESS',
      contentHtml,
      contentText,
    });
  }

  /**
   * 11. New Staff Member Registration & Role Approval Alert to HOD.
   */
  static async sendNewStaffRegistrationAlert(params: {
    newUser: { id: number; fullName: string; email: string; designation: string };
    requestedRole: string;
    hodUser: { id: number; fullName: string; email: string };
  }) {
    const { newUser, requestedRole, hodUser } = params;
    const subject = `[Action Required] New Staff Registration: ${newUser.fullName} (${requestedRole})`;

    const contentText = `Dear Dr. ${hodUser.fullName} (Head of Department),

A new member has signed up on the RUSL Examination Results Monitoring System and is requesting role activation:

- Full Name: ${newUser.fullName}
- Designation: ${newUser.designation}
- Email: ${newUser.email}
- Requested Role: ${requestedRole}

Please sign in to the HOD Oversight Console under "Role Management & Approvals" to review and approve or reject this member's role assignment.

Department of Computing • Faculty of Applied Sciences
Rajarata University of Sri Lanka`;

    const contentHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h3 style="color: #991b1b; margin-top: 0;">New Staff Registration — Role Approval Required</h3>
        <p>Dear <strong>${hodUser.fullName}</strong> (HOD),</p>
        <p>A new academic staff member has registered on the system:</p>
        <ul style="background: #f8fafc; padding: 15px 25px; border-radius: 8px; font-size: 13px;">
          <li><strong>Name:</strong> ${newUser.fullName}</li>
          <li><strong>Designation:</strong> ${newUser.designation}</li>
          <li><strong>Email:</strong> ${newUser.email}</li>
          <li><strong>Requested Role:</strong> <span style="color: #b91c1c; font-weight: bold;">${requestedRole}</span></li>
        </ul>
        <p>Please log in to the <strong>Role Management & Approvals</strong> dashboard to grant or modify their operational access.</p>
      </div>
    `;

    return this.sendEmail({
      recipientUserId: hodUser.id,
      recipientEmail: hodUser.email,
      recipientName: hodUser.fullName,
      subject,
      templateKey: 'NEW_STAFF_REGISTRATION_HOD_ALERT',
      contentHtml,
      contentText,
    });
  }

  /**
   * 12. Role Request Approved Notice to User.
   */
  static async sendRoleApprovedNotice(params: {
    user: { id: number; fullName: string; email: string };
    roleName: string;
    hodName: string;
  }) {
    const { user, roleName, hodName } = params;
    const subject = `[Role Approved] Your Role (${roleName}) Has Been Activated`;

    const contentText = `Dear ${user.fullName},

Your requested role assignment for "${roleName}" on the RUSL Examination Results Monitoring System has been officially APPROVED and activated by the Head of Department (${hodName}).

You can now access your authorized departmental workspace and examination operations.

Department of Computing
Faculty of Applied Sciences, Rajarata University of Sri Lanka`;

    const contentHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h3 style="color: #047857; margin-top: 0;">Role Assignment Approved</h3>
        <p>Dear <strong>${user.fullName}</strong>,</p>
        <p>Your role authorization as <strong>${roleName}</strong> has been confirmed and activated by Head of Department <strong>${hodName}</strong>.</p>
        <p>Please sign in to access your authorized workspaces and workflows.</p>
      </div>
    `;

    return this.sendEmail({
      recipientUserId: user.id,
      recipientEmail: user.email,
      recipientName: user.fullName,
      subject,
      templateKey: 'ROLE_APPROVED_NOTICE',
      contentHtml,
      contentText,
    });
  }

  /**
   * 13. Clerk Submitted Role Request Alert to HOD.
   */
  static async sendClerkRoleRequestAlertToHod(params: {
    clerkName: string;
    targetUserName: string;
    roleName: string;
    action: string;
    hodUser: { id: number; fullName: string; email: string };
    reason?: string;
  }) {
    const { clerkName, targetUserName, roleName, action, hodUser, reason } = params;
    const subject = `[Role Approval Required] Clerk Proposed ${action} Role: ${targetUserName} (${roleName})`;

    const contentText = `Dear Dr. ${hodUser.fullName} (Head of Department),

Department Clerk ${clerkName} has submitted a role change proposal:

- Target Staff: ${targetUserName}
- Proposed Action: ${action} role "${roleName}"
- Justification: ${reason || 'Departmental examiner assignment adjustment'}

Please review this request in the HOD Role Management Console to approve or decline.

Department of Computing • Faculty of Applied Sciences
Rajarata University of Sri Lanka`;

    const contentHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h3 style="color: #b45309; margin-top: 0;">Clerk Role Modification Proposal</h3>
        <p>Dear <strong>${hodUser.fullName}</strong> (HOD),</p>
        <p>HOD Clerk <strong>${clerkName}</strong> submitted a role modification:</p>
        <ul style="background: #fffbeb; padding: 12px 24px; border-radius: 8px; font-size: 13px;">
          <li><strong>Staff Member:</strong> ${targetUserName}</li>
          <li><strong>Action:</strong> ${action}</li>
          <li><strong>Role:</strong> ${roleName}</li>
          ${reason ? `<li><strong>Reason:</strong> ${reason}</li>` : ''}
        </ul>
        <p>Please review and confirm approval in your HOD Oversight console.</p>
      </div>
    `;

    return this.sendEmail({
      recipientUserId: hodUser.id,
      recipientEmail: hodUser.email,
      recipientName: hodUser.fullName,
      subject,
      templateKey: 'CLERK_ROLE_REQUEST_HOD_ALERT',
      contentHtml,
      contentText,
    });
  }
}
