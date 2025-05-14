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

// src/updateDailyStats.ts
var updateDailyStats_exports = {};
__export(updateDailyStats_exports, {
  updateDailyStats: () => updateDailyStats
});
module.exports = __toCommonJS(updateDailyStats_exports);
var import_functions_framework = require("@google-cloud/functions-framework");

// src/lib/firestore.ts
var import_firestore = require("@google-cloud/firestore");
var db = new import_firestore.Firestore({ ignoreUndefinedProperties: true });

// src/updateDailyStats.ts
var import_firestore3 = require("@google-cloud/firestore");
var updateDailyStats = (0, import_functions_framework.http)("updateDailyStats", async (req, res) => {
  console.log("updateDailyStats: Function triggered. Calculating daily stats...");
  try {
    const usersAggregate = await db.collection("users").count().get();
    const totalUsers = usersAggregate.data().count;
    const twentyFourHoursAgo = import_firestore3.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1e3));
    const recentSnapshotsAttemptedQuery = db.collectionGroup("audit").where("type", "==", "snapshot_created").where("timestamp", ">=", twentyFourHoursAgo).count().get();
    const recentSnapshotsSuccessfulQuery = db.collectionGroup("audit").where("type", "==", "snapshot_created").where("details.status", "==", "success").where("timestamp", ">=", twentyFourHoursAgo).count().get();
    const [attemptedSnapshotData, successfulSnapshotData] = await Promise.all([
      recentSnapshotsAttemptedQuery,
      recentSnapshotsSuccessfulQuery
    ]);
    const totalSnapshotsAttempted24h = attemptedSnapshotData.data().count;
    const totalSnapshotsSuccessful24h = successfulSnapshotData.data().count;
    const backupSuccessRate24h = totalSnapshotsAttempted24h > 0 ? totalSnapshotsSuccessful24h / totalSnapshotsAttempted24h * 100 : 100;
    const allSuccessfulSnapshotsQuery = db.collectionGroup("audit").where("type", "==", "snapshot_created").where("details.status", "==", "success").count().get();
    const totalSuccessfulSnapshots = (await allSuccessfulSnapshotsQuery).data().count;
    const dailyStats = {
      totalUsers,
      totalSnapshotsAttemptedLast24h: totalSnapshotsAttempted24h,
      totalSnapshotsSuccessfulLast24h: totalSnapshotsSuccessful24h,
      backupSuccessRateLast24h: parseFloat(backupSuccessRate24h.toFixed(2)),
      totalSuccessfulSnapshotsStored: totalSuccessfulSnapshots,
      // Proxy for pages stored
      lastUpdated: import_firestore3.Timestamp.now()
    };
    await db.collection("stats").doc("daily").set(dailyStats);
    console.log("updateDailyStats: Daily stats updated successfully:", dailyStats);
    res.status(200).send("Daily stats updated successfully.");
  } catch (error) {
    console.error("updateDailyStats: Error updating daily stats:", error);
    res.status(500).send("Error updating daily stats.");
  }
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  updateDailyStats
});
