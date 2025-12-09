const mongoose = require("mongoose");

const monthMetaSchema = {
  relocatedFrom: { type: Boolean, default: false },
  relocatedTo: { type: Boolean, default: false },
  amountFrom: { type: Number, default: 0 },
  amountTo: { type: Number, default: 0 },
  netChange: { type: Number, default: 0 },
};

const quarterMetaSchema = {
  relocatedFrom: { type: Boolean, default: false },
  relocatedTo: { type: Boolean, default: false },
  amountFrom: { type: Number, default: 0 },
  amountTo: { type: Number, default: 0 },
  netChange: { type: Number, default: 0 },
};

const budgetSchema = new mongoose.Schema(
  {
    date: String,
    companyId: String,
    employee: String,
    name: String,

    budgetCategory: {
      type: String,
      enum: ["profitLoss", "balanceSheet"],
      required: true,
    },

    status: { type: String, enum: ["draft", "approved"], default: "draft" },

    budgetType: { type: String, default: "Months" },

    movementLogs: [
      {
        accountId: String,
        fromPeriod: String,
        fromName: String,
        fromCode: String,
        toPeriod: [],
        amount: Number,
        date: { type: Date, default: Date.now },
        employee: String,
        note: String,
      },
    ],

    account: [
      {
        name: String,
        accountType: String,
        amount: Number,

        balanceType: {
          type: String,
          enum: ["debit", "credit", "debit/credit"],
        },

        accountId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "AccountingTree",
        },

        // MONTHLY
        monthly: {
          jan: { type: Number, default: 0 },
          feb: { type: Number, default: 0 },
          mar: { type: Number, default: 0 },
          apr: { type: Number, default: 0 },
          may: { type: Number, default: 0 },
          jun: { type: Number, default: 0 },
          jul: { type: Number, default: 0 },
          aug: { type: Number, default: 0 },
          sep: { type: Number, default: 0 },
          oct: { type: Number, default: 0 },
          nov: { type: Number, default: 0 },
          dec: { type: Number, default: 0 },
        },

        // MONTHLY META
        monthlyMeta: {
          jan: { ...monthMetaSchema },
          feb: { ...monthMetaSchema },
          mar: { ...monthMetaSchema },
          apr: { ...monthMetaSchema },
          may: { ...monthMetaSchema },
          jun: { ...monthMetaSchema },
          jul: { ...monthMetaSchema },
          aug: { ...monthMetaSchema },
          sep: { ...monthMetaSchema },
          oct: { ...monthMetaSchema },
          nov: { ...monthMetaSchema },
          dec: { ...monthMetaSchema },
        },

        // QUARTERLY META — FIXED!
        quarterlyMeta: {
          Q1: { ...quarterMetaSchema },
          Q2: { ...quarterMetaSchema },
          Q3: { ...quarterMetaSchema },
          Q4: { ...quarterMetaSchema },
        },

        // YEARLY
        yearly: {
          type: Map,
          of: Number,
          default: {},
        },

        yearlyMeta: {
          type: Map,
          of: {
            relocatedFrom: { type: Boolean, default: false },
            relocatedTo: { type: Boolean, default: false },
            amountFrom: { type: Number, default: 0 },
            amountTo: { type: Number, default: 0 },
            netChange: { type: Number, default: 0 },
          },
          default: () => new Map(),
        },

        parentId: String,
        parentCode: String,
        code: String,
        total: { type: Number, default: 0 },

        _id: false,
      },
    ],
  },
  { timestamps: true }
);

// Auto initialize yearlyMeta keys based on yearly keys
budgetSchema.pre("save", function (next) {
  if (!this.account) return next();

  this.account.forEach((acc) => {
    if (!acc.yearly) return;

    // Ensure yearlyMeta map exists
    if (!acc.yearlyMeta) acc.yearlyMeta = new Map();

    // Create a meta object for each year if missing
    acc.yearly.forEach((_, year) => {
      if (!acc.yearlyMeta.has(year)) {
        acc.yearlyMeta.set(year, {
          relocatedFrom: false,
          relocatedTo: false,
          amountFrom: 0,
          amountTo: 0,
          netChange: 0,
        });
      }
    });
  });

  next();
});
module.exports = mongoose.model("budget", budgetSchema);
