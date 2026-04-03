const mongoose = require("mongoose");

const violationLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
      index: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    violationType: {
      type: String,
      enum: ["late", "severe_late", "absence", "early_leave", "no_punch"],
      required: true,
      index: true,
    },

    violationDate: {
      type: Date,
      required: true,
      index: true,
    },

    minutesLate: {
      type: Number,
      default: 0,
    },

    isExcused: {
      type: Boolean,
      default: false,
    },

    relatedAttendanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("ViolationLog", violationLogSchema);
