import { Request, Response, NextFunction } from 'express';
import { RoleName } from '../types/enums';
import { queryOne } from '../config/db';

/**
 * Middleware factory requiring that the authenticated user possesses at least one of the specified roles.
 */
export function requireRoles(...allowedRoles: RoleName[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    const hasRole = req.user.roles.some((role: RoleName) => allowedRoles.includes(role));
    if (!hasRole) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to enforce subject ownership:
 * Allows HOD, or the assigned First Examiner, or the assigned Second Examiner.
 */
export async function requireScheduleAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    return;
  }

  // HOD has universal administrative access
  if (req.user.roles.includes(RoleName.HOD)) {
    next();
    return;
  }

  const scheduleId = parseInt(req.params.id || req.params.scheduleId, 10);
  if (isNaN(scheduleId)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid schedule ID' });
    return;
  }

  const schedule = await queryOne<any>(
    `SELECT s.id, s.first_examiner_user_id AS firstExaminerUserId,
            ep.user_id AS secondExaminerUserId
     FROM exam_schedules s
     LEFT JOIN examiner_profiles ep ON s.second_examiner_profile_id = ep.id
     WHERE s.id = ?`,
    [scheduleId]
  );

  if (!schedule) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Exam schedule not found' });
    return;
  }

  const isFirstExaminer = schedule.firstExaminerUserId === req.user.id;
  const isSecondExaminer = schedule.secondExaminerUserId === req.user.id;

  if (isFirstExaminer || isSecondExaminer) {
    next();
    return;
  }

  // If role is AR_OFFICE or HOD_CLERK, check if they have route-level permission, else forbidden
  if (req.user.roles.includes(RoleName.AR_OFFICE) || req.user.roles.includes(RoleName.HOD_CLERK)) {
    next();
    return;
  }

  res.status(403).json({
    error: 'FORBIDDEN',
    message: 'You are not authorized to access or modify this schedule'
  });
}
