import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import { ZodError } from 'zod';

export const validate = (schema: ZodType) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        res.status(400).json({ 
          error: 'Validation failed', 
          details: errors 
        });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
};

export const validateBody = (schema: ZodType) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        res.status(400).json({ 
          error: 'Validation failed', 
          details: errors 
        });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
};