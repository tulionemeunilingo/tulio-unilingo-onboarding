import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import fetch from "node-fetch";

import {defineSecret} from "firebase-functions/params";
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const languageMap: Record<string, string> = {
  pt: "Portuguese",
  es: "Spanish",
  fr: "French",
  de: "German",
  // add more as needed
};

export const translatorOnUpdate = onDocumentUpdated(
  {
    document: "/users/{userId}/videos/{videoId}",
    secrets: [OPENAI_API_KEY],
  },
  async (event) => {
    logger.info("translatorOnUpdate function triggered!");

    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const {userId, videoId} = event.params;

    if (!before || !after) {
      logger.error("Missing before/after data for translation trigger.");
      return;
    }

    // Only trigger if status changed to "transcribed"
    if (before.status !== "transcribed" && after.status === "transcribed") {
      logger.info(
        `Triggered translator for userId: ${userId}, videoId: ${videoId}`
      );

      const transcript = after.transcript;
      if (!transcript) {
        logger.error("No transcript found to translate.");
        return;
      }

      const languageToDub = after.languageToDub;
      if (!languageToDub) {
        logger.error("No languageToDub specified.");
        return;
      }

      const languageToDubName = languageMap[languageToDub] || null;
      if (!languageToDubName) {
        logger.error(`Unsupported languageToDub: ${languageToDub}`);
        return;
      }

      const gptPrompt =
        `Translate this transcript to ${languageToDubName}:\n\n${transcript}`;
      logger.info(`GPT prompt: ${gptPrompt}`);

      // Call OpenAI GPT API
      const openaiApiKey = OPENAI_API_KEY.value();
      if (!openaiApiKey) {
        logger.error("OpenAI API key is not set.");
        return;
      }

      try {
        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openaiApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              messages: [
                {role: "system", content: "You are a helpful translator."},
                {role: "user", content: gptPrompt},
              ],
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
        }

        logger.info("OpenAI API response received successfully.");

        const data = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const translation = data.choices?.[0]?.message?.content?.trim() || "";

        // Save translation in Firestore
        await admin
          .firestore()
          .doc(`users/${userId}/videos/${videoId}`)
          .update({translation, status: "translated"});

        logger.info("Translation saved to Firestore.");
      } catch (err) {
        logger.error(
          `Translation failed: ${err instanceof Error ? err.message : err}`
        );
        await admin
          .firestore()
          .doc(`users/${userId}/videos/${videoId}`)
          .update({
            translationError: err instanceof Error ? err.message : String(err),
          });
      }
    } else {
      logger.info(
        `videoId: ${videoId} status wasn't 'transcribed'`
      );
    }

    return null;
  }
);
