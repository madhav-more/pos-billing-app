import express from 'express';
import { getCustomers, createCustomersBatch, updateCustomer } from '../controllers/customersController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getCustomers);
router.post('/batch', createCustomersBatch);
router.put('/:id', updateCustomer);

export default router;
