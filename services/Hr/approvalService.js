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

    // update current step

    currentStep.status = action === "approve" ? "approved" : "rejected";
    currentStep.actedBy = userId;
    currentStep.actedAt = new Date();
    currentStep.comment = comment || "";

    // REJECT FLOW

    if (action === "reject") {
      request.status = "rejected";
      request.rejectionReason = comment || "";
      request.approval.currentApprover = null;

      await request.save({ session });

      return {
        request,
        decision: {
          status: "rejected",
          action: "reject",
          actedBy: userId,
          step: currentStep.stepNumber,
          comment: comment || "",
          actedAt: currentStep.actedAt,
        },
      };
    }

    // NEXT STEP LOGIC

    const nextPendingStep = request.approval.steps.find(
      (s) =>
        s.stepNumber > currentStep.stepNumber &&
        s.status === "pending" &&
        s.approverId,
    );

    // FINAL APPROVAL

    if (nextPendingStep) {
      request.approval.currentStep = nextPendingStep.stepNumber;
      request.approval.currentApprover = nextPendingStep.approverId;
    } else {
      request.status = "approved";
      request.approval.currentApprover = null;
      request.approvedAt = new Date();
    }

    await request.save({ session });

    return {
      request,
      decision: {
        status: request.status,
        action: "approve",
        actedBy: userId,
        step: currentStep.stepNumber,
        approvedAt: request.approvedAt || null,
      },
    };
  },
);

module.exports = { handleApproval };
