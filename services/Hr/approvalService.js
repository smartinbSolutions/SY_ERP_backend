const asyncHandler = require("express-async-handler");

const handleApproval = asyncHandler(async (request, userId, action, comment, session = null) => {
  if (!request.approval || !request.approval.currentApprover)
    throw new Error("Approval not configured");

  if (request.approval.currentApprover.toString() !== userId.toString())
    throw new Error("Not authorized to approve");

  //  جلب الخطوة الحالية
  const currentStepIndex = request.approval.currentStep - 1;
  const currentStep = request.approval.steps[currentStepIndex];
  if (!currentStep) throw new Error("Current step not found");

  //  تحديث حالة الخطوة الحالية
  currentStep.status = action === "approve" ? "approved" : "rejected";
  currentStep.actedBy = userId;
  currentStep.actedAt = new Date();
  currentStep.comment = comment || "";

  //  إذا تم رفض الطلب
  if (action === "reject") {
    request.status = "rejected";
    request.rejectionReason = comment || "";
    request.approval.currentApprover = null;
    await request.save({ session });
    return request;
  }

  //  البحث عن أول خطوة تالية صالحة
  const nextPendingStep = request.approval.steps.find(
    (s) => s.stepNumber > currentStep.stepNumber && s.status === "pending" && s.approverId
  );

  if (nextPendingStep) {
    request.approval.currentStep = nextPendingStep.stepNumber;
    request.approval.currentApprover = nextPendingStep.approverId;
  } else {
    request.status = "approved";
    request.approval.currentApprover = null;
    request.approvedAt = new Date();
  }

  await request.save({ session });
  return request;
});

module.exports = { handleApproval };