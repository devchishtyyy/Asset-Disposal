'use strict';

const express  = require('express');
const { authenticate, requireAdmin, SUPER_ADMIN_EMP_NO } = require('../middleware/auth');
const {
  loadAdminConfig, getAllWorkflows, getWorkflow,
  insertWorkflow, updateWorkflow, deleteWorkflow,
  getUserMemberships, getWorkflowId, isAdmin,
  buildEffectiveHierarchy,
} = require('../db');
const { notifyApproverPending, notifyNextApproverAfterApproval } = require('../services/email');

const router = express.Router();

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Filter workflows down to what this user is allowed to see */
function filterWorkflowsForUser(all, empNo, adminConfig) {
  if (empNo === SUPER_ADMIN_EMP_NO || isAdmin(empNo)) return all;

  const memberships = getUserMemberships(empNo, adminConfig);

  return all.filter((wf) =>
    memberships.some((m) => {
      if (m.companyId !== wf.companyId) return false;
      if (m.type === 'initiator') return wf.submittedByEmpNo === empNo;

      if (m.type === 'approver') {
        // Use the workflow's stored effective hierarchy when available;
        // fall back to the company hierarchy for legacy workflows.
        const hier = wf.effectiveHierarchy || [];

        // Locate this person's step in the effective hierarchy by stepKey match
        const stepIndex = hier.findIndex(
          (h) => h.stepKey === m.stepKey && h.empNo?.trim() === empNo.trim()
        );

        if (stepIndex >= 0) {
          if (wf.currentStep === stepIndex && wf.status === 'pending') return true;
          if (wf.approvals.some((a) => a.stepIndex === stepIndex))     return true;
          if (wf.status === 'rejected' && wf.rejectionInfo?.stepIndex === stepIndex) return true;
        } else if (!wf.effectiveHierarchy && m.stepIndex >= 0) {
          // Legacy workflow: fall back to the company hierarchy index
          const si = m.stepIndex;
          if (wf.currentStep === si && wf.status === 'pending') return true;
          if (wf.approvals.some((a) => a.stepIndex === si))     return true;
          if (wf.status === 'rejected' && wf.rejectionInfo?.stepIndex === si) return true;
        }
      }
      return false;
    })
  );
}

// ── GET /api/workflows ──────────────────────────────────────────────────────────
router.get('/', authenticate, (req, res) => {
  const adminConfig = loadAdminConfig();
  const all         = getAllWorkflows();
  const visible     = filterWorkflowsForUser(all, req.user.empNo, adminConfig);
  // Return as { [id]: workflow } map to match frontend expectations
  const map = {};
  for (const wf of visible) map[wf.id] = wf;
  res.json(map);
});

// ── POST /api/workflows ─────────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  const { formData, companyId } = req.body;
  if (!formData || !companyId) {
    return res.status(400).json({ error: 'formData and companyId are required.' });
  }

  const adminConfig = loadAdminConfig();
  const company     = adminConfig.companies?.[companyId];
  if (!company) return res.status(400).json({ error: 'Unknown company.' });

  // Verify caller is an initiator for this company
  const memberships = getUserMemberships(req.user.empNo, adminConfig);
  const membership  = memberships.find((m) => m.companyId === companyId && m.type === 'initiator');
  if (!membership) return res.status(403).json({ error: 'Not authorised to initiate for this company.' });

  const wfId = getWorkflowId(companyId, formData.assetNumber);

  // Duplicate check — no two pending/active forms for the same asset
  const existing = getWorkflow(wfId);
  if (existing && existing.status !== 'approved') {
    return res.status(409).json({ error: 'A form for this asset is already active in the system.' });
  }

  // Build the effective hierarchy for this workflow (per-initiator approvers + company steps)
  const initiatorConfig    = (company.initiators || []).find((i) => i.empNo?.trim() === req.user.empNo);
  const effectiveHierarchy = buildEffectiveHierarchy(initiatorConfig, company.hierarchy);

  // Find first occupied step in the effective hierarchy
  const firstStepIndex = effectiveHierarchy.findIndex((h) => h.empNo?.trim());
  const firstApprover  = firstStepIndex >= 0 ? effectiveHierarchy[firstStepIndex] : null;
  const initiatorName  = membership.name || req.user.empNo;

  const newWf = {
    id:                wfId,
    companyId,
    assetNumber:       formData.assetNumber,
    formData,
    currentStep:       firstStepIndex >= 0 ? firstStepIndex : 0,
    approvals:         [],
    submittedAt:       new Date().toISOString(),
    submittedByEmpNo:  req.user.empNo,
    submittedByName:   initiatorName,
    status:            'pending',
    rejectionInfo:     null,
    effectiveHierarchy,
  };

  insertWorkflow(newWf);

  // Send email notification (non-blocking)
  if (firstApprover?.email) {
    notifyApproverPending({
      approver:     { ...firstApprover, stepLabel: firstApprover.label },
      initiatorName,
      assetNumber:  formData.assetNumber,
      companyName:  company.name,
    }).catch((err) => console.error('[Email] Notify failed:', err.message));
  }

  res.status(201).json(newWf);
});

// ── PUT /api/workflows/:id/approve ──────────────────────────────────────────────
router.put('/:id/approve', authenticate, async (req, res) => {
  const wf = getWorkflow(req.params.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found.' });
  if (wf.status !== 'pending') return res.status(400).json({ error: 'Workflow is not pending.' });

  const adminConfig = loadAdminConfig();
  const company     = adminConfig.companies?.[wf.companyId];
  if (!company) return res.status(400).json({ error: 'Unknown company.' });

  // Use the workflow's stored effective hierarchy; fall back to company hierarchy for legacy workflows
  const effectiveHierarchy = wf.effectiveHierarchy || company.hierarchy || [];

  // Verify caller is the approver at the current step
  const currentApprover = effectiveHierarchy[wf.currentStep];
  if (!currentApprover || currentApprover.empNo?.trim() !== req.user.empNo?.trim()) {
    return res.status(403).json({ error: 'Not authorised to approve this step.' });
  }

  const approval     = req.body;
  const newApprovals = [...wf.approvals, approval];

  const currentStepInfo = effectiveHierarchy[wf.currentStep];
  const bypassWasteSale = currentStepInfo?.stepKey === 'finance' && approval.bypassWasteSale === true;

  // Advance past empty hierarchy slots and (if finance bypassed) waste_sale step
  let nextStep = wf.currentStep + 1;
  while (nextStep < effectiveHierarchy.length) {
    const slot = effectiveHierarchy[nextStep];
    if (!slot?.empNo?.trim()) { nextStep++; continue; }
    if (bypassWasteSale && slot.stepKey === 'waste_sale') { nextStep++; continue; }
    break;
  }
  const isComplete = nextStep >= effectiveHierarchy.length;
  const newStatus  = isComplete ? 'approved' : 'pending';

  updateWorkflow(wf.id, {
    status:        newStatus,
    currentStep:   nextStep,
    approvals:     newApprovals,
    rejectionInfo: null,
  });

  // Notify next approver
  if (!isComplete) {
    const nextApprover      = effectiveHierarchy[nextStep];
    const prevApproverLabel = effectiveHierarchy[wf.currentStep]?.label || 'Previous approver';
    if (nextApprover?.email) {
      notifyNextApproverAfterApproval({
        nextApprover:     { ...nextApprover, stepLabel: nextApprover.label },
        prevApproverLabel,
        assetNumber:      wf.assetNumber,
        companyName:      company.name,
      }).catch((err) => console.error('[Email] Notify failed:', err.message));
    }
  }

  res.json({ ok: true, status: newStatus });
});

// ── PUT /api/workflows/:id/reject ───────────────────────────────────────────────
router.put('/:id/reject', authenticate, (req, res) => {
  const wf = getWorkflow(req.params.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found.' });
  if (wf.status !== 'pending') return res.status(400).json({ error: 'Workflow is not pending.' });

  const adminConfig = loadAdminConfig();
  const company     = adminConfig.companies?.[wf.companyId];
  const effectiveHierarchy = wf.effectiveHierarchy || company?.hierarchy || [];
  const currentApprover    = effectiveHierarchy[wf.currentStep];
  if (!currentApprover || currentApprover.empNo?.trim() !== req.user.empNo?.trim()) {
    return res.status(403).json({ error: 'Not authorised to reject this step.' });
  }

  const rejectionInfo = req.body;
  updateWorkflow(wf.id, {
    status:        'rejected',
    currentStep:   wf.currentStep,
    approvals:     wf.approvals,
    rejectionInfo,
  });

  res.json({ ok: true });
});

// ── DELETE /api/workflows/:id  — admin only ─────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const wf = getWorkflow(req.params.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found.' });
  deleteWorkflow(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
