mongoose = require("mongoose");
const deductionTypesSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true,
    },

    violationType: {
      type: String,
      enum: ["late", "severe_late", "absence", "early_leave", "no_punch"],
      required: true,
    },

    stages: [
      {
        occurrence: {
          type: String, // "1", "2", ">3"
          required: true,
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
              enum: ["day", "hour", "fixed"],
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
