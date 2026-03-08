import Joi from 'joi';

export const creditWalletSchema = Joi.object({
  amount: Joi.number().positive().required(),
  type: Joi.string().valid('advance', 'balance', 'adjustment').required(),
  booking: Joi.string().hex().length(24).optional(),
  bookingRef: Joi.string().max(100).optional(),
  note: Joi.string().max(500).optional(),
});

export const requestPayoutSchema = Joi.object({
  amount: Joi.number().positive().required(),
  note: Joi.string().max(500).optional(),
});

export const approvePayoutSchema = Joi.object({
  utrNumber: Joi.string().max(50).optional(),
});

export const rejectPayoutSchema = Joi.object({
  reason: Joi.string().max(500).required(),
});

export const walletQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
