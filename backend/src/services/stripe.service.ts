import Stripe from 'stripe';
import { query } from '../db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

export class StripeService {
  /**
   * Create payment intent for ticket purchase
   */
  static async createTicketPaymentIntent(
    userId: string,
    eventId: string,
    quantity: number,
    tierType: 'standard' | 'vip' | 'premium' = 'standard'
  ) {
    // Get event details
    const event = await query(
      'SELECT * FROM events WHERE id = $1 AND status = $2',
      [eventId, 'PUBLISHED']
    );

    if (event.rows.length === 0) {
      throw new Error('Event not found');
    }

    const eventData = event.rows[0];
    
    // Calculate price based on tier
    const tierMultiplier = {
      standard: 1,
      vip: 1.5,
      premium: 2
    };
    
    const amount = Math.round(eventData.price_cents * tierMultiplier[tierType] * quantity);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: {
        user_id: userId,
        event_id: eventId,
        quantity: String(quantity),
        tier_type: tierType,
        type: 'ticket_purchase'
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Create pending ticket record
    await query(`
      INSERT INTO tickets (event_id, user_id, quantity, price_cents, status, payment_intent_id)
      VALUES ($1, $2, $3, $4, 'PENDING', $5)
      RETURNING id
    `, [eventId, userId, quantity, amount, paymentIntent.id]);

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount
    };
  }

  /**
   * Create payment intent for sponsorship/donation
   */
  static async createSponsorshipPaymentIntent(
    userId: string,
    eventId: string,
    amount: number,
    message?: string
  ) {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: 'usd',
      metadata: {
        user_id: userId,
        event_id: eventId,
        type: 'sponsorship',
        message: message || ''
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Create pending donation record
    await query(`
      INSERT INTO donations (event_id, user_id, amount_cents, message, status, payment_intent_id)
      VALUES ($1, $2, $3, $4, 'PENDING', $5)
    `, [eventId, userId, amount * 100, message, paymentIntent.id]);

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    };
  }

  /**
   * Handle webhook events from Stripe
   */
  static async handleWebhook(signature: string, payload: Buffer): Promise<any> {
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${err}`);
    }

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await this.handleRefund(event.data.object as Stripe.Charge);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  /**
   * Handle successful payment
   */
  private static async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
    const { user_id, event_id, type, quantity } = paymentIntent.metadata;

    if (type === 'ticket_purchase') {
      // Update ticket status
      await query(`
        UPDATE tickets 
        SET status = 'CONFIRMED', purchased_at = NOW()
        WHERE payment_intent_id = $1
      `, [paymentIntent.id]);

      // Track interaction for LTR
      await query(`
        INSERT INTO interactions (user_id, event_id, action, metadata)
        VALUES ($1, $2, 'purchase', $3)
      `, [user_id, event_id, JSON.stringify({ quantity, amount: paymentIntent.amount })]);

      // Update recommendation features
      await query(`
        UPDATE recommendation_features
        SET relevance_label = 2
        WHERE user_id = $1 AND event_id = $2 AND query_day = CURRENT_DATE
      `, [user_id, event_id]);

      // Track in Redis for trending
      if (event_id && quantity) {
        const { TrendingService } = await import('./trending.service.js');
        await TrendingService.trackInteraction(event_id, 'purchase', parseInt(quantity));
      }

    } else if (type === 'sponsorship') {
      // Update donation status
      await query(`
        UPDATE donations 
        SET status = 'CONFIRMED'
        WHERE payment_intent_id = $1
      `, [paymentIntent.id]);
    }
  }

  /**
   * Handle failed payment
   */
  private static async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
    const { type } = paymentIntent.metadata;

    if (type === 'ticket_purchase') {
      await query(`
        UPDATE tickets 
        SET status = 'CANCELLED'
        WHERE payment_intent_id = $1
      `, [paymentIntent.id]);
    } else if (type === 'sponsorship') {
      await query(`
        UPDATE donations 
        SET status = 'CANCELLED'
        WHERE payment_intent_id = $1
      `, [paymentIntent.id]);
    }
  }

  /**
   * Handle refund
   */
  private static async handleRefund(charge: Stripe.Charge) {
    const paymentIntentId = charge.payment_intent as string;

    // Update ticket status
    await query(`
      UPDATE tickets 
      SET status = 'REFUNDED'
      WHERE payment_intent_id = $1
    `, [paymentIntentId]);

    // Could also update donations if needed
  }

  /**
   * Cancel payment intent
   */
  static async cancelPaymentIntent(paymentIntentId: string) {
    try {
      await stripe.paymentIntents.cancel(paymentIntentId);
    } catch (error) {
      console.error('Error cancelling payment intent:', error);
      // Don't throw error as the intent might already be cancelled
    }
  }

  /**
   * Refund payment
   */
  static async refundPayment(paymentIntentId: string, amount?: number, reason?: string) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.latest_charge) {
        const refundData: any = {
          charge: paymentIntent.latest_charge as string,
        };
        
        if (amount) {
          refundData.amount = amount;
        }
        
        if (reason) {
          refundData.reason = reason;
        }
        
        const refund = await stripe.refunds.create(refundData);
        return refund;
      }
    } catch (error) {
      console.error('Error refunding payment:', error);
      throw error;
    }
  }

  /**
   * Get refund status
   */
  static async getRefundStatus(refundId: string) {
    try {
      return await stripe.refunds.retrieve(refundId);
    } catch (error) {
      console.error('Error getting refund status:', error);
      throw error;
    }
  }

  /**
   * List refunds for a payment intent
   */
  static async listRefunds(paymentIntentId: string) {
    try {
      const refunds = await stripe.refunds.list({
        payment_intent: paymentIntentId
      });
      return refunds.data;
    } catch (error) {
      console.error('Error listing refunds:', error);
      throw error;
    }
  }

  /**
   * Transfer funds to organizer
   */
  static async transferToOrganizer(eventId: string, amount: number) {
    try {
      // Get organizer's Stripe account ID
      const event = await query(
        'SELECT e.organizer_id, u.stripe_account_id FROM events e JOIN users u ON e.organizer_id = u.id WHERE e.id = $1',
        [eventId]
      );

      if (event.rows.length === 0) {
        throw new Error('Event not found');
      }

      const stripeAccountId = event.rows[0].stripe_account_id;
      if (!stripeAccountId) {
        throw new Error('Organizer has no Stripe account');
      }

      // Create transfer
      const transfer = await stripe.transfers.create({
        amount: amount * 100, // Convert to cents
        currency: 'usd',
        destination: stripeAccountId,
        metadata: {
          event_id: eventId,
          organizer_id: event.rows[0].organizer_id
        }
      });

      return transfer;
    } catch (error) {
      console.error('Error transferring funds:', error);
      throw error;
    }
  }

  /**
   * Create Stripe Connect account for organizers
   */
  static async createConnectAccount(organizerId: string, email: string) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        organizer_id: organizerId
      }
    });

    // Store account ID
    await query(`
      UPDATE users 
      SET stripe_account_id = $1
      WHERE id = $2
    `, [account.id, organizerId]);

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL}/stripe/reauth`,
      return_url: `${process.env.FRONTEND_URL}/stripe/return`,
      type: 'account_onboarding',
    });

    return {
      accountId: account.id,
      onboardingUrl: accountLink.url
    };
  }
}