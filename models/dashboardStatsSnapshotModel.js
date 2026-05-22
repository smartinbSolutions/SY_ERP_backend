const mongoose = require("mongoose");

const dashboardStatsSnapshotSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    group: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

dashboardStatsSnapshotSchema.index({ companyId: 1, group: 1 }, { unique: true });

module.exports = mongoose.model(
  "DashboardStatsSnapshot",
  dashboardStatsSnapshotSchema
);
