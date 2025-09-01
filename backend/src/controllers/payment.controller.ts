import type { Request, Response } from 'express';
import { StripeService } from '../services/stripe.service.js';
import { AppError } from '../middleware/error.middleware.js';

export class PaymentController {
  /**
   * Create payment intent for tickets
   */
  static async createTicketIntent(req: Request, res: Response): Promise<void> {
    try {
      const { event_id, quantity, tier_type } = req.body;

      const result = await StripeService.createTicketPaymentIntent(
        req.user!.id,
        event_id,
        quantity,
        tier_type
      );

      res.json({
        message: 'Payment intent created successfully',
        ...result
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to create payment intent' 
      });
    }
  }

  /**
   * Create payment intent for sponsorship
   */
  static async createSponsorshipIntent(req: Request, res: Response): Promise<void> {
    try {
      const { event_id, amount, message } = req.body;

      const result = await StripeService.createSponsorshipPaymentIntent(
        req.user!.id,
        event_id,
        amount,
        message
      );

      res.json({
        message: 'Sponsorship payment intent created successfully',
        ...result
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to create payment intent' 
      });
    }
  }

  /**
   * Cancel a payment
   */
  static async cancelPayment(req: Request, res: Response): Promise<void> {
    try {
      const { payment_intent_id } = req.body;

      await StripeService.cancelPaymentIntent(payment_intent_id);

      res.json({
        message: 'Payment cancelled successfully',
        paymentIntentId: payment_intent_id
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to cancel payment' 
      });
    }
  }

  /**
   * Refund a payment (full or partial)
   */
  static async refundPayment(req: Request, res: Response): Promise<void> {
    try {
      const { payment_intent_id, amount, reason } = req.body;

      const refund = await StripeService.refundPayment(
        payment_intent_id,
        amount,
        reason
      );

      if (!refund) {
        res.status(400).json({ error: 'Unable to process refund - no charge found' });
        return;
      }

      res.json({
        message: amount ? 'Partial refund processed successfully' : 'Full refund processed successfully',
        refund: {
          id: refund.id,
          amount: refund.amount,
          status: refund.status,
          reason: refund.reason,
          created: refund.created
        }
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to process refund' 
      });
    }
  }

  /**
   * Get refund status
   */
  static async getRefundStatus(req: Request, res: Response): Promise<void> {
    try {
      const { refundId } = req.params;

      if (!refundId) {
        res.status(400).json({ error: 'Refund ID is required' });
        return;
      }

      const refund = await StripeService.getRefundStatus(refundId);

      res.json({
        refund: {
          id: refund.id,
          amount: refund.amount,
          status: refund.status,
          reason: refund.reason,
          created: refund.created,
          payment_intent: refund.payment_intent
        }
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to get refund status' 
      });
    }
  }

  /**
   * List all refunds for a payment
   */
  static async listRefunds(req: Request, res: Response): Promise<void> {
    try {
      const { paymentIntentId } = req.params;

      if (!paymentIntentId) {
        res.status(400).json({ error: 'Payment Intent ID is required' });
        return;
      }

      const refunds = await StripeService.listRefunds(paymentIntentId);

      res.json({
        refunds: refunds.map((refund: any) => ({
          id: refund.id,
          amount: refund.amount,
          status: refund.status,
          reason: refund.reason,
          created: refund.created
        })),
        total: refunds.length
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to list refunds' 
      });
    }
  }

  /**
   * Handle Stripe webhook
   */
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'] as string;
      
      if (!signature) {
        throw new AppError('No Stripe signature found', 400);
      }

      const result = await StripeService.handleWebhook(signature, req.body);
      
      res.json(result);
    } catch (error: any) {
      console.error('Webhook error:', error);
      res.status(error.statusCode || 400).json({ 
        error: error.message || 'Webhook processing failed' 
      });
    }
  }

  /**
   * Create Stripe Connect account for organizers
   */
  static async createConnectAccount(req: Request, res: Response): Promise<void> {
    try {
      const result = await StripeService.createConnectAccount(
        req.user!.id,
        req.user!.email
      );

      res.json({
        message: 'Stripe Connect account created successfully',
        ...result
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to create Connect account' 
      });
    }
  }

  /**
   * Transfer funds to organizer
   */
  static async transferFunds(req: Request, res: Response): Promise<void> {
    try {
      const { event_id, amount } = req.body;

      const transfer = await StripeService.transferToOrganizer(event_id, amount);

      res.json({
        message: 'Funds transferred successfully',
        transfer: {
          id: transfer.id,
          amount: transfer.amount,
          currency: transfer.currency,
          destination: transfer.destination
        }
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({ 
        error: error.message || 'Failed to transfer funds' 
      });
    }
  }
}