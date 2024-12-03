import {
  burnSubtitlesToVideo,
  convertVttToAss,
  extractAudio,
  generateASS,
  transcribeAudio,
} from "../services/video.services.js";
import fs from "fs";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const captionsDir = path.join(__dirname, "../uploads/captions");
if (!fs.existsSync(captionsDir)) {
  fs.mkdirSync(captionsDir, { recursive: true });
}

const audioDir = path.join(__dirname, "../uploads/audio");
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

const EllaFontPath = path.join(__dirname, `../../fonts/Ella.otf`);
const WilliamFontPath = path.join(__dirname, `../../fonts/Williamdemo.otf`);
const AliFontPath = path.join(__dirname, `../../fonts/Ali.ttf`);
const MaltaFontPath = path.join(__dirname, `../../fonts/malta.ttf`);
const BeastFontPath = path.join(__dirname, `../../fonts/beast.ttf`);

const fontProperties = {
  Ella: {
    fontFamily: "Ella",
    fontSize: "20",
    fontColor: "#FF0000",
    fontWeight: "1",
  },
};

export const addSubtitles = async (req, res) => {
  const { font } = req.body;
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No video file uploaded",
    });
  }

  const inputVideoPath = req.file.path;
  const fileName = path.parse(req.file.filename).name;

  const audioOutputPath = path.join(audioDir, `${fileName}.wav`);
  const vttSubtitlePath = path.join(captionsDir, `${fileName}.vtt`);
  const outputVideoPath = path.join(
    uploadsDir,
    `${fileName}_with_captions.mkv`
  );

  let fontPath = "";
  if (font == "Ella") {
    fontPath = EllaFontPath;
  }

  try {
    // Step 1: Extract audio
    await extractAudio(inputVideoPath, audioOutputPath);
    console.log("Audio extracted successfully");

    // Step 2: Generate subtitles
    const vttContent = await transcribeAudio(audioOutputPath);
    fs.writeFileSync(vttSubtitlePath, vttContent);

    convertVttToAss(vttSubtitlePath, captionsDir)
      .then((assFilePath) => {
        console.log("ASS file created at:", assFilePath);
      })
      .catch((error) => {
        console.error("Conversion failed:", error);
      });

    // fs.writeFileSync(assSubtitlePath, assContent);
    console.log("Subtitles generated successfully");

    // Step 3: Burn subtitles
    // await burnSubtitlesToVideo(
    //   inputVideoPath,
    //   assSubtitlePath,
    //   outputVideoPath,
    //   fontPath
    //   );

    console.log("Subtitles burned successfully");

    // Send success response
    res.status(200).json({
      success: true,
      message: "Video processed successfully",
      outputVideoPath,
      videoPath:
        process.env.BACKEND_URL +
        "/uploads" +
        inputVideoPath.split("/uploads")[1],
      subtitlesPath:
        process.env.BACKEND_URL +
        "/uploads" +
        vttSubtitlePath.split("/uploads")[1],
    });
  } catch (error) {
    console.error("Error processing video:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process video",
      error: error.message,
    });
  } finally {
    // Cleanup temporary files
    try {
      // if (fs.existsSync(audioOutputPath)) fs.unlinkSync(audioOutputPath);
      // if (fs.existsSync(assSubtitlePath)) fs.unlinkSync(assSubtitlePath);
    } catch (err) {
      console.error("Error cleaning up temporary files:", err);
    }
  }
};

export const burnSubtitleIntoVideo = async (req, res, next) => {
  const { vttContent, font, fileName, ext } = req.body;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No video file uploaded",
    });
  }

  let fontPath = "";
  const inputVideoPath = path.join(uploadsDir, `${fileName}.${ext}`);

  const assSubtitlePath = path.join(captionsDir, `${fileName}.ass`);
  const outputVideoPath = path.join(
    uploadsDir,
    `${fileName}_with_captions.mkv`
  );

  if (font == "Ella") {
    fontPath = EllaFontPath;
  }

  const assContent = generateASS(
    JSON.parse(vttContent),
    fontProperties[font].fontFamily,
    fontProperties[font].fontSize,
    fontProperties[font].fontColor,
    fontProperties[font].fontWeight
  );

  console.log("assContent::::", assContent);
  fs.writeFileSync(assSubtitlePath, assContent);

  await burnSubtitlesToVideo(
    inputVideoPath,
    assSubtitlePath,
    outputVideoPath,
    fontPath
  );

  res.status(200).json({
    success: true,
    message: "Video processed successfully",
    videoPath:
      process.env.BACKEND_URL +
      "/uploads" +
      outputVideoPath.split("/uploads")[1],
  });
};
