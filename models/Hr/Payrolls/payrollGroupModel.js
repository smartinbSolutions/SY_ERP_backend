const mongoose = require("mongoose");

const payrollGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    companyId: {
      type: String,
      index: true,
    },

    policiesSnapshot: {
      leavePolicy: { type: mongoose.Schema.Types.ObjectId, ref: "LeavePolicy" },
      overtimePolicy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "OvertimePolicy",
      },
      advancePolicy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AdvancePolicy",
      },
    },

    payrollType: {
      type: String,
      enum: ["monthly", "semi-monthly", "byweekly", "weekly"],
      default: "monthly",
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PayrollGroup", payrollGroupSchema);
