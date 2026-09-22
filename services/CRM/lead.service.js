const mongoose = require("mongoose");

const leadModel = require("../../models/CRM/leadModel");
const contactModel = require("../../models/CRM/contactModel");
const companyModel = require("../../models/CRM/companyModel");
const opportunityModel = require("../../models/CRM/opportunityModel");
const pipelineModel = require("../../models/CRM/piplineModel");

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
    .populate("ownerId", "name email")
    .populate("convertedTo.contactId", "firstName lastName email")
    .populate("convertedTo.crmCompanyId", "name industry")
    .populate("convertedTo.opportunityId", "title value currency status")
    .populate("convertedTo.convertedBy", "name email");

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

  const payload = {
    ...req.body,
    companyId,
    deletedAt: null,
  };

  // Never trust BANT score from frontend
  payload.bant = payload.bant || {};

  const bantScore = exports.calculateBantScore(payload.bant);

  payload.bant.score = bantScore;

  // Automatic qualification
  if (bantScore > 6) {
    payload.status = "qualified";
  }

  const lead = await leadModel.create(payload);

  return lead;
};

// ======================================================
// UPDATE
// ======================================================

exports.updateLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

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

  const updateData = { ...req.body };

  delete updateData.companyId;
  delete updateData.deletedAt;

  const existingLead = await leadModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!existingLead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  if (existingLead.status === "converted") {
    throw new ApiError("A converted lead cannot be updated", 400);
  }

  if (updateData.status === "converted") {
    throw new ApiError(
      "A lead can only be converted using the convert action",
      400,
    );
  }

  // Recalculate BANT when BANT is updated
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

    updateData.bant = updatedBant;

    const bantScore = exports.calculateBantScore(updatedBant);

    updateData.bant.score = bantScore;

    // Automatic qualification
    if (bantScore > 6) {
      updateData.status = "qualified";
    }

    // IMPORTANT:
    // If score <= 6, we do NOT downgrade an already
    // qualified lead automatically.
  }

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
  // 3. Prevent duplicate conversion
  // ----------------------------------------------------

  if (lead.convertedTo?.contactId || lead.convertedTo?.opportunityId) {
    throw new ApiError("This lead has already been converted", 400);
  }
  // ----------------------------------------------------
  // 2. Lead must be qualified
  // ----------------------------------------------------

  if (lead.status !== "qualified") {
    throw new ApiError("Only qualified leads can be converted", 400);
  }

  // ----------------------------------------------------
  // 4. Contact requires email
  // ----------------------------------------------------

  if (!lead.email) {
    throw new ApiError("Lead must have an email before conversion", 400);
  }

  // ----------------------------------------------------
  // 5. Find or create Company
  // ----------------------------------------------------

  let crmCompany = null;

  if (lead.companyName?.trim()) {
    const companyName = lead.companyName.trim();

    crmCompany = await companyModel.findOne({
      companyId,
      deletedAt: null,
      name: {
        $regex: `^${companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
    });

    if (!crmCompany) {
      crmCompany = await companyModel.create({
        name: companyName,
        companyId,
        ownerId: lead.ownerId,
      });
    }
  }

  // ----------------------------------------------------
  // 6. Find or create Contact
  // ----------------------------------------------------

  let contact = await contactModel.findOne({
    companyId,
    email: lead.email,
    deletedAt: null,
  });

  if (contact) {
    // If the contact has no company yet,
    // connect it to the company created/found above.
    if (crmCompany && !contact.crmCompanyId) {
      contact.crmCompanyId = crmCompany._id;
      await contact.save();
    }

    // Do not silently move a contact from one
    // company to another.
    if (
      crmCompany &&
      contact.crmCompanyId &&
      contact.crmCompanyId.toString() !== crmCompany._id.toString()
    ) {
      throw new ApiError(
        "The existing contact already belongs to another company",
        400,
      );
    }
  } else {
    // Contact source does not support "social",
    // so map unsupported Lead sources to "other".
    const supportedContactSources = [
      "website",
      "referral",
      "ads",
      "cold_call",
      "event",
      "other",
    ];

    const contactSource = supportedContactSources.includes(lead.source)
      ? lead.source
      : "other";

    contact = await contactModel.create({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      jobTitle: lead.jobTitle,

      companyId,
      crmCompanyId: crmCompany?._id || null,

      ownerId: lead.ownerId,

      source: contactSource,
      status: "active",

      tags: lead.tags || [],
      notes: lead.notes,
    });
  }

  // ----------------------------------------------------
  // 7. Find Pipeline
  // ----------------------------------------------------

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
    throw new ApiError("No active pipeline was found for this company", 400);
  }

  // ----------------------------------------------------
  // 8. Get first Pipeline Stage
  // ----------------------------------------------------

  if (!pipeline.stages?.length) {
    throw new ApiError("The selected pipeline has no stages", 400);
  }

  const firstStage = [...pipeline.stages].sort((a, b) => a.order - b.order)[0];

  if (!firstStage) {
    throw new ApiError(
      "The selected pipeline has no valid starting stage",
      400,
    );
  }

  // ----------------------------------------------------
  // 9. Prepare Opportunity data
  // ----------------------------------------------------

  const leadFullName = `${lead.firstName} ${lead.lastName}`.trim();

  const title =
    req.body.title?.trim() ||
    `${lead.companyName?.trim() || leadFullName} Opportunity`;

  const value = req.body.value ?? lead.bant?.budget?.amount ?? 0;

  const currency = req.body.currency || "USD";

  const opportunityData = {
    title,
    description: req.body.description || lead.notes,

    value,
    currency,

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

    crmCompanyId: crmCompany?._id || undefined,

    contactIds: [contact._id],

    ownerId: lead.ownerId,

    leadId: lead._id,

    expectedCloseDate: req.body.expectedCloseDate || undefined,

    status: "open",

    // Preserve the BANT information that qualified
    // the lead.
    bant: lead.bant,

    tags: lead.tags || [],

    companyId,
  };

  // ----------------------------------------------------
  // 10. Create Opportunity ALWAYS
  // ----------------------------------------------------

  const opportunity = await opportunityModel.create(opportunityData);

  // ----------------------------------------------------
  // 11. Mark Lead as converted
  // ----------------------------------------------------

  const convertedBy = req.user?._id || req.user?.userId || req.user?.id;

  lead.status = "converted";

  lead.convertedTo = {
    contactId: contact._id,

    crmCompanyId: crmCompany?._id || undefined,

    opportunityId: opportunity._id,

    convertedAt: new Date(),

    convertedBy,
  };

  await lead.save();

  // ----------------------------------------------------
  // 12. Return conversion result
  // ----------------------------------------------------

  return {
    lead,
    contact,
    company: crmCompany,
    opportunity,
  };
};

// ======================================================
// DELETE (SOFT)
// ======================================================

exports.deleteLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const lead = await leadModel.findOneAndUpdate(
    {
      _id: id,
      companyId,
      deletedAt: null,
    },
    {
      deletedAt: new Date(),
    },
    {
      new: true,
    },
  );

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  return "Lead deleted successfully";
};
