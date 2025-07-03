import * as admin from "firebase-admin";
import {transcribeOnCreate} from "./transcriber";
import {translatorOnUpdate} from "./translator";
import {synthesizerOnUpdate} from "./synthesizer";

export {
  transcribeOnCreate,
  translatorOnUpdate,
  synthesizerOnUpdate,
};

admin.initializeApp();
