import express from "express";
import {
  addSubtitles,
  burnSubtitleIntoVideo,
} from "../controller/video.controller.js";
import { upload } from "../middleware/multer.middleware.js";

const videoRoutes = express.Router();

videoRoutes.use("/addSubtitles", upload.single("video"), addSubtitles);
videoRoutes.use("/getSubtitledVideo", burnSubtitleIntoVideo);

export default videoRoutes;
