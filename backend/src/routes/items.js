import express from 'express';
import { getItems, createItemsBatch, updateItem, deleteItem } from '../controllers/itemsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getItems);
router.post('/batch', createItemsBatch);
router.put('/:id', updateItem);
router.delete('/:id', deleteItem);

export default router;
