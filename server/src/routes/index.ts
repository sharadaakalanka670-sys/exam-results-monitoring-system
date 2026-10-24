import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { CourseController } from '../controllers/courseController';
import { ScheduleController } from '../controllers/scheduleController';
import { ExaminerController } from '../controllers/examinerController';
import { FirstMarkingController } from '../controllers/firstMarkingController';
import { SecondMarkingController } from '../controllers/secondMarkingController';
import { FinalMarksheetController } from '../controllers/finalMarksheetController';
import { ExtensionController } from '../controllers/extensionController';
import { DocumentController } from '../controllers/documentController';
import { DashboardController } from '../controllers/dashboardController';
import { AuditController } from '../controllers/auditController';
import { EmailController } from '../controllers/emailController';
import { RoleManagementController } from '../controllers/roleManagementController';

import { authenticateToken } from '../middlewares/auth';
import { requireRoles, requireScheduleAccess } from '../middlewares/rbac';
import { uploadPdf } from '../middlewares/upload';
import { RoleName } from '../types/enums';

const router = Router();

// ==========================================
// 1. Authentication Routes
// ==========================================
router.post('/auth/login', AuthController.login);
router.post('/auth/register', AuthController.signup);
router.post('/auth/forgot-password', AuthController.forgotPassword);
router.post('/auth/reset-password', AuthController.resetPassword);
router.post('/auth/logout', AuthController.logout);
router.get('/auth/me', authenticateToken, AuthController.me);
router.put('/auth/profile', authenticateToken, AuthController.updateProfile);

// ==========================================
// 1.1 Role Management & Approvals (HOD & Clerk)
// ==========================================
router.get('/roles/users', authenticateToken, requireRoles(RoleName.HOD, RoleName.HOD_CLERK), RoleManagementController.listUsers);
router.get('/roles/all', authenticateToken, requireRoles(RoleName.HOD, RoleName.HOD_CLERK), RoleManagementController.listRoles);
router.post('/roles/create-role', authenticateToken, requireRoles(RoleName.HOD, RoleName.HOD_CLERK), RoleManagementController.createRole);
router.post('/roles/request-change', authenticateToken, requireRoles(RoleName.HOD, RoleName.HOD_CLERK), RoleManagementController.requestRoleChange);
router.get('/roles/requests', authenticateToken, requireRoles(RoleName.HOD, RoleName.HOD_CLERK), RoleManagementController.listRequests);
router.post('/roles/requests/:id/approve', authenticateToken, requireRoles(RoleName.HOD), RoleManagementController.approveRequest);
router.post('/roles/requests/:id/reject', authenticateToken, requireRoles(RoleName.HOD), RoleManagementController.rejectRequest);
router.put('/roles/users/:id/profile', authenticateToken, requireRoles(RoleName.HOD), RoleManagementController.updateMemberProfile);

// ==========================================
// 2. Course Catalogue & Offerings
// ==========================================
router.get('/courses', authenticateToken, CourseController.listCourses);
router.post('/courses', authenticateToken, requireRoles(RoleName.HOD, RoleName.HOD_CLERK), CourseController.createCourse);
router.get('/course-offerings', authenticateToken, CourseController.listOfferings);

// ==========================================
// 3. Exam Schedules
// ==========================================
router.get('/exam-schedules', authenticateToken, ScheduleController.listSchedules);
router.get('/exam-schedules/:id', authenticateToken, requireScheduleAccess, ScheduleController.getSchedule);
router.post('/exam-schedules', authenticateToken, requireRoles(RoleName.HOD, RoleName.HOD_CLERK), ScheduleController.createDraft);
router.patch('/exam-schedules/:id/draft', authenticateToken, requireRoles(RoleName.HOD, RoleName.HOD_CLERK), ScheduleController.updateDraft);
router.post('/exam-schedules/:id/activate', authenticateToken, requireRoles(RoleName.HOD), ScheduleController.activate);
router.post('/exam-schedules/:id/cancel', authenticateToken, requireRoles(RoleName.HOD), ScheduleController.cancel);

// ==========================================
// 4. Examiners & Invitations
// ==========================================
router.get('/examiners/candidates', authenticateToken, ExaminerController.getCandidates);
router.get('/examiners/invitations', authenticateToken, ExaminerController.listInvitations);
router.post('/exam-schedules/:id/assign-second', authenticateToken, requireRoles(RoleName.HOD), ExaminerController.assignSecondExaminer);
router.post('/exam-schedules/:id/invitations', authenticateToken, requireRoles(RoleName.HOD, RoleName.LECTURER), ExaminerController.createInvitation);
router.post('/invitations/:id/review', authenticateToken, requireRoles(RoleName.HOD), ExaminerController.reviewExternalInvitation);
router.post('/invitations/:id/respond', authenticateToken, ExaminerController.respondToInvitation);

// ==========================================
// 5. Phase 1 — First Marking & OTP Logistics
// ==========================================
router.post(
  '/exam-schedules/:id/first-marking/collection-request',
  authenticateToken,
  requireRoles(RoleName.LECTURER),
  FirstMarkingController.requestCollectionOtp
);
router.post(
  '/exam-schedules/:id/first-marking/ar-generate-collection-otp',
  authenticateToken,
  requireRoles(RoleName.AR_OFFICE, RoleName.HOD),
  FirstMarkingController.arGenerateCollectionOtp
);
router.post(
  '/exam-schedules/:id/first-marking/verify-collection-otp',
  authenticateToken,
  requireRoles(RoleName.LECTURER, RoleName.HOD, RoleName.AR_OFFICE),
  FirstMarkingController.verifyCollectionOtp
);
router.post(
  '/exam-schedules/:id/first-marking/report',
  authenticateToken,
  requireRoles(RoleName.LECTURER, RoleName.HOD),
  uploadPdf.single('reportPdf'),
  FirstMarkingController.uploadReport
);
router.post(
  '/exam-schedules/:id/first-marking/return-request',
  authenticateToken,
  requireRoles(RoleName.LECTURER, RoleName.HOD),
  FirstMarkingController.requestReturnOtp
);
router.post(
  '/exam-schedules/:id/first-marking/verify-return-otp',
  authenticateToken,
  requireRoles(RoleName.AR_OFFICE),
  FirstMarkingController.verifyReturnOtp
);

// ==========================================
// 6. Phase 2 — Second Marking & Courier
// ==========================================
router.post(
  '/exam-schedules/:id/second-marking/courier-dispatch',
  authenticateToken,
  requireRoles(RoleName.AR_OFFICE),
  SecondMarkingController.recordCourierDispatch
);
router.post(
  '/exam-schedules/:id/second-marking/acknowledge-receipt',
  authenticateToken,
  requireRoles(RoleName.SECOND_EXAMINER, RoleName.LECTURER),
  SecondMarkingController.acknowledgeReceipt
);
router.post(
  '/exam-schedules/:id/second-marking/report',
  authenticateToken,
  requireRoles(RoleName.SECOND_EXAMINER, RoleName.LECTURER),
  uploadPdf.single('reportPdf'),
  SecondMarkingController.uploadReport
);
router.post(
  '/exam-schedules/:id/second-marking/confirm-ar-receipt',
  authenticateToken,
  requireRoles(RoleName.AR_OFFICE),
  SecondMarkingController.confirmArReceipt
);

// ==========================================
// 7. Phase 3 — Final Marksheet & Approval Lock
// ==========================================
router.post(
  '/exam-schedules/:id/final-marksheet',
  authenticateToken,
  requireRoles(RoleName.LECTURER),
  uploadPdf.single('marksheetPdf'),
  FinalMarksheetController.uploadMarksheet
);
router.post(
  '/exam-schedules/:id/final-marksheet/submit',
  authenticateToken,
  requireRoles(RoleName.LECTURER),
  FinalMarksheetController.submitMarksheet
);
router.post(
  '/exam-schedules/:id/final-marksheet/request-changes',
  authenticateToken,
  requireRoles(RoleName.HOD),
  FinalMarksheetController.requestChanges
);
router.post(
  '/exam-schedules/:id/final-marksheet/approve',
  authenticateToken,
  requireRoles(RoleName.HOD),
  FinalMarksheetController.approve
);
router.post(
  '/exam-schedules/:id/final-marksheet/hardcopy',
  authenticateToken,
  requireRoles(RoleName.HOD, RoleName.LECTURER, RoleName.AR_OFFICE),
  FinalMarksheetController.recordHardcopy
);

// ==========================================
// 8. Deadline Extensions
// ==========================================
router.post(
  '/exam-schedules/:id/extension-requests',
  authenticateToken,
  requireRoles(RoleName.LECTURER, RoleName.SECOND_EXAMINER, RoleName.HOD),
  ExtensionController.requestExtension
);
router.get('/extension-requests', authenticateToken, requireRoles(RoleName.HOD), ExtensionController.listExtensions);
router.post('/extension-requests/:id/review', authenticateToken, requireRoles(RoleName.HOD), ExtensionController.reviewExtension);

// ==========================================
// 9. Document Secure Signed Access
// ==========================================
router.get('/documents/:id/download-link', authenticateToken, DocumentController.getDownloadLink);
router.get('/documents/download', DocumentController.downloadFile);

// ==========================================
// 10. Role Dashboards
// ==========================================
router.get('/dashboards/hod', authenticateToken, requireRoles(RoleName.HOD), DashboardController.getHodDashboard);
router.get('/dashboards/lecturer', authenticateToken, requireRoles(RoleName.LECTURER, RoleName.HOD), DashboardController.getLecturerDashboard);
router.get('/dashboards/second-examiner', authenticateToken, requireRoles(RoleName.SECOND_EXAMINER, RoleName.HOD, RoleName.LECTURER), DashboardController.getSecondExaminerDashboard);
router.get('/dashboards/ar', authenticateToken, requireRoles(RoleName.AR_OFFICE, RoleName.HOD), DashboardController.getArDashboard);
router.get('/dashboards/dean', authenticateToken, requireRoles(RoleName.DEAN, RoleName.HOD), DashboardController.getDeanDashboard);

// ==========================================
// 11. System Audit Logs
// ==========================================
router.get('/audit-logs', authenticateToken, requireRoles(RoleName.HOD), AuditController.listLogs);

// ==========================================
// 12. Auto-Customized Notification Emails
// ==========================================
router.get('/emails/my-emails', authenticateToken, EmailController.listMyEmails);
router.get('/emails/smtp-status', authenticateToken, EmailController.checkStatus);
router.get('/emails/settings', authenticateToken, EmailController.getSettings);
router.post('/emails/settings', authenticateToken, EmailController.saveSettings);
router.post('/emails/unlink', authenticateToken, EmailController.unlink);
router.post('/emails/test-connection', authenticateToken, EmailController.testCredentials);
router.post('/emails/send-test', authenticateToken, EmailController.sendTestEmail);

export default router;
