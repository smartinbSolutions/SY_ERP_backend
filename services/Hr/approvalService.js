const asyncHandler = require("express-async-handler");

const handleApproval = asyncHandler(
  async (request, userId, action, comment, session = null) => {
    if (!request.approval || !request.approval.currentApprover)
      throw new Error("Approval not configured");

    if (request.approval.currentApprover.toString() !== userId.toString())
      throw new Error("Not authorized to approve");

    const currentStepIndex = request.approval.currentStep - 1;
    const currentStep = request.approval.steps[currentStepIndex];

    if (!currentStep) throw new Error("Current step not found");

    currentStep.status = action === "approve" ? "approved" : "rejected";
    currentStep.actedBy = userId;
    currentStep.actedAt = new Date();
    currentStep.comment = comment || "";

    if (action === "reject") {
      request.status = "rejected";
      request.rejectionReason = comment || "";
      request.approval.currentApprover = null;

      await request.save({ session });
      return request;
    }

    const nextStep = request.approval.steps.find(
      (s) => s.stepNumber === request.approval.currentStep + 1,
    );

    if (nextStep) {
      request.approval.currentStep += 1;
      request.approval.currentApprover = nextStep.approverId;
    } else {
      request.status = "approved";
      request.approval.currentApprover = null;
      request.approvedAt = new Date();
    }

    await request.save({ session });
    return request;
  },
);

module.exports = { handleApproval };
