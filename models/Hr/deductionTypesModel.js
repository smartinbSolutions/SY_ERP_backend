const mongoose = require("mongoose");

const deductionTypesSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true,
    },

    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeductionPolicy",
      required: true,
      index: true,
    },

    violationType: {
      type: String,
      enum: ["late", "severe_late", "absence", "early_leave", "no_punch"],
      required: true,
    },

    resetFrequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly", "never"],
      default: "monthly",
    }, // How often the occurrence count resets

    stages: [
      {
        occurrence: {
          min: {
            type: Number,
            required: true,
          },
          max: {
            type: Number,
            default: null,
          },
        },

        actions: [
          {
            actionType: {
              type: String,
              enum: ["warning", "deduction", "escalation"],
              required: true,
            },

            deductionUnit: {
              type: String,
              enum: ["day", "hour", "minutes", "fixed"],
            },

            deductionValue: {
              type: Number,
              default: null,
            },

            escalateToHR: {
              type: Boolean,
              default: false,
            },

            note: String,
          },
        ],
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("DeductionTypes", deductionTypesSchema);
