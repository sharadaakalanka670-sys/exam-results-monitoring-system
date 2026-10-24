import { Request, Response } from 'express';
import { query, queryOne } from '../config/db';

export class AuditController {
  static async listLogs(req: Request, res: Response): Promise<void> {
    try {
      const { search, limit = '50', offset = '0' } = req.query;

      const take = Math.max(1, parseInt(String(limit), 10) || 50);
      const skip = Math.max(0, parseInt(String(offset), 10) || 0);

      const conditions: string[] = [];
      const params: any[] = [];

      if (search) {
        const term = `%${String(search).trim()}%`;
        conditions.push('(l.action LIKE ? OR u.full_name LIKE ? OR l.result LIKE ?)');
        params.push(term, term, term);
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRow = await queryOne<{ total: number }>(
        `SELECT COUNT(*) AS total
         FROM system_audit_log l
         LEFT JOIN users u ON l.user_id = u.id
         ${whereSql}`,
        params
      );

      const total = countRow?.total || 0;

      const queryParams = [...params, take, skip];
      const rows = await query<any>(
        `SELECT l.id, l.timestamp, l.user_id AS userId, l.exam_schedule_id AS examScheduleId,
                l.action, l.result, l.ip_address AS ipAddress, l.user_agent AS userAgent,
                l.safe_metadata_json AS safeMetadataJson,
                u.id AS u_id, u.full_name AS u_fullName, u.username AS u_username, u.designation AS u_designation,
                s.id AS s_id, c.course_code AS s_courseCode
         FROM system_audit_log l
         LEFT JOIN users u ON l.user_id = u.id
         LEFT JOIN exam_schedules s ON l.exam_schedule_id = s.id
         LEFT JOIN course_offerings co ON s.course_offering_id = co.id
         LEFT JOIN courses c ON co.course_id = c.id
         ${whereSql}
         ORDER BY l.timestamp DESC
         LIMIT ? OFFSET ?`,
        queryParams
      );

      const logs = rows.map((r: any) => ({
        id: r.id,
        timestamp: r.timestamp,
        userId: r.userId,
        examScheduleId: r.examScheduleId,
        action: r.action,
        result: r.result,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        safeMetadataJson: r.safeMetadataJson,
        user: r.u_id
          ? {
              id: r.u_id,
              fullName: r.u_fullName,
              username: r.u_username,
              designation: r.u_designation,
            }
          : null,
        examSchedule: r.s_id
          ? {
              id: r.s_id,
              courseOffering: {
                course: {
                  courseCode: r.s_courseCode || '',
                }
              }
            }
          : null,
      }));

      res.json({ logs, total, limit: take, offset: skip });
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }
}
