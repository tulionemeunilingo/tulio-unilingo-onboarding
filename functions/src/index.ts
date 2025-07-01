import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";

admin.initializeApp();
const app = express();
app.use(cors({ origin: true }));

exports.api = functions.https.onRequest(app);
