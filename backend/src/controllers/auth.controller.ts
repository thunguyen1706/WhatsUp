import type { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service.js';

// Validation schemas
export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(2).max(100)
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string()
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email()
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string(),
    password: z.string().min(6)
  })
});

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.register(req.body);
      res.status(201).json({
        message: 'Registration successful',
        ...result
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Registration failed' 
      });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.login(req.body);
      res.json({
        message: 'Login successful',
        ...result
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Login failed' 
      });
    }
  }

  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.forgotPassword(req.body.email);
      res.json(result);
    } catch (error: any) {
      res.json({ message: 'If the email exists, a reset link has been sent' });
    }
  }

  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, password } = req.body;
      const result = await AuthService.resetPassword(token, password);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Password reset failed' 
      });
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.logout(req.user!.id);
      res.json(result);
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Logout failed' 
      });
    }
  }

  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const eventRoles = await AuthService.getUserEventRoles(req.user!.id);
      res.json({
        user: req.user,
        eventRoles
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to fetch profile' 
      });
    }
  }
}

export const register = AuthController.register;
export const login = AuthController.login;
export const forgotPassword = AuthController.forgotPassword;
export const resetPassword = AuthController.resetPassword;
export const logout = AuthController.logout;
export const getProfile = AuthController.getProfile;