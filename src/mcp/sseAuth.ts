/**
 * SSE Authentication Middleware
 *
 * Handles token-based authentication for SSE connections
 */

import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../auth/tokenManager.js';
import { logger } from '../utils/logger.js';

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Middleware to authenticate MCP requests
 */
export function authenticateMCP(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for dashboard, health checks, and admin routes
  // (the dashboard has its own cookie-based session auth)
  if (
    req.path === '/' ||
    req.path === '/health' ||
    req.path.startsWith('/admin') ||
    req.path === '/get-models' ||
    req.path === '/augment/get-models'
  ) {
    next();
    return;
  }

  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
    });
    return;
  }

  const verification = verifyToken(token);

  if (!verification.valid) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
    return;
  }

  // Attach user info to request
  (req as any).auth = {
    userId: verification.userId,
    tokenId: verification.tokenId,
  };

  next();
}

/**
 * Middleware to require authentication (throws if not authenticated)
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = (req as any).auth;

  if (!auth || !auth.userId) {
    logger.warn({ path: req.path }, 'Unauthenticated request to protected endpoint');
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  next();
}

/**
 * Get authenticated user from request
 */
export function getAuthUser(req: Request): { userId: string; tokenId: string } | null {
  const auth = (req as any).auth;

  if (!auth || !auth.userId) {
    return null;
  }

  return {
    userId: auth.userId,
    tokenId: auth.tokenId,
  };
}
