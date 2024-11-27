import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import OpenAI from "openai";

// Load environment variables from .env file
dotenv.config();

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set FFmpeg binary path
ffmpeg.setFfmpegPath(ffmpegPath);

// File paths
const inputVideoPath = path.resolve(__dirname, "reel.mp4"); // Update with your input video path
const audioOutputPath = path.resolve(__dirname, "output.wav");
const assSubtitlePath = path.resolve(__dirname, "output.ass");
const outputVideoPath = path.resolve(__dirname, "output_with_captions.mp4");

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to extract audio from video
function extractAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-vn", // No video
        "-acodec pcm_s16le", // PCM 16-bit little-endian
        "-ar 16000", // 16 kHz sample rate
        "-ac 1", // Mono audio
      ])
      .on("end", () => {
        console.log("Audio extraction complete.");
        resolve();
      })
      .on("error", (err) => {
        console.error("Error extracting audio:", err.message);
        reject(err);
      })
      .save(outputPath);
  });
}

// Function to transcribe audio and generate ASS subtitles
async function transcribeAudio(audioPath) {
  console.log("Transcribing audio with OpenAI Whisper...");

  try {
    console.log("Transcribing audio", audioPath);
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
      response_format: "verbose_json",
    });
    console.log("transcription::", transcription);
    // const combinedSegments = combineSegments(transcription.segments);
    const { phrases } = processTranscriptionSegments(transcription.segments);

    console.log("phrases::::", phrases);

    // const adjustedPhrases = adjustPhraseTiming(phrases, 0.5); // Example: Offset by 0.5 seconds
    
    const assContent = generateASS(phrases);
    fs.writeFileSync(assSubtitlePath, assContent);
    console.log("ASS subtitle file generated.");
  } catch (err) {
    console.error("Error during transcription:", err);
    throw err;
  }
}

// Function to process transcription segments
// function processTranscriptionSegments(segments) {
//   const phrases = [];

//   segments.forEach((segment) => {
//     const words = segment.text.trim().split(/\s+/);
//     const duration = (segment.end - segment.start) / words.length;

//     words.forEach((word, index) => {
//       const start = segment.start + index * duration;
//       const end = start + duration;
//       phrases.push({ start, end, text: word });
//     });
//   });

//   return { phrases };
// }


// Function to process transcription segments and create word-level subtitles
// Function to process transcription segments and create word-level subtitles
function processTranscriptionSegments(segments) {
  const phrases = [];

  segments.forEach((segment) => {
    // Use the entire segment's text as a phrase
    const phraseText = segment.text.trim();
    const start = segment.start; // Start time of the segment
    const end = segment.end; // End time of the segment

    // Push the phrase with its timing
    phrases.push({ start, end, text: phraseText });
  });

  return { phrases };
}










// Function to generate ASS subtitle content
// function generateASS(phrases) {
//   const assHeader = `[Script Info]
//   Title: Subtitles
//   ScriptType: v4.00+
//   WrapStyle: 0
//   PlayResX: 1280
//   PlayResY: 720
  
//   [V4+ Styles]
//   Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
//   Style: Default,Arial,30,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1,0,8,10,10,10,1
  
//   [Events]
//   Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
//   `;

//   let assEvents = "";
//   phrases.forEach((phrase) => {
//     const start = formatASSTime(phrase.start);
//     const end = formatASSTime(phrase.end);
//     // Remove line breaks in subtitle text
//     const singleLineText = phrase.text.replace(/[\r\n]+/g, " ").trim();
//     assEvents += `Dialogue: 0,${start},${end},Default,,0,0,0,,${singleLineText}\n`;
//   });

//   return assHeader + assEvents;
// }

// Function to format time for ASS (H:MM:SS.cc)
// function formatASSTime(seconds) {
//   const date = new Date(seconds * 1000);
//   return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
//     date.getUTCMinutes()
//   ).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}.${String(
//     date.getUTCMilliseconds()
//   ).padStart(3, "0")}`;
// }



function generateASS(phrases) {
  const assHeader = `[Script Info]
Title: Word-Level Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,30,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,1,0,8,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let assEvents = "";
  phrases.forEach((phrase) => {
    const start = formatASSTime(phrase.start);
    const end = formatASSTime(phrase.end);
    const sanitizedText = phrase.text.replace(/[\r\n]+/g, " ").trim();
    assEvents += `Dialogue: 0,${start},${end},Default,,0,0,0,,${sanitizedText}\n`;
  });

  return assHeader + assEvents;
}






function formatASSTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 100); // Handle milliseconds more accurately
  return `${String(h).padStart(1, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}


function combineSegments(segments, maxGap = 1) {
  const combined = [];
  let current = null;

  segments.forEach((segment) => {
    if (
      current &&
      segment.start - current.end <= maxGap // Merge if gap is small
    ) {
      current.end = segment.end;
      current.text += ` ${segment.text.trim()}`;
    } else {
      if (current) combined.push(current);
      current = { start: segment.start, end: segment.end, text: segment.text.trim() };
    }
  });

  if (current) combined.push(current);
  return combined;
}






function adjustPhraseTiming(phrases, padding = 0.5) {
  return phrases.map((phrase) => ({
    ...phrase,
    end: phrase.end + padding, // Add padding to the end time for extra display time
  }));
}





function escapePath(filePath) {
  // Replace backslashes with forward slashes and escape special characters
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

// Function to burn subtitles onto the video
function burnSubtitlesToVideo(
  inputVideoPath,
  assSubtitlePath,
  outputVideoPath
) {
  console.log("================================", assSubtitlePath);
  const formattedSubtitlePath = assSubtitlePath.replace(/\\/g, "/"); // Ensure proper path format

  console.log("formattedSubtitlePath", formattedSubtitlePath);
  return new Promise((resolve, reject) => {
    ffmpeg(inputVideoPath)
      //   .videoFilters(`ass="${formattedSubtitlePath}"`)
      .videoFilters(`ass='${escapePath(assSubtitlePath)}'`)
      .outputOptions([
        "-r 30", // Example: Set the frame rate
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        "-c:a aac",
        "-b:a 128k",
      ])
      .on("end", () => {
        console.log("Video with subtitles generated:", outputVideoPath);
        resolve();
      })
      .on("error", (err) => {
        console.error("Error burning subtitles:", err.message);
        reject(err);
      })
      .save(outputVideoPath);
  });
}

// Main function
async function main() {
  try {
    // Step 1: Extract audio
    await extractAudio(inputVideoPath, audioOutputPath);

    // Step 2: Generate subtitles
    const a = await transcribeAudio(audioOutputPath);
    // Step 3: Burn subtitles
    await burnSubtitlesToVideo(
      inputVideoPath,
      assSubtitlePath,
      outputVideoPath
    );
  } catch (err) {
    console.error("Error:", err);
  } finally {
    // Cleanup
    if (fs.existsSync(audioOutputPath)) fs.unlinkSync(audioOutputPath);
    if (fs.existsSync(assSubtitlePath)) fs.unlinkSync(assSubtitlePath);
  }
}

main();
