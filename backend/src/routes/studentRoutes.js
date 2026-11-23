'use strict';

const express = require('express');
const router = express.Router();
const {
  registerStudent,
  getAllStudents,
  getStudent,
  getPublicStudentInfo,
  updateStudent,
  deleteStudent,
  restoreStudent,
  getDeletedStudentPayments,
  getPaymentSummary,
  bulkImportStudents,
  getOverdueStudents,
  resetPayment,
  reconcileStudent,
  getFeeHistory,
  exportStudents,
  adjustStudentCredit,
} = require('../controllers/studentController');
const { resubscribeReminders } = require('../controllers/reminderController');
const { getImportJobStatus } = require('../controllers/importJobController');
const { validateRegisterStudent, validateStudentIdParam, validatePagination, validateUpdateStudent } = require('../middleware/validate');
const { resolveSchool } = require('../middleware/schoolContext');
const { requireAdminAuth, requireSchoolAuth } = require('../middleware/auth');
const { auditContext } = require('../middleware/auditContext');
const { bulkImportLimiter } = require('../middleware/rateLimiter');
const streamingCsvUpload = require('../middleware/streamingCsvUpload');
const { contractPaused } = require('../middleware/contractPaused');
const {
  eraseStudentPiiHandler,
  exportStudentDataHandler,
} = require('../controllers/retentionController');

router.use(resolveSchool);

// Admin-only routes
router.post('/', requireAdminAuth, auditContext, validateRegisterStudent, registerStudent);
router.post('/bulk', requireAdminAuth, auditContext, bulkImportLimiter, express.json({ limit: '1mb' }), streamingCsvUpload({ requiredHeaders: ['studentId', 'name', 'class'] }), bulkImportStudents);
router.get('/', requireAdminAuth, validatePagination, getAllStudents);
router.get('/export', requireAdminAuth, exportStudents);

// Import job status — registered BEFORE /:studentId so Express does not
// capture the literal segment 'import' as a studentId parameter.
router.get('/import/:jobId', requireAdminAuth, getImportJobStatus);

// Authentication-required routes (Issue #1040: all student financial data requires auth)
router.get('/summary', requireSchoolAuth(), getPaymentSummary);
router.get('/overdue', requireSchoolAuth(), getOverdueStudents);

// Public routes
router.get('/public/:studentId', validateStudentIdParam, getPublicStudentInfo);
router.get('/:studentId', requireAdminAuth, validateStudentIdParam, getStudent);
router.put('/:studentId', requireAdminAuth, auditContext, validateStudentIdParam, validateUpdateStudent, updateStudent);
router.delete('/:studentId', requireAdminAuth, auditContext, validateStudentIdParam, deleteStudent);
router.post('/:studentId/restore', requireAdminAuth, auditContext, validateStudentIdParam, restoreStudent);
router.get('/:studentId/payments/audit', requireAdminAuth, validateStudentIdParam, getDeletedStudentPayments);
router.post('/:studentId/reset-payment', requireAdminAuth, auditContext, validateStudentIdParam, resetPayment);
router.post('/:studentId/reconcile', requireAdminAuth, auditContext, validateStudentIdParam, reconcileStudent);
router.post('/:studentId/reminders/resubscribe', requireAdminAuth, auditContext, validateStudentIdParam, resubscribeReminders);
router.get('/:studentId/fee-history', requireAdminAuth, validateStudentIdParam, getFeeHistory);
router.post('/:studentId/credit-adjustments', requireAdminAuth, validateStudentIdParam, auditContext, contractPaused, adjustStudentCredit);
router.delete('/:studentId/pii', requireAdminAuth, validateStudentIdParam, auditContext, eraseStudentPiiHandler);
router.get('/:studentId/data-export', requireAdminAuth, validateStudentIdParam, exportStudentDataHandler);

module.exports = router;
