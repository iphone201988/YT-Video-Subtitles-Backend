import express from 'express';
import videoRoutes from './video.route.js';

const router = express.Router();

router.use('/video', videoRoutes);

export default router;
