import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { checkRole } from '../middlewares/roleCheck.middleware.js';
import {
  createPayment,
  approvePayment,
  markPaid,
  rejectPayment,
  getPayments,
  getPaymentById,
  getSupplierLedger,
} from '../controllers/supplierPayment.controller.js';

const router = Router();

const isStaff           = checkRole('staff', 'internal', 'super-admin');
const isInternal        = checkRole('internal', 'super-admin');
const isStaffOrSupplier = checkRole('supplier', 'staff', 'internal', 'super-admin');

router.use(verifyJWT);

router.post('/',  isStaff,           createPayment);
router.get('/',   isStaffOrSupplier, getPayments);

// IMPORTANT: /supplier/:supplierId/ledger MUST be before /:id to avoid Express
// matching 'supplier' as the :id param.
router.get('/supplier/:supplierId/ledger', isStaff, getSupplierLedger);

router.get('/:id',          isStaff,    getPaymentById);
router.post('/:id/approve', isInternal, approvePayment);
router.post('/:id/mark-paid', isInternal, markPaid);
router.post('/:id/reject',  isInternal, rejectPayment);

export default router;
