'use strict';

// node:sqlite is built into Node.js 22+ — no native compilation required.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');

// Store the SQLite file next to server.js
const DB_DIR  = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'asset_disposal.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for better performance; enforce foreign keys
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ── Schema ─────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_config (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    config     TEXT    NOT NULL,
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS workflows (
    id                  TEXT    PRIMARY KEY,
    company_id          TEXT    NOT NULL,
    asset_number        TEXT    NOT NULL,
    status              TEXT    NOT NULL DEFAULT 'pending',
    current_step        INTEGER NOT NULL DEFAULT 0,
    submitted_by_emp_no TEXT    NOT NULL,
    submitted_by_name   TEXT    NOT NULL,
    submitted_at        TEXT    NOT NULL,
    updated_at          TEXT    NOT NULL,
    form_data           TEXT    NOT NULL,
    approvals           TEXT    NOT NULL DEFAULT '[]',
    rejection_info      TEXT
  );
`);

// ── Admin config helpers ────────────────────────────────────────────────────────

const DEFAULT_HIERARCHY_STEPS = [
  { stepKey: 'dept_incharge',  label: 'Department Incharge'  },
  { stepKey: 'finance',        label: 'Finance'              },
  { stepKey: 'biz_controller', label: 'Business Controller'  },
  { stepKey: 'bu_head',        label: 'BU Head'              },
  { stepKey: 'waste_sale',     label: 'Waste Sale Department'},
  { stepKey: 'fin_controller', label: 'Financial Controller' },
  { stepKey: 'cfo',            label: 'CFO'                  },
  { stepKey: 'ceo',            label: 'CEO'                  },
];

const ASMA_NAWAZ = { empNo: '30001634', name: 'Asma Nawaz', email: 'asma.nawaz@bullehshah.com.pk' };

function makeDefaultCompany(id, name) {
  return {
    id, name,
    initiators: [],
    hierarchy:  DEFAULT_HIERARCHY_STEPS.map((s) => ({ ...s, empNo: '', name: '', email: '' })),
  };
}

function makeBSPUnit(id, name) {
  const co     = makeDefaultCompany(id, name);
  const finIdx = co.hierarchy.findIndex((s) => s.stepKey === 'finance');
  if (finIdx >= 0) co.hierarchy[finIdx] = { ...co.hierarchy[finIdx], ...ASMA_NAWAZ };
  return co;
}

function getDefaultAdminConfig() {
  return {
    companies: {
      PB:  makeBSPUnit('PB',  'Bulleh Shah Packaging — PB'),
      CD:  makeBSPUnit('CD',  'Bulleh Shah Packaging — CD'),
      DIC: makeDefaultCompany('DIC', 'DIC Pakistan (Pvt) Ltd'),
    },
  };
}

const TEST_STEP_MAP = {
  dept_incharge:  { empNo: 'T010', name: 'Test Dept Incharge'  },
  finance:        { empNo: 'T011', name: 'Test Finance'         },
  biz_controller: { empNo: 'T012', name: 'Test Biz Controller' },
  bu_head:        { empNo: 'T013', name: 'Test BU Head'         },
  waste_sale:     { empNo: 'T014', name: 'Test Waste Sale'      },
  fin_controller: { empNo: 'T015', name: 'Test Fin Controller'  },
  cfo:            { empNo: 'T016', name: 'Test CFO'             },
  ceo:            { empNo: 'T017', name: 'Test CEO'             },
};

function buildTestAdminConfig() {
  const defaults = getDefaultAdminConfig();
  const companies = {};
  for (const [id, co] of Object.entries(defaults.companies)) {
    companies[id] = {
      ...co,
      initiators: [{ empNo: 'T001', name: 'Test Initiator', email: '' }],
      hierarchy:  co.hierarchy.map((step) => {
        const t = TEST_STEP_MAP[step.stepKey];
        return t ? { ...step, empNo: t.empNo, name: t.name, email: '' } : { ...step, empNo: '', name: '', email: '' };
      }),
    };
  }
  return { companies };
}

// ── Config DB operations ────────────────────────────────────────────────────────

const stmtGetConfig  = db.prepare('SELECT config FROM admin_config WHERE id = 1');
const stmtUpsertConfig = db.prepare(`
  INSERT INTO admin_config (id, config, updated_at)
  VALUES (1, ?, datetime('now'))
  ON CONFLICT(id) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at
`);

function loadAdminConfig() {
  const row = stmtGetConfig.get();
  if (!row) return getDefaultAdminConfig();
  try {
    return JSON.parse(row.config);
  } catch {
    return getDefaultAdminConfig();
  }
}

function saveAdminConfig(config) {
  stmtUpsertConfig.run(JSON.stringify(config));
}

// ── Workflow DB operations ──────────────────────────────────────────────────────

function rowToWorkflow(row) {
  if (!row) return null;
  return {
    id:                 row.id,
    companyId:          row.company_id,
    assetNumber:        row.asset_number,
    status:             row.status,
    currentStep:        row.current_step,
    submittedByEmpNo:   row.submitted_by_emp_no,
    submittedByName:    row.submitted_by_name,
    submittedAt:        row.submitted_at,
    updatedAt:          row.updated_at,
    formData:           JSON.parse(row.form_data),
    approvals:          JSON.parse(row.approvals),
    rejectionInfo:      row.rejection_info ? JSON.parse(row.rejection_info) : null,
  };
}

const stmtGetAllWorkflows  = db.prepare('SELECT * FROM workflows ORDER BY submitted_at DESC');
const stmtGetWorkflow      = db.prepare('SELECT * FROM workflows WHERE id = ?');
const stmtInsertWorkflow   = db.prepare(`
  INSERT INTO workflows
    (id, company_id, asset_number, status, current_step,
     submitted_by_emp_no, submitted_by_name, submitted_at, updated_at,
     form_data, approvals, rejection_info)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const stmtUpdateWorkflow   = db.prepare(`
  UPDATE workflows
  SET status = ?, current_step = ?, approvals = ?, rejection_info = ?, updated_at = ?
  WHERE id = ?
`);
const stmtDeleteWorkflow   = db.prepare('DELETE FROM workflows WHERE id = ?');

function getAllWorkflows() {
  return stmtGetAllWorkflows.all().map(rowToWorkflow);
}

function getWorkflow(id) {
  return rowToWorkflow(stmtGetWorkflow.get(id));
}

function insertWorkflow(wf) {
  stmtInsertWorkflow.run(
    wf.id,
    wf.companyId,
    wf.assetNumber,
    wf.status,
    wf.currentStep,
    wf.submittedByEmpNo,
    wf.submittedByName,
    wf.submittedAt,
    wf.submittedAt,   // updatedAt = submittedAt on creation
    JSON.stringify(wf.formData),
    JSON.stringify(wf.approvals ?? []),
    wf.rejectionInfo ? JSON.stringify(wf.rejectionInfo) : null,
  );
}

function updateWorkflow(id, { status, currentStep, approvals, rejectionInfo }) {
  const now = new Date().toISOString();
  stmtUpdateWorkflow.run(
    status,
    currentStep,
    JSON.stringify(approvals),
    rejectionInfo ? JSON.stringify(rejectionInfo) : null,
    now,
    id,
  );
}

function deleteWorkflow(id) {
  stmtDeleteWorkflow.run(id);
}

// ── Role helpers (mirrors frontend companies.js) ───────────────────────────────

function getUserMemberships(empNo, adminConfig) {
  if (!empNo || !adminConfig?.companies) return [];
  const result = [];
  for (const [companyId, company] of Object.entries(adminConfig.companies)) {
    const initiator = (company.initiators || []).find(
      (i) => i.empNo?.trim() === empNo.trim()
    );
    if (initiator) {
      result.push({ type: 'initiator', companyId, empNo: initiator.empNo, name: initiator.name || empNo, email: initiator.email || '' });
      continue;
    }
    const stepIndex = (company.hierarchy || []).findIndex(
      (h) => h.empNo?.trim() === empNo.trim()
    );
    if (stepIndex >= 0) {
      const step = company.hierarchy[stepIndex];
      result.push({ type: 'approver', companyId, stepIndex, stepKey: step.stepKey, stepLabel: step.label, empNo: step.empNo, name: step.name || empNo, email: step.email || '' });
    }
  }
  return result;
}

function getWorkflowId(companyId, assetNumber) {
  const padded = String(assetNumber).padStart(12, '0');
  return `${companyId}_${padded}`;
}

module.exports = {
  db,
  loadAdminConfig,
  saveAdminConfig,
  getAllWorkflows,
  getWorkflow,
  insertWorkflow,
  updateWorkflow,
  deleteWorkflow,
  getUserMemberships,
  getWorkflowId,
  getDefaultAdminConfig,
  buildTestAdminConfig,
  DEFAULT_HIERARCHY_STEPS,
};
