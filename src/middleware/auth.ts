import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { ApiResponse } from '../types';

interface AuthenticatedRequest extends Request {
  user?: any;
}

export const protect = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  let token: string | undefined;

  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    const response: ApiResponse = {
      success: false,
      error: 'Not authorized to access this route'
    };
    return res.status(401).json(response);
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

    // Get user from token
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not found'
      };
      return res.status(401).json(response);
    }

    if (!user.isActive) {
      const response: ApiResponse = {
        success: false,
        error: 'User account is deactivated'
      };
      return res.status(401).json(response);
    }

    req.user = user;
    next();
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: 'Not authorized to access this route'
    };
    return res.status(401).json(response);
  }
};

// Grant access to specific roles
export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): any => {
    if (!req.user) {
      const response: ApiResponse = {
        success: false,
        error: 'User not authenticated'
      };
      return res.status(401).json(response);
    }

    if (!roles.includes(req.user.userType)) {
      const response: ApiResponse = {
        success: false,
        error: `User role ${req.user.userType} is not authorized to access this route`
      };
      return res.status(403).json(response);
    }

    next();
  };
};

// Optional authentication - doesn't require token but adds user if present
export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      const user = await User.findById(decoded.id).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    } catch (error) {
      // Invalid token, but continue without user
    }
  }

  next();
};
