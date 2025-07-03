import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

import {defineSecret} from "firebase-functions/params";
const CARTESIA_API_KEY = defineSecret("CARTESIA_API_KEY");

// Mapping of language codes to Cartesia voice IDs

const voiceMap: Record<string, string> = {
  pt: "pt-BR-Wavenet-B",
  es: "es-ES-Wavenet-C",
  fr: "fr-FR-Wavenet-D",
  de: "de-DE-Wavenet-E",
};

export const synthesizerOnUpdate = onDocumentUpdated(
  {
    document: "/users/{userId}/videos/{videoId}",
    secrets: [CARTESIA_API_KEY],
  },
  async (event) => {
    logger.info("synthesizerOnUpdate function triggered!");

    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const {userId, videoId} = event.params;

    if (!before || !after) {
      logger.error("Missing before/after data for synthesizer trigger.");
      return;
    }

    // Only trigger if status changed to "translated"
    if (before.status !== "translated" && after.status === "translated") {
      logger.info(
        `Triggered synthesizer for userId: ${userId}, videoId: ${videoId}`
      );

      const translation = after.translation;
      if (!translation) {
        logger.error("No translation found to synthesize.");
        return;
      }

      const languageToDub = after.languageToDub;
      if (!languageToDub) {
        logger.error("No languageToDub specified.");
        return;
      }

      // Determine voice ID dynamically based on language
      const voiceId = voiceMap[languageToDub];
      if (!voiceId) {
        logger.error(`Unsupported language: ${languageToDub}`);
        return null;
      }

      const videoFolder = after.filePath?.split("/")[2];
      if (!videoFolder) {
        logger.error("filePath not exist, cannt find video folder.");
        return;
      }

      const cartesiaApiKey = CARTESIA_API_KEY.value();
      if (!cartesiaApiKey) {
        logger.error("CARTESIA_API_KEY is not set.");
        return;
      }

      try {
        // Call Cartesia API to synthesize audio from translation
        logger.info(`Synthesizing using voiceId: ${voiceId}`);
        // TODO : Replace with dynamic voice ID
        const response = await fetch("https://api.cartesia.ai/tts/bytes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${cartesiaApiKey}`,
            "Cartesia-Version": "2025-04-16",
          },
          body: JSON.stringify({
            model_id: "sonic-2",
            transcript: translation,
            voice: {mode: "id", id: "694f9389-aac1-45b6-b726-9d9369183238"},
            output_format: {
              container: "mp3",
              bit_rate: 128000,
              sample_rate: 44100,
            },
            language: languageToDub,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Cartesia API error: ${response.status} ${errorText}`
          );
        }

        logger.info("Cartesia API call successful");

        // Assume the API returns audio as a binary buffer
        const audioBuffer = Buffer.from(await response.arrayBuffer());

        // Save audio to Storage
        const bucket = admin.storage().bucket();
        const audioFilePath = `videos/${userId}/${videoFolder}/synthesized.mp3`;
        const tempAudioPath = path.join(
          os.tmpdir(),
          `${videoId}-synthesized.mp3`
        );
        fs.writeFileSync(tempAudioPath, audioBuffer);

        await bucket.upload(tempAudioPath, {
          destination: audioFilePath,
          contentType: "audio/mpeg",
        });

        // Update Firestore
        await admin
          .firestore()
          .doc(`users/${userId}/videos/${videoId}`)
          .update({
            synthesizedAudioPath: audioFilePath,
            status: "synthesized",
          });

        logger.info(
          "Synthesized audio saved to Storage and Firestore updated."
        );
      } catch (err) {
        logger.error(
          `Synthesis failed: ${err instanceof Error ? err.message : err}`
        );
        await admin
          .firestore()
          .doc(`users/${userId}/videos/${videoId}`)
          .update({
            synthesisError: err instanceof Error ? err.message : String(err),
          });
      } finally {
        // Clean up temp file
        const tempAudioPath = path.join(
          os.tmpdir(),
          `${videoId}-synthesized.mp3`
        );
        if (fs.existsSync(tempAudioPath)) {
          try {
            fs.unlinkSync(tempAudioPath);
          } catch (cleanupErr) {
            logger.warn(`Failed to delete temp audio file: ${cleanupErr}`);
          }
        }
      }
    } else {
      logger.info(`videoId: ${videoId} status wasn't 'translated'`);
    }

    return null;
  }
);
