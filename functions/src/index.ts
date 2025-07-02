import * as admin from "firebase-admin";
import {transcribeOnCreate} from "./transcriber";
import {translatorOnUpdate} from "./translator";

export {transcribeOnCreate, translatorOnUpdate};

admin.initializeApp();
