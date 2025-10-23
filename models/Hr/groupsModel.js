const mongoose = require("mongoose");

const groupsSchema = new mongoose.Schema(
  {
    // general informations

    groupName: String,
    latinName: String,
    description: String,

    // attendance

    startTime: String,
    endTime: String,
    breaks: String,
    overtimeRules: {
      enabled: { type: Boolean, default: false },
      ratePerHour: { type: Number, default: 0 },
    },
    offDays: [String],
    leavePolicy: {
      type: { type: String },
      maxAnnualLeaves: { type: Number, default: 0 },
      carryLeaves: { type: Boolean, default: false },
      isPaid: { type: Boolean, default: true },
    },

    // salaries

    advance: {
      enabled: {
        type: Boolean,
        default: false,
      },
      advanceRate: String,
    },
    bonus: {
      enabled: {
        type: Boolean,
        default: false,
      },
      bonusRate: String,
    },
    allowedLate: String,
    payloadDateStart: String,
    payloadDateEnd: String,

    companyId: {
      type: String,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Groups", groupsSchema);
