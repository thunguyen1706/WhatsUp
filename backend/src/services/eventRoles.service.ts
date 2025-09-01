import { query } from '../db.js';
import { AppError } from '../middleware/error.middleware.js';

export class EventRolesService {
  /**
   * Check if user has specific role for an event
   */
  static async hasEventRole(userId: string, eventId: string, roles: string[]): Promise<boolean> {
    const result = await query(
      'SELECT role FROM event_roles WHERE user_id = $1 AND event_id = $2 AND role = ANY($3)',
      [userId, eventId, roles]
    );
    return result.rows.length > 0;
  }

  /**
   * Get user's role for an event
   */
  static async getUserEventRole(userId: string, eventId: string) {
    const result = await query(
      'SELECT role, permissions FROM event_roles WHERE user_id = $1 AND event_id = $2',
      [userId, eventId]
    );
    return result.rows[0] || null;
  }

  /**
   * Assign role to user for an event
   */
  static async assignEventRole(eventId: string, userId: string, role: string, assignedBy?: string) {
    // Check if assigner has permission (must be organizer)
    if (assignedBy) {
      const canAssign = await this.hasEventRole(assignedBy, eventId, ['ORGANIZER']);
      if (!canAssign) {
        throw new AppError('Only organizers can assign roles', 403);
      }
    }

    // Assign the role
    const result = await query(
      `INSERT INTO event_roles (event_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id, user_id, role) DO UPDATE
       SET role = EXCLUDED.role
       RETURNING *`,
      [eventId, userId, role]
    );

    return result.rows[0];
  }

  /**
   * Remove user's role from event
   */
  static async removeEventRole(eventId: string, userId: string, removedBy: string) {
    // Check if remover has permission
    const canRemove = await this.hasEventRole(removedBy, eventId, ['ORGANIZER']);
    if (!canRemove) {
      throw new AppError('Only organizers can remove roles', 403);
    }

    // Can't remove the last organizer
    const organizers = await query(
      'SELECT COUNT(*) FROM event_roles WHERE event_id = $1 AND role = $2',
      [eventId, 'ORGANIZER']
    );

    if (organizers.rows[0].count === 1) {
      const isLastOrganizer = await this.hasEventRole(userId, eventId, ['ORGANIZER']);
      if (isLastOrganizer) {
        throw new AppError('Cannot remove the last organizer', 400);
      }
    }

    await query(
      'DELETE FROM event_roles WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );

    return { success: true };
  }

  /**
   * Get all users with roles for an event
   */
  static async getEventParticipants(eventId: string, requesterId: string) {
    // Check if requester has access
    const hasAccess = await this.hasEventRole(requesterId, eventId, ['ORGANIZER', 'CO_ORGANIZER']);
    if (!hasAccess) {
      throw new AppError('Access denied', 403);
    }

    const result = await query(`
      SELECT 
        er.role,
        er.joined_at,
        er.permissions,
        u.id as user_id,
        u.name,
        u.email
      FROM event_roles er
      JOIN users u ON er.user_id = u.id
      WHERE er.event_id = $1
      ORDER BY 
        CASE er.role 
          WHEN 'ORGANIZER' THEN 1
          WHEN 'CO_ORGANIZER' THEN 2
          WHEN 'SPONSOR' THEN 3
          WHEN 'VOLUNTEER' THEN 4
          ELSE 5
        END,
        er.joined_at
    `, [eventId]);

    return result.rows;
  }
}