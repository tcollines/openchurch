import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayloadClaims {
  sub: string;
  tenantId: string | null;
  role: string;
  email: string;
}

export interface TenantRequest extends Request {
  userId?: string;
  tenantId?: string | null;
  userRole?: string;
}

const getJwtSecret = (): string => {
  return process.env.JWT_SECRET || 'open-church-dev-jwt-secret-change-in-production';
};

export const signAuthToken = (claims: JwtPayloadClaims): string => {
  return jwt.sign(claims, getJwtSecret(), { expiresIn: '7d' });
};

export const requireTenantAuth = (
  req: TenantRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization Bearer token' });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayloadClaims;
    req.userId = decoded.sub;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;

    if (!req.tenantId && req.userRole !== 'PLATFORM_ADMIN') {
      res.status(403).json({ error: 'User is not bound to an active church tenant' });
      return;
    }

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session token' });
  }
};

export const resolveTargetTenantId = (req: TenantRequest): string | null => {
  if (req.userRole === 'PLATFORM_ADMIN') {
    return (
      (req.query.tenantId as string | undefined) ||
      (req.body?.tenantId as string | undefined) ||
      req.tenantId ||
      null
    );
  }
  return req.tenantId ?? null;
};
