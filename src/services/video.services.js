import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffprobeStatic from "ffprobe-static";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

// Configure FFmpeg paths
ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const extractAudio = async (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(["-vn", "-acodec pcm_s16le", "-ar 16000", "-ac 1"])
      .save(outputPath)
      .on("end", () => {
        console.log("Audio extraction complete");
        resolve();
      })
      .on("error", (err) => {
        console.error("Error extracting audio:", err);
        reject(err);
      });
  });
};

export const transcribeAudio = async (audioPath) => {
  try {
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found at path: ${audioPath}`);
    }

    console.log("Starting transcription for:", audioPath);
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
      response_format: "verbose_json",
    });

    const { phrases } = processTranscriptionSegments(transcription.segments);
    const assContent = generateASS(phrases);
    const vttContent = generateVTTFromSegments(phrases);

    console.log("assContent:::", assContent);

    return { assContent, vttContent };
  } catch (err) {
    console.error("Error during transcription:", err);
    throw err;
  }
};

const processTranscriptionSegments = (segments) => {
  const phrases = segments.map((segment) => ({
    start: segment.start,
    end: segment.end,
    text: segment.text.trim(),
  }));

  return { phrases };
};

function generateASS(phrases) {
  const assHeader = `[Script Info]
Title: Generated Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Ella,30,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

  const assEvents = phrases
    .map((phrase) => {
      const start = formatASSTime(phrase.start);
      const end = formatASSTime(phrase.end);
      const text = phrase.text.replace(/[\r\n]+/g, " ").trim();
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
    })
    .join("\n");

  return assHeader + assEvents;
}

function formatASSTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(
    2,
    "0"
  )}.${String(ms).padStart(2, "0")}`;
}

export const burnSubtitlesToVideo = async (
  inputVideoPath,
  assSubtitlePath,
  outputVideoPath,
  fontPath = ""
) => {
  let fontDir = "";
  const OutputOptions = [];

  if (fontPath != "") {
    fontDir = `:fontsdir=${path
      .dirname(fontPath)
      .replace(/[\\]/g, "\\\\")
      .replace(/[']/g, "\\'")}`;

    OutputOptions.push(
      `-attach ${fontPath.replace(/[\\]/g, "\\\\").replace(/[']/g, "\\'")}`
    );
    OutputOptions.push(`-metadata:s:t mimetype=application/x-truetype-font`);
  }
  OutputOptions.push("-c:v libx264");
  OutputOptions.push("-preset fast");
  OutputOptions.push("-crf 23");
  OutputOptions.push("-c:a copy");

  console.log("OutputOptions:::", OutputOptions);

  return new Promise((resolve, reject) => {
    ffmpeg(inputVideoPath)
      .videoFilters(
        `subtitles='${assSubtitlePath
          .replace(/[\\]/g, "\\\\")
          .replace(/[']/g, "\\'")}'
          ${fontDir}`
      )
      .outputOptions(OutputOptions)
      .on("start", (command) => {
        console.log("FFmpeg process started:", command);
      })
      .on("end", () => {
        console.log("Subtitles burned successfully");
        resolve();
      })
      .on("error", (err) => {
        console.error("Error burning subtitles:", err);
        reject(err);
      })
      .on("stderr", (stderrLine) => {
        console.log("FFmpeg stderr:", stderrLine);
      })
      .save(outputVideoPath);
  });
};

export const generateVTTFromSegments = (segments) => {
  let vtt = "WEBVTT\n\n";

  segments.forEach((segment) => {
    const words = segment.text.trim().split(/\s+/);
    const numWords = words.length;
    const segmentDuration = segment.end - segment.start;
    const wordDuration = segmentDuration / numWords;

    let currentPhrase = "";
    let phraseStartTime = segment.start;

    words.forEach((wordText, i) => {
      currentPhrase += (currentPhrase ? " " : "") + wordText;

      // Check if it's the end of the sentence or last word
      const isEndOfPhrase = wordText.endsWith(".") || i === numWords - 1;

      if (isEndOfPhrase) {
        const phraseEndTime = segment.start + (i + 1) * wordDuration;

        vtt += `${formatVTTTime(phraseStartTime)} --> ${formatVTTTime(
          phraseEndTime
        )}\n`;
        vtt += `${currentPhrase}\n\n`;

        // Reset for the next phrase
        currentPhrase = "";
        phraseStartTime = phraseEndTime;
      }
    });
  });

  return vtt;
};

function formatVTTTime(seconds) {
  const date = new Date(seconds * 1000);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const secs = String(date.getUTCSeconds()).padStart(2, "0");
  const millis = String(date.getUTCMilliseconds()).padStart(3, "0");

  return `${hours}:${minutes}:${secs}.${millis}`;
}

export const convertVttToAss = (vttFilePath, outputDir) => {
  return new Promise((resolve, reject) => {
    // Get the file name without extension and set output path
    const fileName = path.basename(vttFilePath, path.extname(vttFilePath));
    const assFilePath = path.join(outputDir, `${fileName}.ass`);

    ffmpeg(vttFilePath)
      .output(assFilePath)
      .on("start", (commandLine) => {
        console.log("FFmpeg process started:", commandLine);
      })
      .on("end", () => {
        console.log("Conversion to ASS completed successfully.");
        resolve(assFilePath);
      })
      .on("error", (err) => {
        console.error("Error converting VTT to ASS:", err.message);
        reject(err);
      })
      .run();
  });
};
