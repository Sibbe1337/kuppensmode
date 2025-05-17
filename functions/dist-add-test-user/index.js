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

// src/testing/addTestUser.ts
var addTestUser_exports = {};
__export(addTestUser_exports, {
  addTestUser: () => addTestUser
});
module.exports = __toCommonJS(addTestUser_exports);
var import_functions_framework = require("@google-cloud/functions-framework");

// src/lib/firestore.ts
var import_firestore = require("@google-cloud/firestore");
var db = new import_firestore.Firestore({ ignoreUndefinedProperties: true });

// src/testing/addTestUser.ts
var import_firestore3 = require("@google-cloud/firestore");
var addTestUser = (0, import_functions_framework.http)("addTestUser", async (req, res) => {
  const mainFunctionName = "addTestUser";
  console.log(`${mainFunctionName}: Received request.`);
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed. Use POST.");
  }
  const {
    userId = `test-user-${Date.now()}`,
    token = "YOUR_DEFAULT_TEST_NOTION_TOKEN",
    // IMPORTANT: Replace or expect via param
    email = `${userId}@example.com`,
    name = `Test User ${userId}`
  } = req.body ?? {};
  if (!userId || !token || token === "YOUR_DEFAULT_TEST_NOTION_TOKEN") {
    console.error(`${mainFunctionName}: Missing required POST body params: userId and token (and ensure default token is replaced).`);
    return res.status(400).send("Missing required POST body params: userId and token. Provide them in the JSON request body.");
  }
  try {
    const userDocRef = db.collection("users").doc(userId);
    const userData = {
      email,
      name,
      notionAccessToken: token,
      clerkId: `test_clerk_id_${userId}`,
      createdAt: (await userDocRef.get()).exists ? (await userDocRef.get()).data()?.createdAt : import_firestore3.Timestamp.now(),
      updatedAt: import_firestore3.Timestamp.now(),
      plan: "free"
      // Default to free plan for testing
      // Add any other fields your snapshot worker might expect
    };
    await userDocRef.set(userData, { merge: true });
    console.log(`${mainFunctionName}: User document for ${userId} created/updated successfully.`);
    res.status(200).send({
      message: `User ${userId} created/updated successfully.`,
      userId,
      userData
    });
  } catch (error) {
    console.error(`${mainFunctionName}: Error creating/updating user ${userId}:`, error);
    res.status(500).json({
      error: "internal",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  addTestUser
});
