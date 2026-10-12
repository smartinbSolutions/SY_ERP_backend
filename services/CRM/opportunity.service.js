const opportunityModel = require("../../models/CRM/opportunityModel");
const pipelineModel = require("../../models/CRM/piplineModel");
const companyModel = require("../../models/CRM/companyModel");
const contactModel = require("../../models/CRM/contactModel");
const leadModel = require("../../models/CRM/leadModel");
const ApiError = require("../../utils/apiError");

// ============ GET ALL ============
exports.getAllOpportunities = async (req) => {
  const companyId = req.companyId;

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const { keyword, status, pipelineId, ownerId } = req.query;

  const query = {
    companyId,
    deletedAt: null,
  };

  if (keyword) {
    query.$or = [
      { title: { $regex: keyword, $options: "i" } },
      { description: { $regex: keyword, $options: "i" } },
    ];
  }

  if (status) query.status = status;
  if (pipelineId) query.pipelineId = pipelineId;
  if (ownerId) query.ownerId = ownerId;

  const [total, opportunities] = await Promise.all([
    opportunityModel.countDocuments(query),

    opportunityModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("ownerId", "name email")
      .populate("pipelineId", "name")
      .populate("leadId", "name")
      .populate("dealId", "title value status")
      .populate("crmCompanyId", "name email")
      .populate("contactIds", "firstName lastName email phone"),
  ]);

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: opportunities.length,
    total,
    data: opportunities,
  };
};

// ============ GET ONE ============
exports.getOneOpportunity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const opportunity = await opportunityModel
    .findOne({
      _id: id,
      companyId,
      deletedAt: null,
    })
    .populate("ownerId", "name email")
    .populate("tags", "name")
    .populate("pipelineId", "name stages settings")
    .populate("contactIds", "firstName lastName email phone")
    .populate("leadId", "name email")
    .populate("dealId", "title value status")
    .populate({
      path: "stageHistory.movedBy",
      select: "name email",
    })
    .populate("contactIds", "firstName lastName email phone");

  if (!opportunity) {
    throw new ApiError(`No opportunity found with this ID: ${id}`, 404);
  }

  return opportunity;
};

// ============ HELPERS ============

const calculateBantScore = (bant = {}) => {
  let score = 0;

  // Budget: 0 - 3
  if (bant.budget) {
    if (bant.budget.confirmed) {
      score += 3;
    } else if (bant.budget.amount > 0) {
      score += 2;
    } else if (bant.budget.notes?.trim()) {
      score += 1;
    }
  }

  // Authority: 0 - 3
  if (bant.authority) {
    if (bant.authority.isDecisionMaker) {
      score += 3;
    } else if (
      bant.authority.decisionMakerName?.trim() ||
      bant.authority.notes?.trim()
    ) {
      score += 2;
    } else {
      score += 1;
    }
  }

  // Need: 0 - 3
  if (bant.need) {
    const hasPainPoint = Boolean(bant.need.painPoint?.trim());
    const hasImpact = Boolean(bant.need.impact?.trim());
    const urgency = bant.need.urgency;

    if (hasPainPoint && hasImpact && urgency === "high") {
      score += 3;
    } else if (hasPainPoint && hasImpact) {
      score += 2;
    } else if (hasPainPoint || hasImpact) {
      score += 1;
    }
  }

  // Timeline: 0 - 3
  if (bant.timeline) {
    const hasDates = bant.timeline.expectedStart || bant.timeline.deadline;

    const urgency = bant.timeline.urgency;

    if (urgency === "urgent" || bant.timeline.deadline) {
      score += 3;
    } else if (urgency === "quarter" || urgency === "year") {
      score += 2;
    } else if (hasDates || urgency === "someday") {
      score += 1;
    }
  }

  return Math.min(score, 12);
};

const validatePipeline = async (pipelineId, companyId) => {
  const pipeline = await pipelineModel.findOne({
    _id: pipelineId,
    companyId,
    deletedAt: null,
    isActive: true,
  });

  if (!pipeline) {
    throw new ApiError(
      "Pipeline not found, inactive, deleted, or does not belong to this company",
      404,
    );
  }

  if (!pipeline.stages || pipeline.stages.length === 0) {
    throw new ApiError("Pipeline has no stages", 400);
  }

  return pipeline;
};

const getPipelineStage = (pipeline, stageKey) => {
  const stage = pipeline.stages.find(
    (item) => item.key === String(stageKey).toLowerCase(),
  );

  if (!stage) {
    throw new ApiError(
      `Stage "${stageKey}" does not exist in this pipeline`,
      400,
    );
  }

  return stage;
};

const validateStageOrder = (stage, currentStageOrder) => {
  if (Number(currentStageOrder) !== Number(stage.order)) {
    throw new ApiError(
      `Stage order does not match the selected stage. Expected ${stage.order}`,
      400,
    );
  }
};

const validateCRMCompany = async (crmCompanyId, companyId) => {
  if (!crmCompanyId) return null;

  const company = await companyModel.findOne({
    _id: crmCompanyId,
    companyId,
    deletedAt: null,
  });

  if (!company) {
    throw new ApiError(
      "CRM Company not found, deleted, or does not belong to this company",
      404,
    );
  }

  return company;
};

const validateContacts = async (contactIds, companyId, crmCompanyId = null) => {
  if (!contactIds || contactIds.length === 0) {
    return [];
  }

  const contacts = await contactModel.find({
    _id: { $in: contactIds },
    companyId,
    deletedAt: null,
  });

  if (contacts.length !== contactIds.length) {
    throw new ApiError(
      "One or more contacts were not found, deleted, or do not belong to this company",
      404,
    );
  }

  if (crmCompanyId) {
    const invalidContact = contacts.find(
      (contact) =>
        contact.crmCompanyId &&
        String(contact.crmCompanyId) !== String(crmCompanyId),
    );

    if (invalidContact) {
      throw new ApiError(
        "All contacts must belong to the selected CRM Company",
        400,
      );
    }
  }

  return contacts;
};

const validateLead = async (leadId, companyId) => {
  if (!leadId) return null;

  const lead = await leadModel.findOne({
    _id: leadId,
    companyId,
    deletedAt: null,
  });

  if (!lead) {
    throw new ApiError(
      "Lead not found, deleted, or does not belong to this company",
      404,
    );
  }

  return lead;
};

const calculateProductTotal = (product) => {
  const quantity = Number(product.quantity || 0);
  const unitPrice = Number(product.unitPrice || 0);
  const discount = Number(product.discount || 0);

  const subtotal = quantity * unitPrice;
  const discountAmount = subtotal * (discount / 100);

  return Math.max(0, subtotal - discountAmount);
};

const calculateProducts = (products = []) => {
  return products.map((product) => ({
    ...product,
    total: calculateProductTotal(product),
  }));
};

const calculateProductsValue = (products = []) => {
  return products.reduce((sum, product) => sum + Number(product.total || 0), 0);
};

const getCurrentUserId = (req) => {
  return req.user?._id || req.user?.id || null;
};

const createInitialStageHistory = (stage, userId) => {
  return [
    {
      stageKey: stage.key,
      stageName: stage.name,
      enteredAt: new Date(),
      movedBy: userId || undefined,
    },
  ];
};

exports.createExitCriteriaStatus = (stage) => {
  return (stage.exitCriteria || []).map((criteria) => ({
    criteria,
    isCompleted: false,
    completedAt: null,
  }));
};

exports.createRequiredActionsStatus = (stage) => {
  return (stage.requiredActions || []).map((action) => ({
    type: action.type,
    title: action.title,
    isMandatory: action.isMandatory,
    isCompleted: false,
    completedAt: null,
  }));
};

const calculateDurationDays = (enteredAt, exitedAt) => {
  const milliseconds = exitedAt.getTime() - enteredAt.getTime();

  return Math.max(0, milliseconds / (1000 * 60 * 60 * 24));
};

const validateStageExit = (opportunity, currentStage, pipeline) => {
  if (!pipeline.settings?.requireExitCriteria) {
    return;
  }

  const incompleteCriteria = (opportunity.exitCriteriaStatus || []).filter(
    (item) => !item.isCompleted,
  );

  if (incompleteCriteria.length) {
    throw new ApiError(
      "Cannot move to the next stage. All exit criteria must be completed first.",
      400,
    );
  }

  const incompleteMandatoryActions = (
    opportunity.requiredActionsStatus || []
  ).filter((item) => item.isMandatory && !item.isCompleted);

  if (incompleteMandatoryActions.length) {
    throw new ApiError(
      "Cannot move to the next stage. All mandatory actions must be completed first.",
      400,
    );
  }
};

const validateStageTransition = (
  opportunity,
  currentStage,
  newStage,
  pipeline,
) => {
  if (currentStage.key === newStage.key) {
    return;
  }

  validateStageExit(opportunity, currentStage, pipeline);

  if (pipeline.settings?.allowSkipStages !== true) {
    if (Number(newStage.order) !== Number(currentStage.order) + 1) {
      throw new ApiError("You cannot skip stages in this pipeline", 400);
    }
  }
};

const buildStageHistory = (opportunity, newStage, userId) => {
  const history = [...(opportunity.stageHistory || [])];

  const now = new Date();

  const lastHistory = history[history.length - 1];

  if (lastHistory && !lastHistory.exitedAt) {
    lastHistory.exitedAt = now;

    lastHistory.durationDays = calculateDurationDays(
      new Date(lastHistory.enteredAt),
      now,
    );
  }

  history.push({
    stageKey: newStage.key,
    stageName: newStage.name,
    enteredAt: now,
    movedBy: userId || undefined,
  });

  return history;
};

const handleStatusChange = (updateData) => {
  if (!Object.prototype.hasOwnProperty.call(updateData, "status")) {
    return;
  }

  const status = updateData.status;

  if (status === "won") {
    updateData.actualCloseDate = new Date();

    delete updateData.lostReason;
    delete updateData.lostReasonCategory;

    return;
  }

  if (status === "lost") {
    const hasLostReason =
      Boolean(updateData.lostReason) || Boolean(updateData.lostReasonCategory);

    if (!hasLostReason) {
      throw new ApiError(
        "lostReason or lostReasonCategory is required when opportunity is lost",
        400,
      );
    }

    updateData.actualCloseDate = new Date();

    return;
  }

  if (status === "open") {
    updateData.actualCloseDate = null;
  }
};

// Sync opportunity status based on pipeline stage
const syncOpportunityStatusWithStage = (updateData, newStage) => {
  if (newStage.key === "closed_won") {
    updateData.status = "won";
    updateData.actualCloseDate = new Date();

    delete updateData.lostReason;
    delete updateData.lostReasonCategory;
  }

  if (newStage.key === "closed_lost") {
    if (!updateData.lostReason && !updateData.lostReasonCategory) {
      throw new ApiError(
        "Lost reason is required before moving to closed lost",
        400,
      );
    }

    updateData.status = "lost";
    updateData.actualCloseDate = new Date();
  }
};

// ============ CREATE ============
exports.createOpportunity = async (req) => {
  const companyId = req.companyId;

  const {
    pipelineId,
    currentStageKey,
    currentStageOrder,
    crmCompanyId,
    contactIds,
    leadId,
    products,
  } = req.body;

  const pipeline = await validatePipeline(pipelineId, companyId);

  const stage = getPipelineStage(pipeline, currentStageKey);

  validateStageOrder(stage, currentStageOrder);

  await validateCRMCompany(crmCompanyId, companyId);

  await validateContacts(contactIds, companyId, crmCompanyId);

  await validateLead(leadId, companyId);

  const calculatedProducts = calculateProducts(products);
  const bant = req.body.bant || {};
  bant.score = calculateBantScore(bant);

  const userId = getCurrentUserId(req);

  const payload = {
    ...req.body,
    bant,
    companyId,
    deletedAt: null,

    currentStageKey: stage.key,
    currentStageOrder: stage.order,

    probability: stage.probability,

    stageHistory: createInitialStageHistory(stage, userId),

    exitCriteriaStatus: exports.createExitCriteriaStatus(stage),

    requiredActionsStatus: exports.createRequiredActionsStatus(stage),

    products: calculatedProducts,

    value: req.body.value ?? calculateProductsValue(calculatedProducts),

    status: req.body.status || "open",

    actualCloseDate:
      req.body.status === "won" || req.body.status === "lost"
        ? new Date()
        : null,

    dealId: null,
  };

  // Sync closed stages
  syncOpportunityStatusWithStage(payload, stage);

  if (payload.status === "lost") {
    if (!payload.lostReason && !payload.lostReasonCategory) {
      throw new ApiError(
        "lostReason or lostReasonCategory is required when opportunity is lost",
        400,
      );
    }
  }

  if (payload.status === "won") {
    payload.lostReason = undefined;
    payload.lostReasonCategory = undefined;
  }

  const opportunity = await opportunityModel.create(payload);

  return opportunity;
};

// ============ UPDATE ============
exports.updateOpportunity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const opportunity = await opportunityModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!opportunity) {
    throw new ApiError(`No opportunity found with this ID: ${id}`, 404);
  }

  const updateData = {
    ...req.body,
  };

  delete updateData.companyId;
  delete updateData.deletedAt;
  delete updateData.dealId;

  const pipelineId = updateData.pipelineId || opportunity.pipelineId;

  const pipeline = await validatePipeline(pipelineId, companyId);

  // Pipeline cannot be changed after creation
  if (
    updateData.pipelineId &&
    String(updateData.pipelineId) !== String(opportunity.pipelineId)
  ) {
    throw new ApiError(
      "Changing the pipeline of an existing opportunity is not allowed",
      400,
    );
  }

  const stageChanged =
    updateData.currentStageKey !== undefined &&
    String(updateData.currentStageKey).toLowerCase() !==
      String(opportunity.currentStageKey).toLowerCase();

  let newStage = null;

  // Stage update
  if (
    updateData.currentStageKey !== undefined ||
    updateData.currentStageOrder !== undefined
  ) {
    const newStageKey =
      updateData.currentStageKey || opportunity.currentStageKey;

    newStage = getPipelineStage(pipeline, newStageKey);

    validateStageOrder(
      newStage,
      updateData.currentStageOrder ?? opportunity.currentStageOrder,
    );

    if (stageChanged) {
      const currentStage = getPipelineStage(
        pipeline,
        opportunity.currentStageKey,
      );

      validateStageTransition(opportunity, currentStage, newStage, pipeline);

      const userId = getCurrentUserId(req);

      updateData.currentStageKey = newStage.key;

      updateData.currentStageOrder = newStage.order;

      updateData.probability = newStage.probability;

      updateData.stageHistory = buildStageHistory(
        opportunity,
        newStage,
        userId,
      );

      updateData.exitCriteriaStatus =
        exports.createExitCriteriaStatus(newStage);
      updateData.requiredActionsStatus =
        exports.createRequiredActionsStatus(newStage);
    } else {
      updateData.currentStageKey = newStage.key;

      updateData.currentStageOrder = newStage.order;

      updateData.probability = newStage.probability;
    }
  }

  // Sync status with stage
  if (newStage) {
    syncOpportunityStatusWithStage(updateData, newStage);
  }

  // Validate CRM Company
  const finalCRMCompanyId =
    updateData.crmCompanyId !== undefined
      ? updateData.crmCompanyId
      : opportunity.crmCompanyId;

  await validateCRMCompany(finalCRMCompanyId, companyId);

  // Validate Contacts
  const finalContactIds =
    updateData.contactIds !== undefined
      ? updateData.contactIds
      : opportunity.contactIds;

  await validateContacts(finalContactIds, companyId, finalCRMCompanyId);

  // Validate Lead
  const finalLeadId =
    updateData.leadId !== undefined ? updateData.leadId : opportunity.leadId;

  await validateLead(finalLeadId, companyId);
  // Recalculate BANT score
  if (updateData.bant !== undefined) {
    updateData.bant = {
      ...opportunity.bant?.toObject?.(),
      ...updateData.bant,

      budget: {
        ...opportunity.bant?.budget?.toObject?.(),
        ...updateData.bant.budget,
      },

      authority: {
        ...opportunity.bant?.authority?.toObject?.(),
        ...updateData.bant.authority,
      },

      need: {
        ...opportunity.bant?.need?.toObject?.(),
        ...updateData.bant.need,
      },

      timeline: {
        ...opportunity.bant?.timeline?.toObject?.(),
        ...updateData.bant.timeline,
      },
    };

    updateData.bant.score = calculateBantScore(updateData.bant);
  }
  // Recalculate products and value
  if (updateData.products !== undefined) {
    updateData.products = calculateProducts(updateData.products);

    // Products exist -> value comes from products
    if (updateData.products.length > 0) {
      updateData.value = calculateProductsValue(updateData.products);
    }

    // No products -> keep manual value
    else {
      updateData.value =
        updateData.value !== undefined ? updateData.value : opportunity.value;
    }
  }

  // Status manual update
  handleStatusChange(updateData);

  const updatedOpportunity = await opportunityModel.findOneAndUpdate(
    {
      _id: id,
      companyId,
      deletedAt: null,
    },

    updateData,

    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedOpportunity) {
    throw new ApiError(`No opportunity found with this ID: ${id}`, 404);
  }

  return updatedOpportunity;
};

// ============ DELETE (Soft) ============
exports.deleteOpportunity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const opportunity = await opportunityModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!opportunity) {
    throw new ApiError(`No opportunity found with this ID: ${id}`, 404);
  }

  // Cannot delete opportunity converted to deal
  if (opportunity.dealId) {
    throw new ApiError(
      "Cannot delete opportunity because it has a linked deal",
      400,
    );
  }

  opportunity.deletedAt = new Date();

  await opportunity.save();

  return "Opportunity deleted successfully";
};
