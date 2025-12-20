import express from 'express';
import * as auditController from '../controllers/audit.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  getAuditLogsQuerySchema,
  entityHistoryParamSchema,
  userActivityParamSchema,
  activityStatsQuerySchema,
  changeTimelineParamSchema,
  suspiciousActivitiesQuerySchema,
  exportLogsQuerySchema
} from '../validators/audit.validator.js';

const router = express.Router();

// All audit routes require authentication
router.use(verifyJWT);

// Self-service route - any authenticated user
router.get('/my-activity', auditController.getMyActivity);

// Staff/Admin routes
router.get(
  '/',
  checkRole('staff', 'internal', 'super-admin'),
  validate(getAuditLogsQuerySchema),
  auditController.getAuditLogs
);

router.get(
  '/entity/:entityType/:entityId',
  checkRole('staff', 'internal', 'super-admin'),
  validate(entityHistoryParamSchema),
  auditController.getEntityHistory
);

router.get(
  '/user/:userId',
  checkRole('staff', 'internal', 'super-admin'),
  validate(userActivityParamSchema),
  auditController.getUserActivity
);

router.get(
  '/stats',
  checkRole('staff', 'internal', 'super-admin'),
  validate(activityStatsQuerySchema),
  auditController.getActivityStats
);

router.get(
  '/timeline/:entityType/:entityId',
  checkRole('staff', 'internal', 'super-admin'),
  validate(changeTimelineParamSchema),
  auditController.getChangeTimeline
);

// Internal/Admin only routes
router.get(
  '/suspicious',
  checkRole('internal', 'super-admin'),
  validate(suspiciousActivitiesQuerySchema),
  auditController.getSuspiciousActivities
);

router.get(
  '/export',
  checkRole('internal', 'super-admin'),
  validate(exportLogsQuerySchema),
  auditController.exportLogs
);

export default router;
