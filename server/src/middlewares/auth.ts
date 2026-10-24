import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { queryOne, query } from '../config/db';
import { AuthenticatedUser } from '../types/express';
import { RoleName } from '../types/enums';

export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    // Check Authorization header
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    const decoded = jwt.verify(token, ENV.JWT_SECRET) as { userId: number };
    
    // Fetch user and optional examiner profile
    const user = await queryOne<any>(
      `SELECT u.id, u.username, u.email, u.full_name AS fullName,
              u.staff_directory_id AS staffDirectoryId, u.is_active AS isActive,
              ep.id AS examinerProfileId, ep.seniority_level AS seniorityLevel
       FROM users u
       LEFT JOIN examiner_profiles ep ON ep.user_id = u.id
       WHERE u.id = ?`,
      [decoded.userId]
    );

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'User not found or inactive' });
      return;
    }

    // Fetch user's active role names
    const roleRows = await query<any>(
      `SELECT r.name 
       FROM user_roles ur
       INNER JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = ?`,
      [user.id]
    );

    const roles = roleRows.map((row: any) => row.name as RoleName);

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      roles,
      staffDirectoryId: user.staffDirectoryId,
      examinerProfileId: user.examinerProfileId || null,
      seniorityLevel: user.seniorityLevel || null
    };

    next();
  } catch (err) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }
}
