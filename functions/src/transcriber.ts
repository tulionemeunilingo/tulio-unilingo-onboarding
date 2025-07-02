import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import ffmpeg from "fluent-ffmpeg";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import fetch from "node-fetch";
import * as dotenv from "dotenv";
dotenv.config();

type DeepgramResponse = {
  results?: {
    channels?: {
      alternatives?: { transcript?: string }[];
    }[];
  };
};

export const transcribeOnCreate = onDocumentCreated(
  "/users/{userId}/videos/{videoId}",
  async (event) => {
    logger.info("transcribeOnCreate function triggered!");
    const snapshot = event.data;
    if (!snapshot) {
      logger.error("No data associated with the event");
      return;
    }
    const after = snapshot.data();
    const { userId, videoId } = event.params;

    logger.info(
      `Triggered onCreate for userId: ${userId}, videoId: ${videoId}`
    );

    if (after.status !== "uploaded") return null;

    const filePath = after.filePath;
    const bucket = admin.storage().bucket();
    const tempVideoPath = path.join(os.tmpdir(), `${videoId}.mp4`);
    const tempAudioPath = path.join(os.tmpdir(), `${videoId}.wav`);

    let errorMessage = "";
    try {
      await bucket.file(filePath).download({ destination: tempVideoPath });

      // Extract audio with ffmpeg
      await new Promise((resolve, reject) => {
        ffmpeg(tempVideoPath)
          .output(tempAudioPath)
          .audioCodec("pcm_s16le")
          .on("end", resolve)
          .on("error", reject)
          .run();
      });

      // Send audio to Deepgram API
      const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
      const audioBuffer = fs.readFileSync(tempAudioPath);
      const response = await fetch("https://api.deepgram.com/v1/listen", {
        method: "POST",
        headers: {
          Authorization: `Token ${deepgramApiKey}`,
          "Content-Type": "audio/wav",
        },
        body: audioBuffer,
      });
      const dgResult = (await response.json()) as DeepgramResponse;
      const transcript =
        dgResult.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

      // Save transcript in Firestore
      await admin
        .firestore()
        .doc(`users/${userId}/videos/${videoId}`)
        .update({ transcript, status: "transcribed" });
    } catch (err) {
      errorMessage =
        errorMessage ||
        (err instanceof Error
          ? err.message
          : "Unknown error during transcription");
      logger.error(
        `Transcription failed for video ${videoId}: ${errorMessage}`
      );
      // Update Firestore with error status
      await admin
        .firestore()
        .doc(`users/${userId}/videos/${videoId}`)
        .update({ status: "error", error: errorMessage });
    } finally {
      // Clean up temp files
      [tempVideoPath, tempAudioPath].forEach((file) => {
        if (fs.existsSync(file)) {
          try {
            fs.unlinkSync(file);
          } catch (cleanupErr) {
            logger.warn(`Failed to delete temp file ${file}: ${cleanupErr}`);
          }
        }
      });
    }

    return null;
  }
);
