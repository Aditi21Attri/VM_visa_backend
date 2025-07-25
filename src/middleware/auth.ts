import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { ApiResponse } from '../types';

interface AuthenticatedRequest extends Request {
  user?: any;
  headers: any;
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
      error: 'Authentication required. Please log in.'
    };
    return res.status(401).json(response);
  }

  try {
    // Verify token with detailed error logging
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      console.log('Auth middleware - Token decoded, user ID:', decoded.id);
    } catch (tokenError: any) {
      console.error('Auth middleware - Token verification error:', tokenError.name, tokenError.message);
      
      // Provide specific error messages
      if (tokenError.name === 'TokenExpiredError') {
        const response: ApiResponse = {
          success: false,
          error: 'Your session has expired. Please log in again.'
        };
        return res.status(401).json(response);
      } else if (tokenError.name === 'JsonWebTokenError') {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid authentication token. Please log in again.'
        };
        return res.status(401).json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          error: 'Authentication failed. Please log in again.'
        };
        return res.status(401).json(response);
      }
    }

    // Get user from token
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.log('Auth middleware - User not found for ID:', decoded.id);
      const response: ApiResponse = {
        success: false,
        error: 'User account not found. Please log in again.'
      };
      return res.status(401).json(response);
    }

    if (!user.isActive) {
      console.log('Auth middleware - User account deactivated:', user.name);
      const response: ApiResponse = {
        success: false,
        error: 'Your account has been deactivated. Please contact support.'
      };
      return res.status(401).json(response);
    }

    console.log('Auth middleware - Success:', user.name, user.userType);
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware - Unexpected error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Authentication failed. Please log in again.'
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
