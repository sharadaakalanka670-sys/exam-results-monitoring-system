import { RoleName } from './enums';

export interface AuthenticatedUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  roles: RoleName[];
  staffDirectoryId?: number | null;
  examinerProfileId?: number | null;
  seniorityLevel?: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
