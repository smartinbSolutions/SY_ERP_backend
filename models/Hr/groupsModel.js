const mongoose = require("mongoose");

const groupsSchema = new mongoose.Schema(
  {
    // --------------------------------------------------------------------
    // 1) General Information
    // --------------------------------------------------------------------
    groupName: { type: String, required: true },
    latinName: { type: String },
    description: { type: String },

    companyId: {
      type: String,
      required: true,
      index: true,
    },

    // --------------------------------------------------------------------
    // 2) Attendance Policies
    // --------------------------------------------------------------------

    attendanceType: {
      type: String,
      enum: ["fixed", "flexible", "remote"],
      required: true,
    },
    offDays: [String],

    // ---------- (A) FIXED attendance ----------
    fixedAttendance: {
      startTime: { type: String },
      endTime: { type: String },
      breaks: { type: String },
      allowedLate: { type: Number, default: 0 },
      overtimeRules: {
        enabled: { type: Boolean, default: false },
        ratePerHour: { type: Number, default: 0 },
      },
    },

    // ---------- (B) FLEXIBLE attendance ----------
    flexibleAttendance: {
      requiredHoursPerDay: { type: Number }, // مثال: 8 ساعات
      maxClockOutTime: { type: String }, // optional
    },

    // ---------- (D) REMOTE attendance ----------
    remoteAttendance: {
      requiredHoursPerDay: { type: Number }, // optional
      taskBased: { type: Boolean, default: true },
    },

    // ---------- (E) TASK-BASED attendance ----------
    // taskAttendance: {
    //   minTasksPerDay: { type: Number, default: 0 },
    //   allowLateTaskSubmission: { type: Boolean, default: true },
    //   offDays: [String],
    // },

    // --------------------------------------------------------------------
    // 3) Leave Policies
    // --------------------------------------------------------------------
    leavePolicy: [{
      type: { type: String, enum: ["annual", "unpaid", "mixed"] },
      maxAnnualLeaves: { type: Number, default: 0 },
      carryLeaves: { type: Boolean, default: false },
      isPaid: { type: Boolean, default: true },
    }],

    // --------------------------------------------------------------------
    // 4) Salary & Finance
    // --------------------------------------------------------------------

    advance: {
      enabled: { type: Boolean, default: false },
      advanceRate: { type: Number },
    },

    bonus: {
      enabled: { type: Boolean, default: false },
      bonusRate: { type: Number },
    },

    payday: {
      start: { type: Number }, // day nuamber
      end: { type: Number },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Groups", groupsSchema);
