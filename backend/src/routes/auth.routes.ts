import { Router } from 'express';
import { validate, validateBody } from '../middleware/validation.middleware.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { z } from 'zod';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1)
  })
});

const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1)
  })
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email()
  })
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    newPassword: z.string().min(8)
  })
});

// Public routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

// Protected routes
router.get('/profile', verifyToken, authController.getProfile);
router.post('/logout', verifyToken, authController.logout);

export default router;