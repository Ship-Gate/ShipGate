/**
 * Golden Auth Template (Express) — Auth routes
 */

import { Router } from 'express';
import { registerController } from '../controllers/register.js';
import { loginController } from '../controllers/login.js';
import { logoutController } from '../controllers/logout.js';
import { refreshController } from '../controllers/refresh.js';

const router = Router();

router.post('/register', registerController);
router.post('/login', loginController);
router.post('/logout', logoutController);
router.post('/refresh', refreshController);

export default router;
