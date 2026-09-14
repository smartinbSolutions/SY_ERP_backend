const mongoose = require("mongoose");

const dealProductSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, min: 0, max: 100, default: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const dealSchema = new mongoose.Schema(
  {
    opportunityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Opportunity",
      required: true,
    },

    title: { type: String, required: true, trim: true },
    description: { type: String },
    value: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD", uppercase: true },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    contactIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Contact" }],
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    products: [dealProductSchema],

    closedAt: { type: Date, default: Date.now },
    expectedDeliveryDate: Date,
    actualDeliveryDate: Date,

    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled"],
      default: "pending",
    },

    invoiceId: String,
    invoiceStatus: String,

    tags: [String],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Deal", dealSchema);
