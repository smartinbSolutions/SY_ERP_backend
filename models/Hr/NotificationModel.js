const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "staff",
    },

    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "staff",
    },

    title: String,
    message: String,

    entity: {
      id: mongoose.Schema.Types.ObjectId,
      model: String,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("HrNotification", notificationSchema);
