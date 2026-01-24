import express from 'express';
import * as roleTemplateController from '../controllers/roleTemplate.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/requirePermission.js';

const router = express.Router();

// All routes require authentication
router.use(verifyJWT);

// Get categories (staff can view)
router.get('/categories', roleTemplateController.getCategories);

// Super-admin only routes
router.get(
  '/',
  requirePermission('staff', 'manage'),
  roleTemplateController.getRoleTemplates
);

router.get(
  '/:id',
  requirePermission('staff', 'manage'),
  roleTemplateController.getRoleTemplate
);

router.post(
  '/',
  requirePermission('staff', 'manage'),
  roleTemplateController.createRoleTemplate
);

router.patch(
  '/:id',
  requirePermission('staff', 'manage'),
  roleTemplateController.updateRoleTemplate
);

router.delete(
  '/:id',
  requirePermission('staff', 'manage'),
  roleTemplateController.deleteRoleTemplate
);

export default router;
