import express from 'express';
import { pullChanges, pushChanges } from '../controllers/syncController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/pull', pullChanges);
router.post('/push', pushChanges);

export default router;
