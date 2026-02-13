// models/LeaveRequest.js

const mongoose = require("mongoose");

const leaveRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    leaveType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Leave",
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    attachment: {
      type: String,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true, // إذا كل موظف يجب أن يكون لديه مدير
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("LeaveRequest", leaveRequestSchema);
