    const mongoose = require("mongoose");

    const employeePayrollSchema = new mongoose.Schema(
    {
        employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "staff",
        required: true,
        },

        payrollPeriodId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PayrollPeriod",
        required: true,
        },

        payrollGroupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PayrollGroup",
        required: true,
        },

        policiesSnapshot: {
        leavePolicy: { type: mongoose.Schema.Types.ObjectId, ref: "LeavePolicy" },
        overtimePolicy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "OvertimePolicy",
        },
        advancePolicy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AdvancePolicy",
        },
        },

        salaryBase: { type: Number, required: true },
        totalOvertime: { type: Number, default: 0 },
        totalLeaveDeduction: { type: Number, default: 0 },
        totalAdvanceDeduction: { type: Number, default: 0 },
        bonuses: { type: Number, default: 0 },
        netSalary: { type: Number, required: true },

        status: {
        type: String,
        enum: ["calculated", "paid", "reverted","processing"],
        default: "calculated", 
        },

        payslipGenerated: { type: Boolean, default: false },
        notes: { type: String },
    },
    { timestamps: true },
    );

    employeePayrollSchema.index(
    { employeeId: 1, payrollPeriodId: 1 },
    { unique: true },
    );

    module.exports = mongoose.model("EmployeePayroll", employeePayrollSchema);
