const asyncHandler = require("express-async-handler");

const handleApproval = asyncHandler(
  async (request, userId, action, comment) => {
    // ================= 1. التحقق من صلاحية المستخدم =================
    if (!request.approval || !request.approval.currentApprover)
      throw new Error("Approval not configured");

    if (request.approval.currentApprover.toString() !== userId.toString())
      throw new Error("Not authorized to approve");

    // ================= 2. جلب الخطوة الحالية =================
    const currentStepIndex = request.approval.currentStep - 1;
    const currentStep = request.approval.steps[currentStepIndex];

    if (!currentStep) throw new Error("Current step not found");

    // ================= 3. تحديث خطوة الموافقة =================
    currentStep.status = action === "approve" ? "approved" : "rejected";
    currentStep.actedBy = userId;
    currentStep.actedAt = new Date();
    currentStep.comment = comment || "";

    // ================= 4. إذا كان الرفض =================
    if (action === "reject") {
      request.status = "rejected";
      request.rejectionReason = comment || "";
      request.approval.currentApprover = null;
      await request.save();
      return request;
    }

    // ================= 5. إذا كان القبول =================
    const nextStep = request.approval.steps.find(
      (s) => s.stepNumber === request.approval.currentStep + 1,
    );

    if (nextStep) {
      // تحديث الخطوة الحالية والموافق
      request.approval.currentStep += 1;
      request.approval.currentApprover = nextStep.approverId;
    } else {
      // هذا يعني انتهاء جميع الخطوات → الطلب أصبح موافق عليه بالكامل
      request.status = "approved";
      request.approval.currentApprover = null;
      request.approvedAt = new Date();
    }

    await request.save();
    return request;
  },
);

module.exports = { handleApproval };
