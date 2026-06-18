const mongoose = require("mongoose");

const UnTracedproductLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["in", "out"],
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    enterPrice: {
      type: Number,
      default: 0,
    },

    outPrice: {
      type: Number,
      default: 0,
    },

    totalWithoutTax: {
      type: Number,
      default: 0,
    },

    total: {
      type: Number,
      default: 0,
    },

    tax: {
      _id: String,
      taxValue: Number,
    },

    desc: String,

    sourceModule: {
      type: String,
      enum: [
        "Purchase Invoice",
        "Purchase Invoice Cancellation",
        "Sales Invoice",
        "Refund Sales Invoice",
        "Refund Purchase Invoice",
        "Purchase Invoice Reverse Update",
        "Sales Invoice Cancellation",
        "Sales Invoice Reverse Update",
      ],
    },
    reference: { type: mongoose.Schema.ObjectId, refPath: "referenceModel" },
    referenceModel: { type: String },

    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

UnTracedproductLogSchema.index({
  companyId: 1,
  createdAt: -1,
});

module.exports = mongoose.model("unTracedproductLog", UnTracedproductLogSchema);
