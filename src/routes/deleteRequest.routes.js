import express from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { isInternalOrAbove, isStaffOrAbove } from '../middlewares/roleCheck.middleware.js';
import {
  listDeleteRequests,
  listMyDeleteRequests,
  approveDeleteRequest,
  rejectDeleteRequest
} from '../controllers/deleteRequest.controller.js';

const router = express.Router();

router.use(verifyJWT);

// Staff: view own requests
router.get('/mine', isStaffOrAbove, listMyDeleteRequests);

// Internal + super-admin: view all pending requests
router.get('/', isInternalOrAbove, listDeleteRequests);

// Internal + super-admin: approve or reject
router.post('/:id/approve', isInternalOrAbove, approveDeleteRequest);
router.post('/:id/reject', isInternalOrAbove, rejectDeleteRequest);

export default router;
