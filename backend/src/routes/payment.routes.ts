// src/routes/payment.routes.ts

import { Router } from 'express';
import express from 'express';
import { verifyToken, requireEventRole } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import { PaymentController } from '../controllers/payment.controller.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createTicketIntentSchema = z.object({
  event_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(10),
  tier_type: z.enum(['standard', 'vip', 'premium']).default('standard')
});

const createSponsorshipIntentSchema = z.object({
  event_id: z.string().uuid(),
  amount: z.number().min(1).max(100000),
  message: z.string().max(500).optional()
});

const cancelPaymentSchema = z.object({
  payment_intent_id: z.string()
});

const refundPaymentSchema = z.object({
  payment_intent_id: z.string(),
  amount: z.number().optional(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional()
});

// Create payment intents
router.post(
  '/create-ticket-intent',
  verifyToken,
  validateBody(createTicketIntentSchema),
  PaymentController.createTicketIntent
);

router.post(
  '/create-sponsorship-intent',
  verifyToken,
  validateBody(createSponsorshipIntentSchema),
  PaymentController.createSponsorshipIntent
);

// Cancel payment
router.post(
  '/cancel',
  verifyToken,
  validateBody(cancelPaymentSchema),
  PaymentController.cancelPayment
);

// Refund payment (full or partial)
router.post(
  '/refund',
  verifyToken,
  validateBody(refundPaymentSchema),
  PaymentController.refundPayment
);

// Get refund status
router.get(
  '/refund/:refundId',
  verifyToken,
  PaymentController.getRefundStatus
);

// List refunds for a payment
router.get(
  '/refunds/:paymentIntentId',
  verifyToken,
  PaymentController.listRefunds
);

// Stripe webhook (needs raw body - configured in main server)
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  PaymentController.handleWebhook
);

// Create Connect account for organizers
router.post(
  '/create-connect-account',
  verifyToken,
  PaymentController.createConnectAccount
);

// Transfer funds to organizer
router.post(
  '/transfer',
  verifyToken,
  PaymentController.transferFunds
);

export default router;