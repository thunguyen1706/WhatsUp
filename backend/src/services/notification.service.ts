import { query } from '../db.js';
import nodemailer from 'nodemailer';
import { cache } from '../redis.js';

export class NotificationService {
  private static transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false // This fixes the self-signed certificate error
    }
  });

  /**
   * Send email notification
   */
  static async sendEmail(to: string, subject: string, html: string) {
    try {
      console.log('📧 Attempting to send email to:', to);
      console.log('📧 SMTP Config:', {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        from: process.env.SMTP_FROM
      });
      
      const result = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@eventapp.com',
        to,
        subject,
        html
      });
      
      console.log('✅ Email sent successfully:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Email send error:', error);
      throw error; // Re-throw so the calling code knows it failed
    }
  }

  /**
   * Send ticket purchase confirmation
   */
  static async sendTicketConfirmation(userId: string, ticketId: string) {
    const ticket = await query(`
      SELECT 
        t.*,
        e.title as event_title,
        e.starts_at,
        e.location_name,
        e.location_address,
        u.email,
        u.name
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      JOIN users u ON t.user_id = u.id
      WHERE t.id = $1
    `, [ticketId]);

    if (ticket.rows.length === 0) return;

    const data = ticket.rows[0];
    const html = `
      <h2>Ticket Confirmation</h2>
      <p>Hi ${data.name},</p>
      <p>Your ticket purchase for <strong>${data.event_title}</strong> has been confirmed!</p>
      <ul>
        <li>Event Date: ${new Date(data.starts_at).toLocaleDateString()}</li>
        <li>Location: ${data.location_name}</li>
        <li>Address: ${data.location_address}</li>
        <li>Quantity: ${data.quantity}</li>
        <li>Total Paid: ${(data.price_cents / 100).toFixed(2)}</li>
      </ul>
      <p>Your ticket ID: <code>${ticketId}</code></p>
    `;

    await this.sendEmail(data.email, 'Ticket Confirmation', html);
  }

  /**
   * Send event recommendations based on LTR
   */
  static async sendRecommendationEmail(userId: string) {
    const user = await query('SELECT email, name FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) return;

    const { LearningToRankService } = await import('./ltr.service.js');
    const recommendations = await LearningToRankService.getTopRecommendationsForPurchase(userId, 5);

    if (recommendations.length === 0) return;

    const html = `
      <h2>Events We Think You'll Love</h2>
      <p>Hi ${user.rows[0].name},</p>
      <p>Based on your interests, here are some events we recommend:</p>
      <ul>
        ${recommendations.map(event => `
          <li>
            <strong>${event.title}</strong><br>
            ${new Date(event.starts_at).toLocaleDateString()}<br>
            ${event.location_name}<br>
            Purchase Probability: ${(event.purchase_probability * 100).toFixed(1)}%
          </li>
        `).join('')}
      </ul>
    `;

    await this.sendEmail(user.rows[0].email, 'Personalized Event Recommendations', html);
  }

  /**
   * Send trending events notification
   */
  static async sendTrendingEventsNotification(userId: string) {
    const user = await query('SELECT email, name FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) return;

    const { TrendingService } = await import('./trending.service.js');
    const trending = await TrendingService.getTrendingEvents(undefined, 5);

    if (trending.length === 0) return;

    const html = `
      <h2>Trending Events This Week</h2>
      <p>Hi ${user.rows[0].name},</p>
      <p>Don't miss out on these popular events:</p>
      <ul>
        ${trending.map(event => `
          <li>
            <strong>${event.title}</strong><br>
            ${new Date(event.starts_at).toLocaleDateString()}<br>
            ${event.tickets_sold || 0} tickets sold
          </li>
        `).join('')}
      </ul>
    `;

    await this.sendEmail(user.rows[0].email, 'Trending Events', html);
  }

  /**
   * Send push notification (webhook to mobile service)
   */
  static async sendPushNotification(userId: string, title: string, body: string, data?: any) {
    // Get user's push tokens
    const tokens = await query(
      'SELECT push_token FROM user_devices WHERE user_id = $1 AND push_enabled = true',
      [userId]
    );

    if (tokens.rows.length === 0) return;

    // In production, integrate with FCM, OneSignal, or Expo Push
    for (const { push_token } of tokens.rows) {
      // Example with Expo Push
      const message = {
        to: push_token,
        sound: 'default',
        title,
        body,
        data
      };

      // Send to push service
      console.log('Would send push:', message);
    }
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(email: string, name: string, resetToken: string) {
    // Use the correct route path that matches the demo reset
    const webUrl = process.env.FRONTEND_URL 
      ? `${process.env.FRONTEND_URL.replace(/\/$/, '')}/(auth)/reset-password?token=${resetToken}`
      : `http://localhost:8081/(auth)/reset-password?token=${resetToken}`;
    
    console.log('🔗 Reset URL generated:', webUrl);
    
    const html = `
      <h2>Password Reset Request</h2>
      <p>Hi ${name},</p>
      <p>You requested a password reset for your account.</p>
      <p>Click the button below to reset your password:</p>
      <a href="${webUrl}" style="display: inline-block; padding: 12px 24px; background-color: #FF7A00; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0;">
        Reset Password
      </a>
      <p><strong>For mobile app users:</strong></p>
      <p>If the button above doesn't work, copy and paste this link into your browser:</p>
      <p style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace;">
        ${webUrl}
      </p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this reset, please ignore this email.</p>
    `;

    await this.sendEmail(email, 'Password Reset Request', html);
  }
}