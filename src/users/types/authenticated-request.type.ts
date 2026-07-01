import type { Request } from 'express';
import type { JwtUser } from '../../auth/types/jwt-user.type';

export type AuthenticatedRequest = Request & {
  user: JwtUser;
};
