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

  console.log('Auth middleware - Token present:', !!token);

  // Make sure token exists
  if (!token) {
    console.log('Auth middleware - No token provided');
    const response: ApiResponse = {
      success: false,
      error: 'Not authorized to access this route'
    };
    return res.status(401).json(response);
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    console.log('Auth middleware - Token decoded, user ID:', decoded.id);

    // Get user from token
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.log('Auth middleware - User not found for ID:', decoded.id);
      const response: ApiResponse = {
        success: false,
        error: 'User not found'
      };
      return res.status(401).json(response);
    }

    if (!user.isActive) {
      console.log('Auth middleware - User account deactivated:', user.name);
      const response: ApiResponse = {
        success: false,
        error: 'User account is deactivated'
      };
      return res.status(401).json(response);
    }

    console.log('Auth middleware - Success:', user.name, user.userType);
    req.user = user;
    next();
  } catch (error) {
    console.log('Auth middleware - Token verification failed:', error);
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
    console.log('Authorize middleware - Required roles:', roles);
    console.log('Authorize middleware - User type:', req.user?.userType);
    
    if (!req.user) {
      console.log('Authorize middleware - No user found');
      const response: ApiResponse = {
        success: false,
        error: 'User not authenticated'
      };
      return res.status(401).json(response);
    }

    if (!roles.includes(req.user.userType)) {
      console.log('Authorize middleware - Access denied for user type:', req.user.userType);
      const response: ApiResponse = {
        success: false,
        error: `User role ${req.user.userType} is not authorized to access this route`
      };
      return res.status(403).json(response);
    }

    console.log('Authorize middleware - Access granted');
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
