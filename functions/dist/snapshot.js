"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/snapshot.ts
var snapshot_exports = {};
__export(snapshot_exports, {
  snapshotTrigger: () => snapshotTrigger
});
module.exports = __toCommonJS(snapshot_exports);
var import_functions_framework = require("@google-cloud/functions-framework");

// src/lib/firestore.ts
var import_firestore = require("@google-cloud/firestore");
var db = new import_firestore.Firestore({ ignoreUndefinedProperties: true });

// src/lib/secrets.ts
var import_secret_manager = require("@google-cloud/secret-manager");
var sm = new import_secret_manager.SecretManagerServiceClient();
async function getSecret(name) {
  const [v] = await sm.accessSecretVersion({
    name: `projects/${process.env.GOOGLE_CLOUD_PROJECT}/secrets/${name}/versions/latest`
  });
  return v.payload?.data?.toString() ?? "";
}

// src/snapshot.ts
var snapshotTrigger = (0, import_functions_framework.cloudEvent)(
  "snapshotTrigger",
  async (cloudEvent2) => {
    console.log(`Snapshot trigger received: ${cloudEvent2.id}`);
    try {
      const token = await getSecret("SOME_SECRET");
      console.log("Snapshot function logic would run here...", token, db);
    } catch (e) {
      console.error("Snapshot failed:", e);
    }
  }
);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  snapshotTrigger
});
