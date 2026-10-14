const mongoose = require("mongoose");

const dealProductSchema = new mongoose.Schema(
  {
    product: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true },
);

const dealSchema = new mongoose.Schema(
  {
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Opportunity",
      required: true,
      index: true,
    },
    number: { type: String, trim: true },
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
    },

    // Official Deal value.
    // It is independent from the total of products.
    value: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: "USD",
      uppercase: true,
    },

    companyId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    crmCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },

    contactIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Contact",
      },
    ],

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    products: [dealProductSchema],

    expectedDeliveryDate: {
      type: Date,
    },

    actualDeliveryDate: {
      type: Date,
      default: null,
    },

    closedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled"],
      default: "pending",
    },

    invoiceId: {
      type: String,
    },

    invoiceStatus: {
      type: String,
    },

    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

dealSchema.index({ companyId: 1, status: 1 });
dealSchema.index({ companyId: 1, ownerId: 1 });
dealSchema.index({ companyId: 1, crmCompanyId: 1 });
dealSchema.index({ companyId: 1, opportunityId: 1 });
dealSchema.index({ companyId: 1, closedAt: -1 });
dealSchema.index({ companyId: 1, deletedAt: 1 });
dealSchema.index({ companyId: 1, number: 1 }, { unique: true });

module.exports = mongoose.model("Deal", dealSchema);
