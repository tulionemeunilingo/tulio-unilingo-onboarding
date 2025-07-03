import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import ffmpeg from "fluent-ffmpeg";

export const alignerOnUpdate = onDocumentUpdated(
  {
    document: "/users/{userId}/videos/{videoId}",
  },
  async (event) => {
    logger.info("alignerOnUpdate function triggered!");

    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const {userId, videoId} = event.params;

    if (!before || !after) {
      logger.error("Missing before/after data for aligner trigger.");
      return;
    }

    // Only trigger if status changed to "synthesized"
    if (before.status !== "synthesized" && after.status === "synthesized") {
      logger.info(
        `Triggered aligner for userId: ${userId}, videoId: ${videoId}`
      );

      const audioPath = after.filePath;
      const transcript = after.transcript;
      if (!audioPath || !transcript) {
        logger.error("Missing filePath or transcript");
        return null;
      }

      const videoFolder = audioPath.split("/")[2];
      if (!videoFolder) {
        logger.error("filePath not exist, cannt find video folder.");
        return;
      }

      // Download audio from Storage
      const bucket = admin.storage().bucket();
      const tmpDir = os.tmpdir();
      const synthTmp = path.join(tmpDir, `${videoId}-synthesized.mp3`);
      const alignedTmp = path.join(tmpDir, `${videoId}-aligned.mp3`);

      try {
        await bucket.file(audioPath).download({destination: synthTmp});
        logger.info("Downloaded synthesized audio.");

        // Simple ffmpeg alignment
        await new Promise<void>((resolve, reject) => {
          ffmpeg(synthTmp)
            .outputOptions(["-af", "adelay=0|0"])
            .save(alignedTmp)
            .on("end", () => resolve())
            .on("error", (err) => reject(err));
        });
        logger.info("Audio aligned");

        // Upload aligned audio
        const alignedStoragePath =
          `videos/${userId}/${videoFolder}/aligned.mp3`;
        await bucket.upload(alignedTmp, {
          destination: alignedStoragePath,
          metadata: {contentType: "audio/mpeg"},
        });
        logger.info(`Uploaded aligned audio to ${alignedStoragePath}`);

        // After alignment, update Firestore status
        await admin
          .firestore()
          .doc(`users/${userId}/videos/${videoId}`)
          .update({
            alignedAudioPath: alignedStoragePath,
            status: "aligned",
          });

        logger.info("Alignment complete.");
      } catch (err) {
        logger.error(
          `Alignment failed: ${err instanceof Error ? err.message : err}`
        );
        await admin
          .firestore()
          .doc(`users/${userId}/videos/${videoId}`)
          .update({
            alignmentError: err instanceof Error ? err.message : String(err),
          });
      } finally {
        // Clean up temp file
        [synthTmp, alignedTmp].forEach((file) => {
          if (fs.existsSync(file)) fs.unlinkSync(file);
        });
      }
    } else {
      logger.info(`videoId: ${videoId} status wasn't 'synthesized'`);
    }

    return null;
  }
);
