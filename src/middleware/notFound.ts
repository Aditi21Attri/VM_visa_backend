import { Request, Response } from 'express';
import { ApiResponse } from '../types';

export const notFound = (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: false,
    error: `Not found - ${req.originalUrl}`
  };
  res.status(404).json(response);
};
