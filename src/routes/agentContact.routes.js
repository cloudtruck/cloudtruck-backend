import express from 'express';
import * as controller from '../controllers/agentContact.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createAgentContactSchema,
  updateAgentContactSchema,
  agentContactIdParamSchema,
  lookupAgentContactSchema
} from '../validators/agentContact.validator.js';

const router = express.Router();

router.use(verifyJWT);

// Customer app: must be declared before '/:id'
router.get('/lookup', validate(lookupAgentContactSchema), controller.lookupAgentContact);

const admin = checkRole('internal', 'super-admin');
router.get('/', admin, controller.listAgentContacts);
router.post('/', admin, validate(createAgentContactSchema), controller.createAgentContact);
router.patch('/:id', admin, validate(updateAgentContactSchema), controller.updateAgentContact);
router.delete('/:id', admin, validate(agentContactIdParamSchema), controller.deleteAgentContact);

export default router;
