import argon2 from 'argon2';
import jwt, { type Secret } from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../db.js';
import { AppError } from '../middleware/error.middleware.js';
import { NotificationService } from './notification.service.js';

export interface UserRegistrationData {
  email: string;
  password: string;
  name: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export class AuthService {
  /**
   * Register a new user - NO GLOBAL ROLE
   */
  static async register(data: UserRegistrationData) {
    const { email, password, name } = data;

    // Check if user exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      throw new AppError('Email already registered', 400);
    }

    // Hash password
    const passwordHash = await argon2.hash(password);

    // Create user - NO ROLE FIELD
    const result = await query(
      `INSERT INTO users (email, name, password_hash) 
       VALUES ($1, $2, $3) 
       RETURNING id, email, name, created_at`,
      [email.toLowerCase(), name, passwordHash]
    );

    const user = result.rows[0];

    // Generate JWT
    const token = this.generateToken(user);

    // Send welcome email
    // await NotificationService.sendWelcomeEmail(user.email, user.name);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      token
    };
  }

  /**
   * Login user
   */
  static async login(credentials: LoginCredentials) {
    const { email, password } = credentials;

    // Find user
    const result = await query(
      'SELECT id, email, name, password_hash, email_verified FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid credentials', 401);
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await argon2.verify(user.password_hash, password);
    if (!validPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    // Generate JWT
    const token = this.generateToken(user);

    // Get user's event roles for context
    const eventRoles = await this.getUserEventRoles(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        email_verified: user.email_verified
      },
      eventRoles,
      token
    };
  }

  /**
   * Forgot password - send reset email
   */
  static async forgotPassword(email: string) {
    const user = await query(
      'SELECT id, name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (user.rows.length === 0) {
      // Don't reveal if email exists
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    // Store reset token
    await query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, resetTokenExpires, user.rows[0].id]
    );

    // Send reset email
    await NotificationService.sendPasswordResetEmail(
      email,
      user.rows[0].name,
      resetToken
    );

    return { message: 'Password reset email sent' };
  }

  /**
   * Reset password with token
   */
  static async resetPassword(token: string, newPassword: string) {
    // Find user with valid token
    const user = await query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );

    if (user.rows.length === 0) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    // Hash new password
    const passwordHash = await argon2.hash(newPassword);

    // Update password and clear reset token
    await query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [passwordHash, user.rows[0].id]
    );

    return { message: 'Password reset successful' };
  }

  /**
   * Logout (client-side token removal, but we can track it)
   */
  static async logout(userId: string) {
    // Could blacklist token or track logout time
    // For now, just return success
    return { message: 'Logged out successfully' };
  }

  /**
   * Get user's event roles
   */
  static async getUserEventRoles(userId: string) {
    const roles = await query(`
      SELECT 
        er.event_id,
        er.role,
        er.permissions,
        e.title as event_title,
        e.status as event_status
      FROM event_roles er
      JOIN events e ON er.event_id = e.id
      WHERE er.user_id = $1
      ORDER BY er.joined_at DESC
    `, [userId]);

    return roles.rows;
  }

  /**
   * Generate JWT token - NO ROLE IN TOKEN
   */
  private static generateToken(user: any): string {
    const secret = (process.env.JWT_SECRET ?? '') as Secret;
    const envExp = process.env.JWT_EXPIRES_IN;
    const expiresIn = Number.isFinite(Number(envExp)) ? Number(envExp) : 60 * 60 * 24 * 7; // seconds
    
    return jwt.sign(
      { 
        id: user.id, 
        email: user.email
        // No role field!
      },
      secret,
      { expiresIn }
    );
  }

  /**
   * Verify JWT token
   */
  static async verifyToken(token: string) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET! as Secret) as any;
      
      // Check if user still exists
      const user = await query(
        'SELECT id, email, name FROM users WHERE id = $1',
        [decoded.id]
      );

      if (user.rows.length === 0) {
        throw new AppError('User not found', 401);
      }

      return user.rows[0];
    } catch (error: any) {
      if (error?.name === 'TokenExpiredError') {
        throw new AppError('Token expired', 401);
      } else if (error?.name === 'JsonWebTokenError') {
        throw new AppError('Invalid token', 401);
      }
      throw error;
    }
  }
}