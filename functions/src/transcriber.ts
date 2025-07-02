import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import ffmpeg from "fluent-ffmpeg";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import fetch from "node-fetch";

import {defineSecret} from "firebase-functions/params";
const DEEPGRAM_API_KEY = defineSecret("DEEPGRAM_API_KEY");

type DeepgramResponse = {
  results?: {
    channels?: {
      alternatives?: { transcript?: string }[];
    }[];
  };
};

export const transcribeOnCreate = onDocumentCreated(
  {
    document: "/users/{userId}/videos/{videoId}",
    secrets: [DEEPGRAM_API_KEY],
  },
  async (event) => {
    logger.info("transcribeOnCreate function triggered!");

    const snapshot = event.data;
    if (!snapshot) {
      logger.error("No data associated with the event");
      return;
    }

    const after = snapshot.data();
    const {userId, videoId} = event.params;

    logger.info(
      `Triggered onCreate for userId: ${userId}, videoId: ${videoId}`,
    );

    if (after.status !== "uploaded") return null;

    const filePath = after.filePath;
    const bucket = admin.storage().bucket();
    const tempVideoPath = path.join(os.tmpdir(), `${videoId}.mp4`);
    const tempAudioPath = path.join(os.tmpdir(), `${videoId}.wav`);

    let errorMessage = "";
    try {
      await bucket.file(filePath).download({destination: tempVideoPath});

      logger.info("Video downloaded successfully");

      // Extract audio with ffmpeg
      await new Promise((resolve, reject) => {
        ffmpeg(tempVideoPath)
          .output(tempAudioPath)
          .audioCodec("pcm_s16le")
          .on("end", resolve)
          .on("error", reject)
          .run();
      });

      logger.info("Audio extracted successfully");

      // Send audio to Deepgram API to be transcribed
      logger.info("Sending audio to Deepgram for transcription");

      const deepgramApiKey = DEEPGRAM_API_KEY.value();
      if (!deepgramApiKey) {
        throw new Error("Deepgram API key is not set");
      }

      const audioBuffer = fs.readFileSync(tempAudioPath);
      const response = await fetch("https://api.deepgram.com/v1/listen", {
        method: "POST",
        headers: {
          "Authorization": `Token ${deepgramApiKey}`,
          "Content-Type": "audio/wav",
        },
        body: audioBuffer,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Deepgram API request failed: ${response.status} ${errorText}`,
        );
      }

      logger.info("Received response from Deepgram");

      const dgResult = (await response.json()) as DeepgramResponse;
      if (!dgResult.results || !dgResult.results.channels) {
        throw new Error("No transcription results found in Deepgram response");
      }

      logger.info("Transcription results was received successfully");

      const transcript =
        dgResult.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

      // Save transcript as a file in Storage
      const transcriptFilePath =
        `users/${userId}/videos/${videoId}/transcript.txt`;
      const transcriptTempPath = path.join(
        os.tmpdir(),
        `${videoId}-transcript.txt`,
      );
      fs.writeFileSync(transcriptTempPath, transcript);

      logger.info("Transcript saved to temporary file");

      await bucket.upload(transcriptTempPath, {
        destination: transcriptFilePath,
        contentType: "text/plain",
      });

      logger.info("Transcript uploaded to Storage");

      // Save transcript in Firestore
      await admin
        .firestore()
        .doc(`users/${userId}/videos/${videoId}`)
        .update({transcript, status: "transcribed"});

      logger.info("Firestore updated with transcript and status");
    } catch (err) {
      errorMessage =
        errorMessage ||
        (err instanceof Error ?
          err.message :
          "Unknown error during transcription");
      logger.error(
        `Transcription failed for video ${videoId}: ${errorMessage}`,
      );
      // Update Firestore with error status
      await admin
        .firestore()
        .doc(`users/${userId}/videos/${videoId}`)
        .update({status: "error", error: errorMessage});
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

    logger.info(`Triggered onCreate Finished for videoId: ${videoId}`);

    return null;
  },
);
