const mongoose = require("mongoose");

const leadModel = require("../../models/CRM/leadModel");
const contactModel = require("../../models/CRM/contactModel");
const companyModel = require("../../models/CRM/companyModel");
const opportunityModel = require("../../models/CRM/opportunityModel");
const pipelineModel = require("../../models/CRM/piplineModel");

const {
  createExitCriteriaStatus,
  createRequiredActionsStatus,
} = require("./opportunity.service");

const ApiError = require("../../utils/apiError");

// ======================================================
// CALCULATE BANT SCORE
// ======================================================

exports.calculateBantScore = (bant = {}) => {
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

// ======================================================
// GET ALL
// ======================================================

exports.getAllLeads = async (req) => {
  const companyId = req.companyId;

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const { keyword, status, source, ownerId } = req.query;

  const query = {
    companyId,
    deletedAt: null,
  };

  if (keyword) {
    query.$or = [
      { firstName: { $regex: keyword, $options: "i" } },
      { lastName: { $regex: keyword, $options: "i" } },
      { email: { $regex: keyword, $options: "i" } },
      { phone: { $regex: keyword, $options: "i" } },
      { companyName: { $regex: keyword, $options: "i" } },
    ];
  }

  if (status) query.status = status;
  if (source) query.source = source;
  if (ownerId) query.ownerId = ownerId;

  const [total, leads] = await Promise.all([
    leadModel.countDocuments(query),

    leadModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("ownerId", "name email"),
  ]);

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: leads.length,
    total,
    data: leads,
  };
};

// ======================================================
// GET ONE
// ======================================================

exports.getOneLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const lead = await leadModel
    .findOne({
      _id: id,
      companyId,
      deletedAt: null,
    })

    // Lead owner
    .populate("ownerId", "name email firstName lastName username")

    // Converted contact
    .populate(
      "convertedTo.contactId",
      "firstName lastName email phone jobTitle companyId",
    )

    // Converted CRM company
    .populate("convertedTo.crmCompanyId", "name industry website phone email")

    // Converted opportunity
    .populate(
      "convertedTo.opportunityId",
      "title value currency status pipelineId expectedCloseDate ownerId",
    )

    .populate(
      "bant.authority.decisionMakerId",
      "firstName lastName email phone",
    )

    // User who converted the lead
    .populate(
      "convertedTo.convertedBy",
      "name email firstName lastName username",
    );

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  return lead;
};

// ======================================================
// CREATE
// ======================================================

exports.createLead = async (req) => {
  const companyId = req.companyId;

  // ----------------------------------------------------
  // Check duplicate email
  // ----------------------------------------------------

  if (req.body.email) {
    const exists = await leadModel.findOne({
      companyId,
      email: req.body.email,
      deletedAt: null,
    });

    if (exists) {
      throw new ApiError("A lead with this email already exists", 400);
    }
  }

  // ----------------------------------------------------
  // Build payload
  // ----------------------------------------------------

  const payload = {
    ...req.body,

    companyId,
    ownerId: req.user._id,
    deletedAt: null,

    // Every newly created lead starts as NEW.
    // Frontend cannot control this.
    status: "new",
  };

  // ----------------------------------------------------
  // Calculate BANT score
  // ----------------------------------------------------

  // Never trust BANT score from frontend
  payload.bant = payload.bant || {};

  const bantScore = exports.calculateBantScore(payload.bant);

  payload.bant.score = bantScore;

  // IMPORTANT:
  // BANT does NOT qualify a brand-new lead.
  // The lead must first become "contacted".
  //
  // Therefore:
  // new lead -> always "new"

  const lead = await leadModel.create(payload);

  return lead;
};

// ======================================================
// UPDATE
// ======================================================

exports.updateLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  // ----------------------------------------------------
  // Check duplicate email
  // ----------------------------------------------------

  if (req.body.email) {
    const exists = await leadModel.findOne({
      companyId,
      email: req.body.email,
      _id: { $ne: id },
      deletedAt: null,
    });

    if (exists) {
      throw new ApiError("A lead with this email already exists", 400);
    }
  }

  // ----------------------------------------------------
  // Get existing lead
  // ----------------------------------------------------

  const existingLead = await leadModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!existingLead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  // ----------------------------------------------------
  // Converted leads cannot be updated
  // ----------------------------------------------------

  if (existingLead.status === "converted") {
    throw new ApiError("A converted lead cannot be updated", 400);
  }

  const updateData = { ...req.body };
  console.log("UPDATE LEAD BODY:", req.body);
  console.log("UPDATE LEAD DATA:", updateData);
  // ----------------------------------------------------
  // Protected fields
  // ----------------------------------------------------

  delete updateData.companyId;
  delete updateData.deletedAt;
  delete updateData.ownerId;

  // ----------------------------------------------------
  // Status is controlled by the Lead lifecycle
  // ----------------------------------------------------

  if (updateData.status) {
    throw new ApiError(
      "Lead status is managed by the CRM lifecycle and cannot be changed directly",
      400,
    );
  }

  // ----------------------------------------------------
  // Recalculate BANT when BANT is updated
  // ----------------------------------------------------

  if (updateData.bant) {
    const updatedBant = {
      ...existingLead.bant?.toObject?.(),
      ...updateData.bant,

      budget: {
        ...existingLead.bant?.budget?.toObject?.(),
        ...updateData.bant.budget,
      },

      authority: {
        ...existingLead.bant?.authority?.toObject?.(),
        ...updateData.bant.authority,
      },

      need: {
        ...existingLead.bant?.need?.toObject?.(),
        ...updateData.bant.need,
      },

      timeline: {
        ...existingLead.bant?.timeline?.toObject?.(),
        ...updateData.bant.timeline,
      },
    };

    const bantScore = exports.calculateBantScore(updatedBant);

    updatedBant.score = bantScore;

    updateData.bant = updatedBant;
    if (existingLead.status === "qualified") {
      if (bantScore <= 6) {
        updateData.status = "contacted";
      }
    }
  }

  // ----------------------------------------------------
  // Update lead
  // ----------------------------------------------------

  const lead = await leadModel.findOneAndUpdate(
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

  return lead;
};

// ======================================================
// CONVERT LEAD
// ======================================================

exports.convertLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  // ----------------------------------------------------
  // 1. Find Lead
  // ----------------------------------------------------

  const lead = await leadModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  // ----------------------------------------------------
  // 2. Validate conversion
  // ----------------------------------------------------

  if (lead.convertedTo?.contactId || lead.convertedTo?.opportunityId) {
    throw new ApiError("This lead has already been converted", 400);
  }

  // Only qualified leads can be converted
  if (lead.status !== "qualified") {
    throw new ApiError("Only qualified leads can be converted", 400);
  }

  // ----------------------------------------------------
  // 3. Qualification check
  //
  // BANT score > 6  → Qualified → continue conversion
  // BANT score <= 6 → Unqualified → block conversion
  // ----------------------------------------------------

  const bantScore = exports.calculateBantScore(lead.bant || {});

  if (bantScore <= 6) {
    throw new ApiError(
      `This lead is unqualified and cannot be converted. BANT score: ${bantScore}`,
      400,
    );
  }

  // ====================================================
  // 4. Company handling (OPTIONAL)
  // ====================================================

  let crmCompany = null;

  const { companyOption, selectedCrmCompanyId, companyData } = req.body;

  // Existing company
  if (companyOption === "existing") {
    if (!selectedCrmCompanyId) {
      throw new ApiError("Company ID is required", 400);
    }

    crmCompany = await companyModel.findOne({
      _id: selectedCrmCompanyId,
      companyId,
      deletedAt: null,
    });

    if (!crmCompany) {
      throw new ApiError("Company not found", 404);
    }
  }

  // Create new company
  if (companyOption === "create") {
    if (!companyData?.name) {
      throw new ApiError("Company name is required", 400);
    }

    crmCompany = await companyModel.create({
      ...companyData,
      companyId,
      deletedAt: null,
    });
  }

  // No company
  if (
    companyOption !== "existing" &&
    companyOption !== "create" &&
    companyOption !== "none"
  ) {
    throw new ApiError("Invalid company option", 400);
  }

  // ====================================================
  // 5. Contact handling (REQUIRED)
  // ====================================================

  let contact = null;

  const { contactOption, contactId, contactData } = req.body;

  // Existing contact
  if (contactOption === "existing") {
    if (!contactId) {
      throw new ApiError("Contact ID is required", 400);
    }

    contact = await contactModel.findOne({
      _id: contactId,
      companyId,
      deletedAt: null,
    });

    if (!contact) {
      throw new ApiError("Contact not found", 404);
    }

    // Attach company if empty
    if (crmCompany && !contact.crmCompanyId) {
      contact.crmCompanyId = crmCompany._id;
      await contact.save();
    }

    // Prevent moving contact
    if (
      crmCompany &&
      contact.crmCompanyId &&
      contact.crmCompanyId.toString() !== crmCompany._id.toString()
    ) {
      throw new ApiError("Contact already belongs to another company", 400);
    }
  }

  // Create new contact
  if (contactOption === "create") {
    const data = contactData || {};

    if (!data.firstName || !data.lastName || !data.email) {
      throw new ApiError("First name, last name and email are required", 400);
    }

    const existingContact = await contactModel.findOne({
      companyId,
      email: data.email,
      deletedAt: null,
    });

    if (existingContact) {
      throw new ApiError("A contact with this email already exists", 400);
    }

    contact = await contactModel.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      jobTitle: data.jobTitle,
      companyId,
      crmCompanyId: crmCompany?._id || null,
      source: data.source || "other",
      status: "active",
      tags: data.tags || [],
      notes: data.notes,
    });
  }

  if (!contact) {
    throw new ApiError("Contact is required for conversion", 400);
  }

  // ====================================================
  // 6. Pipeline
  // ====================================================

  const requestedPipelineId = req.body.pipelineId;

  let pipeline;

  if (requestedPipelineId) {
    if (!mongoose.Types.ObjectId.isValid(requestedPipelineId)) {
      throw new ApiError("Invalid pipeline ID", 400);
    }

    pipeline = await pipelineModel.findOne({
      _id: requestedPipelineId,
      companyId,
      isActive: true,
      deletedAt: null,
    });
  } else {
    pipeline = await pipelineModel.findOne({
      companyId,
      isDefault: true,
      isActive: true,
      deletedAt: null,
    });
  }

  if (!pipeline) {
    throw new ApiError("No active pipeline was found", 400);
  }

  const firstStage = [...pipeline.stages].sort((a, b) => a.order - b.order)[0];

  if (!firstStage) {
    throw new ApiError("Pipeline has no stages", 400);
  }

  // ====================================================
  // 7. Create Opportunity
  // ====================================================

  const opportunity = await opportunityModel.create({
    title: req.body.title || `${lead.firstName} ${lead.lastName} Opportunity`,

    description: req.body.description || lead.notes,

    value: req.body.value ?? lead.bant?.budget?.amount ?? 0,

    currency: req.body.currency || "USD",

    pipelineId: pipeline._id,

    currentStageKey: firstStage.key,

    currentStageOrder: firstStage.order,

    probability: firstStage.probability,

    stageHistory: [
      {
        stageKey: firstStage.key,
        stageName: firstStage.name,
        enteredAt: new Date(),
      },
    ],

    exitCriteriaStatus: createExitCriteriaStatus(firstStage),

    requiredActionsStatus: createRequiredActionsStatus(firstStage),

    crmCompanyId: crmCompany?._id || null,

    contactIds: [contact._id],

    ownerId: lead.ownerId,

    leadId: lead._id,

    status: "open",

    bant: lead.bant,

    tags: lead.tags || [],

    companyId,
  });

  // ====================================================
  // 8. Update Lead
  // ====================================================

  lead.status = "converted";

  lead.convertedTo = {
    contactId: contact._id,
    crmCompanyId: crmCompany?._id || null,
    opportunityId: opportunity._id,
    convertedAt: new Date(),
    convertedBy: req.user?._id || req.user?.userId || req.user?.id,
  };

  await lead.save();

  // ====================================================
  // 9. Return result
  // ====================================================

  return {
    lead,
    contact,
    company: crmCompany,
    opportunity,
  };
};

// QUALIFY LEAD
exports.qualifyLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const lead = await leadModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  if (lead.status !== "contacted") {
    throw new ApiError("Only contacted leads can be qualified", 400);
  }

  if (!lead.bant || Number(lead.bant.score || 0) <= 6) {
    throw new ApiError(
      "Lead must have a BANT score greater than 6 to be qualified",
      400,
    );
  }

  lead.status = "qualified";

  await lead.save();

  return lead;
};
exports.markLeadAsLost = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;
  const { lostReason } = req.body;

  const lead = await leadModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  if (!["contacted", "qualified"].includes(lead.status)) {
    throw new ApiError(
      "Only contacted or qualified leads can be marked as lost",
      400,
    );
  }

  if (!lostReason?.trim()) {
    throw new ApiError("Lost reason is required", 400);
  }

  lead.status = "lost";
  lead.lostReason = lostReason.trim();

  await lead.save();

  return lead;
};

// ======================================================
// DELETE (SOFT)
// ======================================================

exports.deleteLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const lead = await leadModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  // Cannot delete a converted lead
  if (
    lead.convertedTo?.contactId ||
    lead.convertedTo?.crmCompanyId ||
    lead.convertedTo?.opportunityId
  ) {
    throw new ApiError(
      "Cannot delete lead because it is related to other entities",
      400,
    );
  }

  lead.deletedAt = new Date();

  await lead.save();

  return "Lead deleted successfully";
};
