const mongoose = require("mongoose");

const LeaveSchema = new mongoose.Schema({
  /* ===== Policy Relation ===== */
  policyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LeavePolicy",
    required: true,
  },
    companyId: {
      type: String,
      required: true,
      index: true,
    },
  /* ===== Leave Type ===== */
  typeId: {
    type: Number,
    required: true,
  },

  typeKey: {
    type: String, // annual | sick | hajj | maternity | unpaid
    required: true,
  },

  requiresAttachment: {
    type: Boolean,
    default: false,
  },

  /* ===== Annual Leave Rules ===== */
  annualRules: [
    {
      categoryName: String,

      servicePeriod: {
        from: {
          value: Number,
          unit: String,
        },
        to: {
          value: Number,
          unit: String,
        },
      },

      days: Number,
      payPercentage: Number,
    },
  ],

  /* ===== Sick Leave Rules ===== */
  sickRules: [
    {
      stageName: String,
      days: Number,
      payPercentage: Number,
      requiresMedicalReport: Boolean,
      dependsOnPreviousStage: Boolean,
    },
  ],

  /* ===== Maternity Leave Rules ===== */
  maternityRules: [
    {
      childOrder: Number,

      days: Number,

      payPercentage: Number,

      gender: {
        type: String,
        enum: ["Male", "Female"],
      },
    },
  ],

  /* ===== Single / Simple Leave Rules ===== */
  singleRules: {
    days: Number,
    payPercentage: Number,
    minServicePeriod: {
      value: Number,
      unit: String,
    },
  },

  /* ===== Meta ===== */
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Leave", LeaveSchema);
