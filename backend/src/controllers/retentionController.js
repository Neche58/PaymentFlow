'use strict';

const { runRetention, ALL_SCOPES } = require('../services/retentionService');
const logger = require('../utils/logger').child('RetentionController');

/**
 * POST /api/admin/retention/run
 *
 * Body (all optional):
 *   { dryRun: boolean, scopes: string[] }
 *
 * dryRun defaults to true for safety — callers must explicitly pass
 * dryRun=false to perform live deletions.
 */
async function runRetentionHandler(req, res) {
  const { dryRun = true, scopes } = req.body || {};

  if (typeof dryRun !== 'boolean') {
    return res.status(400).json({
      errors: [{ field: 'dryRun', message: 'dryRun must be a boolean' }],
      code: 'VALIDATION_ERROR',
    });
  }

  // Validate scopes if provided
  if (scopes !== undefined) {
    if (!Array.isArray(scopes) || scopes.length > ALL_SCOPES.length || scopes.some((s) => !ALL_SCOPES.includes(s))) {
      return res.status(400).json({
        errors: [{ field: 'scopes', message: `Must contain at most ${ALL_SCOPES.length} valid scope names` }],
        code:  'VALIDATION_ERROR',
      });
    }
    if (scopes.length === 0) {
      return res.status(400).json({
        error: 'scopes must be a non-empty array or omitted to run all scopes.',
        code:  'VALIDATION_ERROR',
      });
    }
  }

  const performedBy = req.user?.id || req.user?.email || 'admin';

  try {
    const report = await runRetention({ dryRun: Boolean(dryRun), scopes, performedBy });
    return res.status(200).json(report);
  } catch (err) {
    logger.error('Retention run failed', { error: err.message, dryRun, scopes });
    return res.status(500).json({
      error: 'Retention run failed.',
      code:  'INTERNAL_ERROR',
    });
  }
}

async function listDeletionCertificates(req, res) {
  const rawLimit = Number(req.query.limit || 50);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 200) {
    return res.status(400).json({
      errors: [{ field: 'limit', message: 'limit must be an integer from 1 to 200' }],
      code: 'VALIDATION_ERROR',
    });
  }
  const DataDeletionCertificate = require('../models/dataDeletionCertificateModel');
  const certificates = await DataDeletionCertificate.find()
    .sort({ purgedAt: -1, _id: -1 })
    .limit(rawLimit)
    .lean();
  return res.status(200).json({ certificates, limit: rawLimit });
}

/**
 * GET /api/admin/retention/preview
 *
 * Convenience alias for a full dry-run across all scopes.
 * No body required.
 */
async function previewRetentionHandler(req, res) {
  try {
    const report = await runRetention({ dryRun: true });
    return res.status(200).json(report);
  } catch (err) {
    logger.error('Retention preview failed', { error: err.message });
    return res.status(500).json({
      error: 'Retention preview failed.',
      code:  'INTERNAL_ERROR',
    });
  }
}

async function eraseStudentPiiHandler(req, res) {
  const { studentId } = req.params;
  const schoolId = req.schoolId;
  if (!schoolId || !studentId) {
    return res.status(400).json({ error: 'schoolId and studentId are required', code: 'VALIDATION_ERROR' });
  }

  const Student = require('../models/studentModel');
  const student = await Student.findOne({ schoolId, studentId });
  if (!student) {
    return res.status(404).json({ error: 'Student not found', code: 'NOT_FOUND' });
  }

  await logAuditBeforeErasure(schoolId, studentId, req);

  student.name = 'Anonymised';
  student.parentEmail = null;
  student.parentPhone = null;
  student.parentEmailHash = null;
  student.parentName = null;
  student.contactNumber = null;
  student.dateOfBirth = null;
  student.gender = null;
  await student.save();

  return res.json({ studentId, anonymised: true });
}

async function logAuditBeforeErasure(schoolId, studentId, req) {
  const { logAudit } = require('../services/auditService');
  await logAudit({
    schoolId,
    action: 'STUDENT_PII_ERASURE',
    performedBy: req.user?.id || req.user?.email || 'admin',
    targetId: studentId,
    targetType: 'student',
    details: { reason: 'right_to_erasure' },
    result: 'success',
    ipAddress: req.ip,
    userAgent: req.headers?.['user-agent'] || null,
  });
}

async function exportStudentDataHandler(req, res) {
  const { studentId } = req.params;
  const schoolId = req.schoolId;
  if (!schoolId || !studentId) {
    return res.status(400).json({ error: 'schoolId and studentId are required', code: 'VALIDATION_ERROR' });
  }

  const Student = require('../models/studentModel');
  const Payment = require('../models/paymentModel');
  const AuditLog = require('../models/auditLogModel');
  const StudentFeeHistory = require('../models/studentFeeHistoryModel');

  const student = await Student.findOne({ schoolId, studentId }).lean();
  if (!student) {
    return res.status(404).json({ error: 'Student not found', code: 'NOT_FOUND' });
  }

  const [payments, auditLogs, feeHistory] = await Promise.all([
    Payment.find({ schoolId, studentId }).lean(),
    AuditLog.find({ schoolId, targetId: studentId }).lean(),
    StudentFeeHistory.find({ schoolId, studentId }).lean(),
  ]);

  res.setHeader('Content-Disposition', `attachment; filename="student-${studentId}-data.json"`);
  return res.json({ student, payments, auditLogs, feeHistory });
}

module.exports = {
  runRetentionHandler,
  previewRetentionHandler,
  listDeletionCertificates,
  eraseStudentPiiHandler,
  exportStudentDataHandler,
};
