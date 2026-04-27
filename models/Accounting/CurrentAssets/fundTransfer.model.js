const mongoose = require("mongoose");

const FundSideSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      default: "",
    },
    currencyId: {
      type: String,
      default: "",
    },
    currencyCode: {
      type: String,
      default: "",
    },
    exchangeRate: {
      type: Number,
      default: 1,
    },
    amount: {
      type: Number,
      default: 0,
    },
    amountMainCurrency: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const FundTransferSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true,
    },

    counter: {
      type: String,
      default: "0",
    },

    fromFund: {
      type: FundSideSchema,
      required: true,
    },

    toFund: {
      type: FundSideSchema,
      required: true,
    },

    transferRate: {
      type: Number,
      default: 1,
    },

    totalMainCurrency: {
      type: Number,
      default: 0,
    },

    differenceMainCurrency: {
      type: Number,
      default: 0,
    },

    differenceType: {
      type: String,
      enum: ["none", "gain", "loss"],
      default: "none",
    },

    date: {
      type: Date,
      default: null,
    },

    description: {
      type: String,
      default: "",
    },

    journalCounter: {
      type: String,
      default: "",
    },

    file: {
      type: String,
      default: "",
    },

    sync: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["posted", "cancelled"],
      default: "posted",
      index: true,
    },

    postedBy: {
      type: mongoose.Schema.ObjectId,
      ref: "Employee",
      default: null,
    },

    postedAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: mongoose.Schema.ObjectId,
      ref: "Employee",
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      default: "",
    },

    auditing: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

FundTransferSchema.index({ counter: 1, companyId: 1 }, { unique: true });

module.exports = mongoose.model("FundTransfer", FundTransferSchema);
