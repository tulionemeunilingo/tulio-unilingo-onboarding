import * as admin from "firebase-admin";
import {transcribeOnCreate} from "./transcriber";
import {translatorOnUpdate} from "./translator";
import {synthesizerOnUpdate} from "./synthesizer";
import {alignerOnUpdate} from "./aligner";

export {
  transcribeOnCreate,
  translatorOnUpdate,
  synthesizerOnUpdate,
  alignerOnUpdate,
};

admin.initializeApp();
