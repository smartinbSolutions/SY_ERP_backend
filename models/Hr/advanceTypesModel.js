const mongoose = require("mongoose");

const advanceTypeSchema = new mongoose.Schema(
  {
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdvancePolicy",
      required: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    typeKey: {
      type: String,
      enum: ["monthly", "emergency"],
      required: true,
    },

    maxPercentageOfSalary: {
      type: Number,
      required: true,
    },

    requiresAttachment: {
      type: Boolean,
      default: false,
    },

    allowInstallments: {
      type: Boolean,
      default: false,
    },

    maxMonthsInstallments: {
      type: Number,
      default: null,
      validate: {
        validator: function (value) {
          if (!this.allowInstallments) return value === null;
          return value > 0;
        },
        message:
          "maxMonthsInstallments required when allowInstallments is true",
      },
    },

    maxInstallmentPercentage: {
      type: Number,
      default: 0.15,
    },

    minMonthsAfterJoin: {
      type: Number,
      default: 3,
    },
  },
  {
    timestamps: true,
  },
);

advanceTypeSchema.index({ policyId: 1, typeKey: 1 }, { unique: true });

module.exports = mongoose.model("AdvanceType", advanceTypeSchema);
