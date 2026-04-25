const mongoose = require("mongoose");

const leaveLogSchema = new mongoose.Schema(
  {
    /* ===== References ===== */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
      index: true,
    },

    leaveRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveRequest",
      required: true,
      unique: true,
      index: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    /* ===== Leave Snapshot (CRITICAL) ===== */
    leaveSnapshot: {
      typeKey: {
        type: String,
        required: true, // "sick", "annual", ...
      },

      requiresAttachment: {
        type: Boolean,
        default: false,
      },

      rule: {
        name: String, // stageName / categoryName
        days: Number,
        payPercentage: Number,
      },
    },

    /* ===== Calculation Result ===== */
    calculation: {
      totalDays: {
        type: Number,
        required: true,
      },

      appliedPayPercentage: {
        type: Number,
        required: true,
      },

      ruleType: {
        type: String, // "sick_stage", "annual_rule", ...
      },
    },

    /* ===== Approval Snapshot ===== */
    approvalSnapshot: {
      flowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ApprovalFlow",
      },

      steps: [
        {
          stepNumber: Number,
          stepName: String,

          approverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "staff",
          },

          status: {
            type: String,
            enum: ["pending", "approved", "rejected", "skipped"],
          },

          actedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "staff",
          },

          actedAt: Date,

          comment: String,
        },
      ],
    },

    /* ===== Employee Snapshot ===== */
    employeeSnapshot: {
      name: String,
      // تقدر تضيف لاحقًا:
      // department: String,
      // position: String,
    },

    /* ===== Leave Duration ===== */
    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    /* ===== Approval Info ===== */
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
      required: true,
    },

    approvedAt: {
      type: Date,
      default: Date.now,
    },

    managerComment: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("LeaveLog", leaveLogSchema);
