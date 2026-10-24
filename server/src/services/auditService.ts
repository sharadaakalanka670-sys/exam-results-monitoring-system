import { execute } from '../config/db';

export interface AuditLogParams {
  userId?: number | null;
  examScheduleId?: number | null;
  action: string;
  result: 'SUCCESS' | 'FAILURE' | 'DENIED';
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any>;
}

export interface WorkflowEventParams {
  examScheduleId: number;
  actorUserId: number;
  eventType: string;
  fromStatus: string;
  toStatus: string;
  description: string;
  metadata?: Record<string, any>;
}

export class AuditService {
  /**
   * Append-only audit log entry.
   * Inserts raw audit trails into system_audit_log.
   */
  static async log(params: AuditLogParams): Promise<void> {
    try {
      await execute(
        `INSERT INTO system_audit_log 
          (user_id, exam_schedule_id, action, result, ip_address, user_agent, safe_metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          params.userId ?? null,
          params.examScheduleId ?? null,
          params.action,
          params.result,
          params.ipAddress ?? null,
          params.userAgent ?? null,
          params.metadata ? JSON.stringify(params.metadata) : null,
        ]
      );
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }

  /**
   * Records a formal workflow transition event.
   */
  static async logEvent(params: WorkflowEventParams): Promise<void> {
    try {
      await execute(
        `INSERT INTO workflow_events 
          (exam_schedule_id, actor_user_id, event_type, from_status, to_status, description, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          params.examScheduleId,
          params.actorUserId,
          params.eventType,
          params.fromStatus,
          params.toStatus,
          params.description,
          params.metadata ? JSON.stringify(params.metadata) : null,
        ]
      );
    } catch (err) {
      console.error('Failed to write workflow event:', err);
    }
  }

  /**
   * Creates an in-app notification for a user.
   */
  static async notify(
    recipientUserId: number,
    title: string,
    body: string,
    type: string = 'WORKFLOW_UPDATE',
    examScheduleId?: number | null
  ): Promise<void> {
    try {
      await execute(
        `INSERT INTO notifications 
          (recipient_user_id, title, body, type, exam_schedule_id)
         VALUES (?, ?, ?, ?, ?)`,
        [
          recipientUserId,
          title,
          body,
          type,
          examScheduleId ?? null,
        ]
      );
    } catch (err) {
      console.error('Failed to create notification:', err);
    }
  }
}
