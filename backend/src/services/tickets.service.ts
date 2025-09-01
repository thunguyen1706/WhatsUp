import { query } from '../db.js';
import { AppError } from '../middleware/error.middleware.js';
import { EventRolesService } from './eventRoles.service.js';
import { EventsService } from './events.service.js';

export class TicketsService {
  /**
   * Purchase ticket for an event
   */
  static async purchaseTicket(
    userId: string, 
    eventId: string, 
    quantity: number = 1
  ) {
    // Check if event exists and is published
    const event = await query(
      'SELECT * FROM events WHERE id = $1 AND status = $2',
      [eventId, 'PUBLISHED']
    );

    if (event.rows.length === 0) {
      throw new AppError('Event not found or not available for ticket purchase', 404);
    }

    const eventData = event.rows[0];

    // Check if event has capacity limits
    if (eventData.capacity) {
      const currentTickets = await query(
        'SELECT SUM(quantity) as total FROM tickets WHERE event_id = $1 AND status = $2',
        [eventId, 'CONFIRMED']
      );

      const totalSold = parseInt(currentTickets.rows[0].total || 0);
      if (totalSold + quantity > eventData.capacity) {
        throw new AppError('Not enough tickets available', 400);
      }
    }

    // Check if user already has tickets for this event
    const existingTicket = await query(
      'SELECT * FROM tickets WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );

    if (existingTicket.rows.length > 0) {
      throw new AppError('You already have tickets for this event', 400);
    }

    // Create ticket record
    const ticket = await query(`
      INSERT INTO tickets (
        event_id, user_id, quantity, price_cents, status
      ) VALUES ($1, $2, $3, $4, 'PENDING')
      RETURNING *
    `, [eventId, userId, quantity, eventData.price_cents * quantity]);

    // In a real implementation, you would create a payment intent here
    // For now, we'll simulate immediate confirmation for free events
    if (eventData.price_cents === 0) {
      await this.confirmTicket(ticket.rows[0].id);
      const confirmedTicket = await query('SELECT * FROM tickets WHERE id = $1', [ticket.rows[0].id]);
      return { ticket: confirmedTicket.rows[0] };
    }

    return { 
      ticket: ticket.rows[0],
      // clientSecret: paymentIntent.client_secret // Would be set with real payment
    };
  }

  /**
   * Confirm ticket purchase (webhook handler)
   */
  static async confirmTicket(ticketId: string) {
    const result = await query(
      'UPDATE tickets SET status = $1, purchased_at = NOW() WHERE id = $2 RETURNING *',
      ['CONFIRMED', ticketId]
    );

    if (result.rows.length > 0) {
      const ticket = result.rows[0];
      
      // Add user as attendee role
      await EventRolesService.assignEventRole(ticket.event_id, ticket.user_id, 'ATTENDEE');
      
      // Record interaction
      await EventsService.recordInteraction(
        ticket.event_id, 
        ticket.user_id, 
        'purchase',
        { quantity: ticket.quantity, amount: ticket.price_cents }
      );
    }

    return result.rows[0];
  }

  /**
   * Get user's tickets
   */
  static async getUserTickets(userId: string) {
    const result = await query(`
      SELECT 
        t.*,
        e.title as event_title,
        e.starts_at as event_date,
        e.location_name,
        e.location_address
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.user_id = $1
      ORDER BY e.starts_at ASC
    `, [userId]);

    return result.rows;
  }

  /**
   * Get event ticket sales (organizers only)
   */
  static async getEventTicketSales(eventId: string, userId: string) {
    // Check if user is organizer
    const isOrganizer = await EventRolesService.hasEventRole(userId, eventId, ['ORGANIZER', 'CO_ORGANIZER']);
    if (!isOrganizer) {
      throw new AppError('Access denied', 403);
    }

    const tickets = await query(`
      SELECT 
        t.*,
        u.name as buyer_name,
        u.email as buyer_email
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE t.event_id = $1
      ORDER BY t.created_at DESC
    `, [eventId]);

    const stats = await query(`
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(*) FILTER (WHERE status = 'CONFIRMED') as confirmed_tickets,
        SUM(CASE WHEN status = 'CONFIRMED' THEN price_cents ELSE 0 END) as total_revenue,
        COUNT(DISTINCT user_id) FILTER (WHERE status = 'CONFIRMED') as unique_buyers
      FROM tickets
      WHERE event_id = $1
    `, [eventId]);

    return {
      tickets: tickets.rows,
      stats: {
        ...stats.rows[0],
        total_tickets: parseInt(stats.rows[0].total_tickets || 0),
        confirmed_tickets: parseInt(stats.rows[0].confirmed_tickets || 0),
        total_revenue: parseInt(stats.rows[0].total_revenue || 0),
        unique_buyers: parseInt(stats.rows[0].unique_buyers || 0)
      }
    };
  }

  /**
   * Cancel ticket (with refund logic)
   */
  static async cancelTicket(ticketId: string, userId: string) {
    const ticket = await query(
      'SELECT * FROM tickets WHERE id = $1 AND user_id = $2',
      [ticketId, userId]
    );

    if (ticket.rows.length === 0) {
      throw new AppError('Ticket not found', 404);
    }

    const ticketData = ticket.rows[0];

    // Check if event allows cancellations (you might add this field to events table)
    const event = await query('SELECT starts_at FROM events WHERE id = $1', [ticketData.event_id]);
    const eventStart = new Date(event.rows[0].starts_at);
    const now = new Date();
    const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilEvent < 24) {
      throw new AppError('Cannot cancel tickets less than 24 hours before event', 400);
    }

    // Update ticket status
    await query(
      'UPDATE tickets SET status = $1 WHERE id = $2',
      ['CANCELLED', ticketId]
    );

    // Remove attendee role if this was their only ticket
    const otherTickets = await query(
      'SELECT COUNT(*) FROM tickets WHERE user_id = $1 AND event_id = $2 AND status = $3 AND id != $4',
      [userId, ticketData.event_id, 'CONFIRMED', ticketId]
    );

    if (parseInt(otherTickets.rows[0].count) === 0) {
      await EventRolesService.removeEventRole(ticketData.event_id, userId, userId);
    }

    // Process refund if ticket was paid for
    if (ticketData.price_cents > 0 && ticketData.payment_intent_id) {
      // Implement refund logic here
      console.log(`Refund needed for ticket ${ticketId}, amount: ${ticketData.price_cents}`);
    }

    return { success: true };
  }
}