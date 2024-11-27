import express from 'express';
import { addSubtitles } from '../controller/video.controller.js';
import { upload } from '../middleware/multer.middleware.js';

const videoRoutes = express.Router();

videoRoutes.use('/addSubtitles', upload.single('video'), addSubtitles);

export default videoRoutes;
