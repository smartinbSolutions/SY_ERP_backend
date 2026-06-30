  const mongoose = require("mongoose");

  const fingerPrintSchema = new mongoose.Schema(
    {
      name: String,
      userID: { type: mongoose.Schema.Types.ObjectId, ref: "staff" },
      email: String,
      Time: String,
      date: String,

      timestamp: {
        type: Date,
        required: true,
        default: Date.now,
      },
      type: { type: String, enum: ["Check-in", "Check-out"], required: true },
      companyId: {
        type: String,
        required: true,
        index: true,
      },
    },
    { timestamps: true },
  );

  module.exports = mongoose.model("FingerPrint", fingerPrintSchema);
