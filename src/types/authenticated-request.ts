import { Request } from 'express';
import { JWTPayload } from './index.js';

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  startTime?: number;
} 