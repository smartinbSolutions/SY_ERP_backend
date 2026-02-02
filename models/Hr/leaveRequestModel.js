// models/LeaveRequest.js

const mongoose = require("mongoose");

const leaveRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
    },
    companyId: { String },
    leaveType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "leaves",
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    reason: {
      type: String,
    },
    attachment: {
      type: String,
    },
    status: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("LeaveRequest", leaveRequestSchema);
