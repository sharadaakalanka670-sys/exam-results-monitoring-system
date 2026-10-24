import React, { useState, useEffect } from 'react';
import { ExamSchedule, User, ExaminerCandidate } from '../types';
import { StatusBadge } from './StatusBadge';
import { WorkflowTimeline } from './WorkflowTimeline';
import { LecturerAvatar } from './LecturerAvatar';
import { api } from '../api/client';
import {
  X,
  FileText,
  Download,
  Upload,
  Key,
  Truck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Shield,
  Send,
  Lock,
  UserCheck,
  Calendar,
  Building,
  RotateCcw,
  Bell,
  UserPlus
} from 'lucide-react';

interface Props {
  schedule: ExamSchedule;
  user: User;
  onClose: () => void;
  onRefresh: () => void;
}

export const ScheduleDetailModal: React.FC<Props> = ({ schedule: initialSchedule, user, onClose, onRefresh }) => {
  const [schedule, setSchedule] = useState<ExamSchedule>(initialSchedule);
  const [activeTab, setActiveTab] = useState<'details' | 'actions' | 'documents' | 'history'>('actions');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Live detail fetcher to populate documents, workflowEvents, etc.
  const fetchScheduleDetail = async () => {
    try {
      const res = await api.get(`/exam-schedules/${initialSchedule.id}`);
      setSchedule(res.data);
    } catch (err) {
      console.error('Failed to load schedule detail', err);
    }
  };

  useEffect(() => {
    fetchScheduleDetail();
  }, [initialSchedule.id]);

  const refreshAll = async () => {
    await fetchScheduleDetail();
    onRefresh();
  };

  // Modal / Form states
  const [otpModalData, setOtpModalData] = useState<{ otp: string; expiresAt: string; title: string } | null>(null);
  const [scriptCountInput, setScriptCountInput] = useState<number>(initialSchedule.firstMarking?.scriptCount || 50);
  const [collectionOtpInput, setCollectionOtpInput] = useState<string>('');
  const [returnOtpInput, setReturnOtpInput] = useState<string>('');
  const [activeReturnOtp, setActiveReturnOtp] = useState<string | null>(() => {
    return sessionStorage.getItem(`return_otp_${initialSchedule.id}`) || null;
  });
  const [courierRefInput, setCourierRefInput] = useState<string>('');
  const [revisionReasonInput, setRevisionReasonInput] = useState<string>('');
  const [extensionPhase, setExtensionPhase] = useState<'FIRST_MARKING' | 'SECOND_MARKING'>('FIRST_MARKING');
  const [extensionDateInput, setExtensionDateInput] = useState<string>('');
  const [extensionReasonInput, setExtensionReasonInput] = useState<string>('');

  // Assign Examiner Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [candidates, setCandidates] = useState<ExaminerCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  const isHod = user.roles.includes('HOD');
  const isAr = user.roles.includes('AR_OFFICE');
  const canActAsAr = isAr;
  const isFirstExaminer = schedule.firstExaminerUserId === user.id;
  const isSecondExaminer = schedule.secondExaminer?.user.id === user.id;
  const isLocked = schedule.workflowStatus === 'APPROVED_LOCKED';

  const clearMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };


  // ==========================================
  // Action Handlers
  // ==========================================

  // Activate Draft Schedule (HOD authority - strictly enforces Second Examiner presence)
  const handleActivateDraft = async () => {
    try {
      clearMessages();
      if (!schedule.secondExaminerProfileId && !schedule.secondExaminer) {
        setErrorMsg('Cannot activate exam schedule without an assigned Second Examiner. Please assign a Second Examiner first.');
        return;
      }
      setLoading(true);
      await api.post(`/exam-schedules/${schedule.id}/activate`, {
        examDate: schedule.examDate || new Date().toISOString(),
        firstExaminerUserId: schedule.firstExaminerUserId,
        secondExaminerProfileId: schedule.secondExaminerProfileId || schedule.secondExaminer?.id,
      });
      setSuccessMsg('Exam Schedule planned and activated successfully with both First and Second Examiners!');
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to activate schedule');
    } finally {
      setLoading(false);
    }
  };

  // 1. First Examiner: Request Collection OTP
  const handleRequestCollectionOtp = async () => {
    try {
      clearMessages();
      setLoading(true);
      const res = await api.post(`/exam-schedules/${schedule.id}/first-marking/collection-request`, {
        scriptCount: scriptCountInput,
      });
      setOtpModalData({
        otp: res.data.otp,
        expiresAt: res.data.expiresAt,
        title: 'Script Collection OTP (Physical Handover)',
      });
      setSuccessMsg('Collection OTP generated! Show this single-use code to the AR Office officer during handover.');
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to request collection OTP');
    } finally {
      setLoading(false);
    }
  };

  // AR Office: Generate Collection OTP & Dispatch Alert Call to 1st Examiner
  const handleArGenerateCollectionOtp = async () => {
    try {
      clearMessages();
      setLoading(true);
      const res = await api.post(`/exam-schedules/${schedule.id}/first-marking/ar-generate-collection-otp`, {
        scriptCount: scriptCountInput,
      });
      setOtpModalData({
        otp: res.data.otp,
        expiresAt: res.data.expiresAt,
        title: 'Script Collection OTP (AR Office Generated)',
      });
      setSuccessMsg(`Collection OTP (${res.data.otp}) generated! Auto-customized alert email dispatched to First Examiner (${res.data.recipientName || schedule.firstExaminer?.fullName}).`);
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to generate collection OTP');
    } finally {
      setLoading(false);
    }
  };

  // HOD Review / Approval of Second Examiner Nomination
  const handleReviewInvitation = async (invitationId: number, approved: boolean) => {
    const reason = prompt(`Enter ${approved ? 'approval' : 'rejection'} remark:`) || '';
    try {
      clearMessages();
      setLoading(true);
      await api.post(`/invitations/${invitationId}/review`, {
        approved,
        decisionReason: reason
      });
      setSuccessMsg(`Second Examiner nomination ${approved ? 'approved and assigned' : 'rejected'}.`);
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to review invitation');
    } finally {
      setLoading(false);
    }
  };

  // 2. First Examiner (or AR Office): Confirm Collection OTP
  const handleVerifyCollectionOtp = async () => {
    try {
      clearMessages();
      setLoading(true);
      await api.post(`/exam-schedules/${schedule.id}/first-marking/verify-collection-otp`, {
        otp: collectionOtpInput,
      });
      setSuccessMsg('Script collection confirmed successfully! Physical script handover completed. 3-month grading deadline started.');
      setCollectionOtpInput('');
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  // 3. First Examiner: Upload Report PDF
  const handleUploadFirstReport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Only PDF files are permitted.');
      return;
    }

    try {
      clearMessages();
      setLoading(true);
      const formData = new FormData();
      formData.append('reportPdf', file);

      await api.post(`/exam-schedules/${schedule.id}/first-marking/report`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccessMsg('First Marking Report PDF uploaded successfully!');
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to upload report');
    } finally {
      setLoading(false);
    }
  };

  // 4. First Examiner: Generate Return OTP to AR Office
  const handleRequestReturnOtp = async () => {
    try {
      clearMessages();
      setLoading(true);
      const res = await api.post(`/exam-schedules/${schedule.id}/first-marking/return-request`);
      setActiveReturnOtp(res.data.otp);
      sessionStorage.setItem(`return_otp_${schedule.id}`, res.data.otp);
      setOtpModalData({
        otp: res.data.otp,
        expiresAt: res.data.expiresAt,
        title: 'Script Return Handover OTP (Handover to AR)',
      });
      setSuccessMsg(`Return OTP (${res.data.otp}) generated! Provide this single-use code to AR Office to confirm physical handover.`);
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to generate return OTP');
    } finally {
      setLoading(false);
    }
  };

  // 5. AR Office: Verify Return OTP
  const handleVerifyReturnOtp = async () => {
    try {
      clearMessages();
      setLoading(true);
      await api.post(`/exam-schedules/${schedule.id}/first-marking/verify-return-otp`, {
        otp: returnOtpInput,
      });
      setSuccessMsg('Return OTP verified! Returned scripts confirmed by AR Office.');
      setReturnOtpInput('');
      setActiveReturnOtp(null);
      sessionStorage.removeItem(`return_otp_${schedule.id}`);
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  // 6. AR Office: Courier Dispatch
  const handleCourierDispatch = async () => {
    try {
      clearMessages();
      setLoading(true);
      await api.post(`/exam-schedules/${schedule.id}/second-marking/courier-dispatch`, {
        courierReference: courierRefInput || 'DEX-COURIER-DEFAULT',
      });
      setSuccessMsg('Courier dispatch recorded! 1-month second marking deadline started.');
      setCourierRefInput('');
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to record courier dispatch');
    } finally {
      setLoading(false);
    }
  };

  // 7. Second Examiner: Acknowledge Courier Receipt
  const handleAcknowledgeReceipt = async () => {
    try {
      clearMessages();
      setLoading(true);
      await api.post(`/exam-schedules/${schedule.id}/second-marking/acknowledge-receipt`);
      setSuccessMsg('Receipt of scripts acknowledged successfully!');
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to acknowledge receipt');
    } finally {
      setLoading(false);
    }
  };

  // 8. Second Examiner: Upload Report PDF
  const handleUploadSecondReport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      clearMessages();
      setLoading(true);
      const formData = new FormData();
      formData.append('reportPdf', file);

      await api.post(`/exam-schedules/${schedule.id}/second-marking/report`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccessMsg('Second Marker Report PDF uploaded successfully!');
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to upload report');
    } finally {
      setLoading(false);
    }
  };

  // 9. AR Office: Confirm Second Return Receipt
  const handleConfirmArReceipt = async () => {
    try {
      clearMessages();
      setLoading(true);
      await api.post(`/exam-schedules/${schedule.id}/second-marking/confirm-ar-receipt`);
      setSuccessMsg('Scripts return confirmed by AR Office! Second marking completed.');
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to confirm receipt');
    } finally {
      setLoading(false);
    }
  };

  // 10. First Examiner: Upload Final Marksheet PDF
  const handleUploadFinalMarksheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      clearMessages();
      setLoading(true);
      const formData = new FormData();
      formData.append('marksheetPdf', file);

      await api.post(`/exam-schedules/${schedule.id}/final-marksheet`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccessMsg('Final Marksheet PDF uploaded successfully!');
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to upload final marksheet');
    } finally {
      setLoading(false);
    }
  };

  // 11. First Examiner: Submit Final Marksheet for Review
  const handleSubmitFinalMarksheet = async () => {
    try {
      clearMessages();
      setLoading(true);
      await api.post(`/exam-schedules/${schedule.id}/final-marksheet/submit`);
      setSuccessMsg('Final Marksheet submitted to HOD for approval!');
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit final marksheet');
    } finally {
      setLoading(false);
    }
  };

  // 12. HOD: Request Changes
  const handleRequestChanges = async () => {
    if (!revisionReasonInput.trim()) {
      setErrorMsg('Please specify a reason when requesting revisions.');
      return;
    }
    try {
      clearMessages();
      setLoading(true);
      await api.post(`/exam-schedules/${schedule.id}/final-marksheet/request-changes`, {
        revisionReason: revisionReasonInput,
      });
      setSuccessMsg('Revisions requested from first examiner.');
      setRevisionReasonInput('');
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to request changes');
    } finally {
      setLoading(false);
    }
  };

  // 13. HOD: Final Approval & Lock
  const handleApproveFinalMarksheet = async () => {
    if (!window.confirm('Are you sure you want to grant final approval? This will permanently lock the workflow.')) {
      return;
    }
    try {
      clearMessages();
      setLoading(true);
      await api.post(`/exam-schedules/${schedule.id}/final-marksheet/approve`);
      setSuccessMsg('Final approval granted! Workflow is now permanently locked.');
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to approve marksheet');
    } finally {
      setLoading(false);
    }
  };

  // 14. Request Deadline Extension
  const handleRequestExtension = async () => {
    if (!extensionDateInput || !extensionReasonInput.trim()) {
      setErrorMsg('Requested due date and mandatory reason are required.');
      return;
    }
    try {
      clearMessages();
      setLoading(true);
      await api.post(`/exam-schedules/${schedule.id}/extension-requests`, {
        phase: extensionPhase,
        requestedDueDate: extensionDateInput,
        reason: extensionReasonInput,
      });
      setSuccessMsg('Extension request submitted to HOD for review.');
      setExtensionDateInput('');
      setExtensionReasonInput('');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit extension request');
    } finally {
      setLoading(false);
    }
  };

  // 15. Secure Download with Signed Token
  const handleDownloadDocument = async (documentId: number, filename: string) => {
    try {
      clearMessages();
      const res = await api.get(`/documents/${documentId}/download-link`);
      const downloadUrl = res.data.downloadUrl;

      // Trigger browser download via authorized temporary link
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Unauthorized: You do not have permission to download this document.');
    }
  };

  // Open Assign Examiner candidate modal
  const handleOpenAssignModal = async () => {
    setShowAssignModal(true);
    setLoadingCandidates(true);
    try {
      const res = await api.get(`/examiners/candidates?firstExaminerUserId=${schedule.firstExaminerUserId || ''}`);
      setCandidates(res.data);
    } catch (err: any) {
      setErrorMsg('Failed to load candidate second examiners.');
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleSelectCandidate = async (candidate: ExaminerCandidate) => {
    if (!candidate.isEligible) {
      alert(`Cannot select candidate: ${candidate.ineligibilityReason}`);
      return;
    }

    try {
      clearMessages();
      setLoading(true);
      if (isHod) {
        await api.post(`/exam-schedules/${schedule.id}/assign-second`, {
          secondExaminerProfileId: candidate.id,
        });
        setSuccessMsg(`Second Examiner assigned: ${candidate.fullName}`);
      } else {
        await api.post(`/exam-schedules/${schedule.id}/invitations`, {
          requestedExaminerProfileId: candidate.id,
          requestedName: candidate.fullName,
          requestedEmail: candidate.email,
          examinerType: candidate.examinerType || 'INTERNAL',
        });
        setSuccessMsg(`Second Examiner nomination dispatched to ${candidate.fullName}! An email alert has been sent to the candidate.`);
      }
      setShowAssignModal(false);
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Nomination / Assignment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-base font-bold bg-slate-800 text-white px-2.5 py-1 rounded-lg">
              {schedule.courseOffering.course.courseCode}
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                {schedule.courseOffering.course.courseTitle}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>{schedule.courseOffering.programmeGroup}</span>
                <span>•</span>
                <span>Batch {schedule.courseOffering.batchLabel}</span>
                <span>•</span>
                <span>Sem {schedule.courseOffering.semester}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <StatusBadge status={schedule.workflowStatus} isOverdue={schedule.isOverdue} />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workflow Timeline Banner */}
        <div className="px-6 border-b border-slate-100 bg-white">
          <WorkflowTimeline schedule={schedule} />
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-slate-200 flex gap-4 text-sm font-medium">
          <button
            onClick={() => setActiveTab('actions')}
            className={`pb-2.5 border-b-2 transition ${
              activeTab === 'actions' ? 'border-red-800 text-red-900 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Workflow Actions
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-2.5 border-b-2 transition ${
              activeTab === 'details' ? 'border-red-800 text-red-900 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Schedule & Checkpoints
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`pb-2.5 border-b-2 transition ${
              activeTab === 'documents' ? 'border-red-800 text-red-900 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Documents ({schedule.documents?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 border-b-2 transition ${
              activeTab === 'history' ? 'border-red-800 text-red-900 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Event Audit Trail ({schedule.workflowEvents?.length || 0})
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: WORKFLOW ACTIONS */}
          {activeTab === 'actions' && (
            <div className="space-y-6">
              {isLocked ? (
                <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-emerald-950">Workflow Approved & Permanently Locked</h3>
                  <p className="text-sm text-emerald-800 max-w-lg mx-auto">
                    Final HOD approval was granted on{' '}
                    {schedule.finalResult?.hodApprovedAt ? new Date(schedule.finalResult.hodApprovedAt).toLocaleDateString() : 'N/A'}.
                    No further modifications or document replacements are allowed under RUSL regulations.
                  </p>
                </div>
              ) : (
                <>
                  {/* Draft Activation Banner if workflow not yet started */}
                  {schedule.workflowStatus === 'DRAFT' && (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-900 block">Draft Examination Schedule</span>
                          {!schedule.secondExaminerProfileId && !schedule.secondExaminer ? (
                            <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-300 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Requires 2nd Examiner
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Examiners Compliant
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-amber-800 mt-1">
                          {!schedule.secondExaminerProfileId && !schedule.secondExaminer ? (
                            <span className="text-rose-700 font-medium">
                              Regulatory Compliance Enforcement: An examination cannot be planned or activated without an assigned Second Examiner. Assign a compliant Second Examiner before activating.
                            </span>
                          ) : (
                            'Both First and Second Examiners are assigned. Ready for HOD activation to initialize deadlines and workflow.'
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isHod && !schedule.secondExaminerProfileId && !schedule.secondExaminer && (
                          <button
                            onClick={handleOpenAssignModal}
                            className="px-3.5 py-2 bg-rose-800 hover:bg-rose-900 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Assign 2nd Examiner</span>
                          </button>
                        )}
                        {isHod && (
                          <button
                            onClick={handleActivateDraft}
                            disabled={loading || (!schedule.secondExaminerProfileId && !schedule.secondExaminer)}
                            className="px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition shadow-sm"
                            title={(!schedule.secondExaminerProfileId && !schedule.secondExaminer) ? 'Cannot activate without an assigned Second Examiner' : 'Activate Examination Schedule'}
                          >
                            Activate Schedule
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* HOD Supervisory Mode Notification (Separation of Duties) */}
                  {isHod && !isFirstExaminer && !isSecondExaminer && (
                    <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300 flex items-start sm:items-center justify-between gap-3 text-xs text-slate-700 shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <Shield className="w-5 h-5 text-slate-600 shrink-0" />
                        <div>
                          <strong className="text-slate-900 block font-semibold">Viewing as Head of Department (Supervisory & Approving Authority)</strong>
                          <span className="text-slate-600">
                            In accordance with RUSL Examination Regulations & the Four-Eyes Principle, report uploads and OTP verifications are strictly reserved for the assigned examiners and AR Office. Please log in with the assigned examiner or AR account to perform these actions.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Phase 1: First Marking Actions */}
                  <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center">1</span>
                        <h3 className="font-bold text-slate-900 text-sm">Phase 1: First Marking & Physical Handover</h3>
                      </div>
                      <span className="text-xs text-slate-500">3-Month Calendar Deadline</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Step A: Script Custody & OTP Generation (AR Office) */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700">A. Script Packet Custody (AR Office)</span>
                          {schedule.firstMarking?.collectedAt ? (
                            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Handed Over
                            </span>
                          ) : schedule.workflowStatus === 'FIRST_COLLECTION_REQUESTED' ? (
                            <span className="text-xs text-blue-700 font-medium">Ready for Collection</span>
                          ) : (
                            <span className="text-xs text-amber-700 font-medium">Pending Custody Check</span>
                          )}
                        </div>

                        {schedule.firstMarking?.collectedAt ? (
                          <div className="text-xs text-slate-600 space-y-1">
                            <div>Collected: <span className="font-semibold">{new Date(schedule.firstMarking.collectedAt).toLocaleString()}</span></div>
                            <div>Verified Script Count: <span className="font-semibold">{schedule.firstMarking.scriptCount} scripts</span></div>
                            <div>
                              Original Due Date: <span className="font-semibold text-blue-700">
                                {schedule.firstMarking.originalDueDate ? new Date(schedule.firstMarking.originalDueDate).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                          </div>
                        ) : canActAsAr ? (
                          <div className="space-y-2">
                            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900">
                              <div className="font-semibold flex items-center gap-1.5">
                                <Bell className="w-3.5 h-3.5 text-rose-700" />
                                <span>Examinations Branch (AR Office) Script Custody</span>
                              </div>
                              <p className="mt-0.5 text-[11px] text-rose-700">
                                Enter the verified paper packet script count and generate the single-use collection OTP. This notifies First Examiner ({schedule.firstExaminer?.fullName || 'Assigned Lecturer'}) to collect packets in person.
                              </p>
                            </div>
                            <label className="text-xs text-slate-600 block">Verified Paper Packet Script Count:</label>
                            <input
                              type="number"
                              min="1"
                              value={scriptCountInput}
                              onChange={(e) => setScriptCountInput(parseInt(e.target.value, 10))}
                              className="w-full px-3 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-rose-500"
                            />
                            <button
                              onClick={handleArGenerateCollectionOtp}
                              disabled={loading}
                              className="w-full py-2 bg-rose-800 hover:bg-rose-900 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{schedule.workflowStatus === 'FIRST_COLLECTION_REQUESTED' ? 'Re-issue OTP & Alert 1st Examiner' : 'Generate OTP & Alert 1st Examiner'}</span>
                            </button>
                          </div>
                        ) : isFirstExaminer ? (
                          <div className="space-y-2">
                            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                              <div className="font-semibold flex items-center gap-1.5 text-blue-800">
                                <FileText className="w-3.5 h-3.5 text-blue-600" />
                                <span>Examinations Branch Packet Custody</span>
                              </div>
                              <p className="text-[11px] text-blue-700">
                                {schedule.workflowStatus === 'FIRST_COLLECTION_REQUESTED'
                                  ? 'Your physical answer scripts have been counted, verified, and are ready for collection at the Examinations Branch counter (AR Office).'
                                  : 'Examinations Branch (AR Office) is currently counting and preparing the exam packets. Once ready, the AR Office will generate your collection OTP.'}
                              </p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
                              <span className="text-slate-600">Paper Packet Script Count:</span>
                              <span className="font-bold text-slate-900">
                                {schedule.firstMarking?.scriptCount ? `${schedule.firstMarking.scriptCount} scripts` : 'Counting in progress by AR Office'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              * Script count details are held and verified exclusively by Examinations Branch (AR Office).
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2 text-xs text-slate-600">
                            <div>Paper Packet Script Count: <span className="font-semibold">{schedule.firstMarking?.scriptCount ? `${schedule.firstMarking.scriptCount} scripts` : 'Held in AR Office'}</span></div>
                            <p className="text-[11px] text-slate-500">Examinations Branch (AR Office) holds script count details and issues the collection OTP.</p>
                          </div>
                        )}
                      </div>

                      {/* Step B: Confirm Physical Collection OTP (First Examiner) */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700">B. Physical Handover Confirmation</span>
                          {schedule.firstMarking?.collectedAt ? (
                            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Handover Confirmed
                            </span>
                          ) : (
                            <span className="text-xs text-amber-700 font-medium">Pending Confirmation</span>
                          )}
                        </div>

                        {schedule.firstMarking?.collectedAt ? (
                          <p className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Confirmed on {new Date(schedule.firstMarking.collectedAt).toLocaleDateString()}
                          </p>
                        ) : schedule.workflowStatus === 'FIRST_COLLECTION_REQUESTED' ? (
                          isFirstExaminer ? (
                            <div className="space-y-2">
                              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                                <div className="font-bold flex items-center gap-1 text-emerald-800">
                                  <Key className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Enter Collection Confirmation OTP</span>
                                </div>
                                <p className="text-[11px] text-emerald-700 mt-0.5">
                                  Enter the 6-digit OTP code received from the AR Office / email to confirm physical collection of {schedule.firstMarking?.scriptCount || 50} scripts.
                                </p>
                              </div>
                              <input
                                type="text"
                                maxLength={6}
                                placeholder="Enter 6-digit OTP"
                                value={collectionOtpInput}
                                onChange={(e) => setCollectionOtpInput(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs border rounded-lg font-mono tracking-widest text-center"
                              />
                              <button
                                onClick={handleVerifyCollectionOtp}
                                disabled={loading || collectionOtpInput.length < 6}
                                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50 shadow-sm"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Confirm Collection & Start Marking</span>
                              </button>
                            </div>
                          ) : canActAsAr ? (
                            <div className="space-y-2">
                              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                                <div className="font-semibold flex items-center gap-1 text-amber-800">
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Awaiting Examiner Handover Confirmation</span>
                                </div>
                                <p className="text-[11px] text-amber-700 mt-0.5">
                                  OTP issued to First Examiner ({schedule.firstExaminer?.fullName}). Waiting for examiner to collect packets and confirm receipt.
                                </p>
                              </div>
                              <div className="pt-1 border-t border-slate-200">
                                <label className="text-[11px] text-slate-500 block mb-1">Countertop Assistance (if examiner is at the counter):</label>
                                <input
                                  type="text"
                                  maxLength={6}
                                  placeholder="Enter 6-digit OTP"
                                  value={collectionOtpInput}
                                  onChange={(e) => setCollectionOtpInput(e.target.value)}
                                  className="w-full px-3 py-1.5 text-xs border rounded-lg font-mono tracking-widest text-center mb-1.5"
                                />
                                <button
                                  onClick={handleVerifyCollectionOtp}
                                  disabled={loading || collectionOtpInput.length < 6}
                                  className="w-full py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Verify on Examiner's Behalf</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">
                              Awaiting First Examiner ({schedule.firstExaminer?.fullName || 'Assigned Lecturer'}) to collect scripts and enter confirmation OTP.
                            </p>
                          )
                        ) : (
                          <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-500">
                            {canActAsAr
                              ? 'Enter the paper packet script count in Step A and generate the OTP to issue scripts to First Examiner.'
                              : 'Examinations Branch (AR Office) will generate the collection OTP once paper packets are ready.'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step C: Upload First Marking Report & Return Scripts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700">C. First Marking Report PDF</span>
                          {schedule.firstMarking?.reportDocumentId && (
                            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Uploaded
                            </span>
                          )}
                        </div>

                        {schedule.firstMarking?.reportDocumentId ? (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                            <Lock className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <div>
                              <span className="font-semibold block">1st Marking Report Uploaded & Locked</span>
                              <span className="text-slate-600">The 1st marking report has been submitted. No further uploads or modifications are permitted.</span>
                            </div>
                          </div>
                        ) : !schedule.firstMarking?.collectedAt ? (
                          <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-2">
                            <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <span>Scripts must be collected and verified by AR Office before uploading the 1st marking report.</span>
                          </div>
                        ) : isFirstExaminer ? (
                          <div className="space-y-2">
                            <label className="border border-dashed border-slate-300 rounded-lg p-3 block text-center cursor-pointer hover:bg-slate-100 transition">
                              <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                              <span className="text-xs text-slate-600 block">Click to upload 1st Marking Report (PDF)</span>
                              <input type="file" accept=".pdf" onChange={handleUploadFirstReport} className="hidden" />
                            </label>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">
                            Restricted: Only the assigned First Examiner ({schedule.firstExaminer?.fullName || 'Designated Lecturer'}) can upload the 1st Marking Report.
                          </p>
                        )}
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700">D. Return Scripts to AR</span>
                          {schedule.firstMarking?.returnedAt ? (
                            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Returned
                            </span>
                          ) : (
                            <span className="text-xs text-amber-700 font-medium">Pending Return</span>
                          )}
                        </div>

                        {schedule.firstMarking?.returnedAt ? (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <div>
                              <span className="font-semibold block">Scripts Returned to AR (Locked)</span>
                              <span className="text-slate-600">Returned on: {new Date(schedule.firstMarking.returnedAt).toLocaleString()}</span>
                            </div>
                          </div>
                        ) : !schedule.firstMarking?.reportDocumentId ? (
                          <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-2">
                            <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <span>1st Marking Report must be uploaded before generating script return OTP.</span>
                          </div>
                        ) : isFirstExaminer ? (
                          activeReturnOtp ? (
                            <div className="space-y-2">
                              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center space-y-1">
                                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest block">Single-Use Return Handover OTP</span>
                                <div className="font-mono text-3xl font-extrabold tracking-widest text-indigo-900 my-1">{activeReturnOtp}</div>
                                <p className="text-[11px] text-indigo-700">
                                  Provide this 6-digit code to the AR Office officer upon handing over your physical paper packets.
                                </p>
                              </div>
                              <button
                                onClick={handleRequestReturnOtp}
                                disabled={loading}
                                className="w-full py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Regenerate Return OTP</span>
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                                <p className="text-[11px] text-blue-700">
                                  1st Marking complete! Click below to generate your single-use Return Handover OTP to give to the AR Office when depositing the physical scripts.
                                </p>
                              </div>
                              <button
                                onClick={handleRequestReturnOtp}
                                disabled={loading}
                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
                              >
                                <Key className="w-3.5 h-3.5" />
                                <span>Generate Handover OTP for AR Office</span>
                              </button>
                            </div>
                          )
                        ) : canActAsAr ? (
                          <div className="space-y-2">
                            <div className="p-2.5 bg-amber-50 border border-amber-200 text-xs text-amber-900">
                              <span className="font-semibold block">Examinations Branch Custody Receipt</span>
                              <p className="text-[11px] text-amber-700 mt-0.5">
                                Enter the 6-digit Return OTP provided by First Examiner ({schedule.firstExaminer?.fullName}) to confirm physical receipt of marked paper packets.
                              </p>
                            </div>
                            <input
                              type="text"
                              maxLength={6}
                              placeholder="Enter 6-digit Return OTP"
                              value={returnOtpInput}
                              onChange={(e) => setReturnOtpInput(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs border rounded-lg font-mono tracking-widest text-center"
                            />
                            <button
                              onClick={handleVerifyReturnOtp}
                              disabled={loading || returnOtpInput.length < 6}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50 shadow-sm"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Confirm Return & Accept Scripts</span>
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">
                            Awaiting First Examiner ({schedule.firstExaminer?.fullName}) to return marked scripts to AR Office.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Phase 2: Second Marking & Courier */}
                  <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 font-bold text-xs flex items-center justify-center">2</span>
                        <h3 className="font-bold text-slate-900 text-sm">Phase 2: Second Marking & Courier Logistics</h3>
                      </div>
                      <span className="text-xs text-slate-500">1-Month Calendar Deadline</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Step A: Courier Dispatch */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <span className="text-xs font-semibold text-slate-700 block">A. Courier Dispatch by AR</span>
                        {schedule.secondMarking?.courierDispatchedAt ? (
                          <div className="text-xs text-slate-600 space-y-1">
                            <div>Dispatched: <span className="font-semibold">{new Date(schedule.secondMarking.courierDispatchedAt).toLocaleString()}</span></div>
                            <div>Ref: <span className="font-mono">{schedule.secondMarking.courierReference || 'N/A'}</span></div>
                            <div>
                              Due Date: <span className="font-semibold text-purple-700">
                                {schedule.secondMarking.originalDueDate ? new Date(schedule.secondMarking.originalDueDate).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                          </div>
                        ) : !schedule.firstMarking?.returnedAt ? (
                          <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-2">
                            <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <span>1st marking scripts must be returned to AR Office before dispatching to Second Examiner.</span>
                          </div>
                        ) : canActAsAr ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder="Courier Reference / Tracking No."
                              value={courierRefInput}
                              onChange={(e) => setCourierRefInput(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs border rounded-lg"
                            />
                            <button
                              onClick={handleCourierDispatch}
                              disabled={loading || !schedule.secondExaminerProfileId}
                              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Dispatch Courier</span>
                            </button>
                            {!schedule.secondExaminerProfileId && (
                              <p className="text-[11px] text-rose-600">Second examiner must be assigned before dispatch.</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">Restricted: Only AR Office officers can dispatch courier packages.</p>
                        )}
                      </div>

                      {/* Step B: Second Examiner Receipt & Report */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <span className="text-xs font-semibold text-slate-700 block">B. 2nd Examiner Acknowledgment & Report</span>
                        {schedule.secondMarking?.acknowledgedAt ? (
                          <p className="text-xs text-emerald-700 font-medium">
                            Acknowledged: {new Date(schedule.secondMarking.acknowledgedAt).toLocaleString()}
                          </p>
                        ) : isSecondExaminer && schedule.secondMarking?.courierDispatchedAt ? (
                          <button
                            onClick={handleAcknowledgeReceipt}
                            disabled={loading}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition"
                          >
                            Acknowledge Receipt of Scripts
                          </button>
                        ) : (
                          <p className="text-xs text-slate-500">
                            {schedule.secondMarking?.courierDispatchedAt
                              ? `Restricted: Waiting for assigned Second Examiner (${schedule.secondExaminer?.user.fullName || 'Designated Examiner'}) to acknowledge receipt.`
                              : 'Pending courier dispatch before acknowledgment.'}
                          </p>
                        )}

                        {schedule.secondMarking?.reportDocumentId ? (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2 mt-2">
                            <Lock className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <div>
                              <span className="font-semibold block">2nd Marking Report Uploaded & Locked</span>
                              <span className="text-slate-600">The 2nd marking report has been submitted. No further uploads or modifications are permitted.</span>
                            </div>
                          </div>
                        ) : !schedule.secondMarking?.acknowledgedAt ? (
                          <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-2 mt-2">
                            <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <span>Receipt of scripts must be acknowledged before uploading 2nd marking report.</span>
                          </div>
                        ) : isSecondExaminer ? (
                          <div className="space-y-2 mt-2">
                            <label className="border border-dashed border-slate-300 rounded-lg p-3 block text-center cursor-pointer hover:bg-slate-100 transition">
                              <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                              <span className="text-xs text-slate-600 block">Upload 2nd Marking Report (PDF)</span>
                              <input type="file" accept=".pdf" onChange={handleUploadSecondReport} className="hidden" />
                            </label>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 mt-2">
                            Restricted: Only the assigned Second Examiner ({schedule.secondExaminer?.user.fullName || 'Designated Examiner'}) can upload the 2nd Marking Report.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Step C: Confirm AR Receipt of returned scripts */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-slate-700 block">C. Return Scripts Receipt by AR</span>
                        <p className="text-xs text-slate-500">
                          {schedule.secondMarking?.arReceivedAt
                            ? `Received on: ${new Date(schedule.secondMarking.arReceivedAt).toLocaleString()} (Locked)`
                            : !schedule.secondMarking?.reportDocumentId
                            ? 'Pending 2nd Marking Report upload before confirming return receipt.'
                            : 'Pending courier return confirmation to AR Office'}
                        </p>
                      </div>

                      {canActAsAr && !schedule.secondMarking?.arReceivedAt && schedule.secondMarking?.reportDocumentId && (
                        <button
                          onClick={handleConfirmArReceipt}
                          disabled={loading}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition"
                        >
                          Confirm AR Receipt
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Phase 3: Final Marksheet & Approval */}
                  <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">3</span>
                        <h3 className="font-bold text-slate-900 text-sm">Phase 3: Final Marksheet Submission & HOD Approval</h3>
                      </div>
                      <span className="text-xs text-slate-500">Permanent Lock on Approval</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Upload and Submit */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                        <span className="text-xs font-semibold text-slate-700 block">A. Final Marksheet PDF</span>
                        {schedule.workflowStatus === 'FINAL_MARKSHEET_SUBMITTED' || schedule.workflowStatus === 'APPROVED_LOCKED' ? (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                            <Lock className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <div>
                              <span className="font-semibold block">Final Marksheet Submitted & Locked</span>
                              <span className="text-slate-600">
                                {schedule.workflowStatus === 'APPROVED_LOCKED'
                                  ? 'Final marksheet has been approved and permanently locked by HOD.'
                                  : 'Final marksheet has been submitted to HOD and is locked pending review.'}
                              </span>
                            </div>
                          </div>
                        ) : !schedule.secondMarking?.arReceivedAt ? (
                          <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center gap-2">
                            <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <span>Phase 2 (Second Marking & script return to AR) must be completed before compiling Final Marksheet.</span>
                          </div>
                        ) : isFirstExaminer ? (
                          <div className="space-y-2">
                            <label className="border border-dashed border-slate-300 rounded-lg p-3 block text-center cursor-pointer hover:bg-slate-100 transition">
                              <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                              <span className="text-xs text-slate-600 block">Upload Final Marksheet (PDF)</span>
                              <input type="file" accept=".pdf" onChange={handleUploadFinalMarksheet} className="hidden" />
                            </label>

                            {schedule.finalResult?.finalMarksheetDocumentId && (
                              <button
                                onClick={handleSubmitFinalMarksheet}
                                disabled={loading}
                                className="w-full py-2 bg-red-800 hover:bg-red-900 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Submit Final Marksheet for HOD Review</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">
                            Restricted: Only the assigned First Examiner ({schedule.firstExaminer?.fullName || 'Designated Lecturer'}) can compile CA marks and submit the final marksheet.
                          </p>
                        )}
                      </div>

                      {/* HOD Review & Decision */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                        <span className="text-xs font-semibold text-slate-700 block">B. HOD Review & Approval</span>
                        {isHod ? (
                          <div className="space-y-2">
                            <button
                              onClick={handleApproveFinalMarksheet}
                              disabled={loading || schedule.workflowStatus !== 'FINAL_MARKSHEET_SUBMITTED'}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Grant Final Approval & Lock Workflow</span>
                            </button>

                            <div className="pt-2">
                              <input
                                type="text"
                                placeholder="Revision reason if requesting changes"
                                value={revisionReasonInput}
                                onChange={(e) => setRevisionReasonInput(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs border rounded-lg mb-1.5"
                              />
                              <button
                                onClick={handleRequestChanges}
                                disabled={loading || !revisionReasonInput.trim()}
                                className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium transition disabled:opacity-50"
                              >
                                Request Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">Awaiting HOD final review and approval.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Extension Request Section (Assigned Examiners Only) */}
                  {(isFirstExaminer || isSecondExaminer) && !isLocked && (
                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                          Request Deadline Extension
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {isFirstExaminer ? 'First Examiner (1st Marking)' : 'Second Examiner (2nd Marking)'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-600 block mb-1">Target Phase:</label>
                          <select
                            value={isFirstExaminer && !isSecondExaminer ? 'FIRST_MARKING' : isSecondExaminer && !isFirstExaminer ? 'SECOND_MARKING' : extensionPhase}
                            onChange={(e: any) => setExtensionPhase(e.target.value)}
                            disabled={isFirstExaminer !== isSecondExaminer}
                            className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-600"
                          >
                            {isFirstExaminer && <option value="FIRST_MARKING">1st Marking (3-Month)</option>}
                            {isSecondExaminer && <option value="SECOND_MARKING">2nd Marking (1-Month)</option>}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-600 block mb-1">Requested New Due Date:</label>
                          <input
                            type="date"
                            value={extensionDateInput}
                            onChange={(e) => setExtensionDateInput(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-600 block mb-1">Mandatory Reason:</label>
                          <input
                            type="text"
                            placeholder="State medical or logistical grounds"
                            value={extensionReasonInput}
                            onChange={(e) => setExtensionReasonInput(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleRequestExtension}
                        disabled={loading || !extensionDateInput || !extensionReasonInput.trim()}
                        className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
                      >
                        Submit Extension Request to HOD
                      </button>
                    </div>
                  )}

                  {/* For HOD: Notice that examiners must initiate extensions, review is on HOD dashboard */}
                  {isHod && !isFirstExaminer && !isSecondExaminer && (
                    <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 text-xs text-blue-900 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span>Deadline extensions must be requested by the assigned First Examiner or Second Examiner. Review pending requests from your <strong>HOD Dashboard</strong>.</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 2: SCHEDULE & CHECKPOINTS */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Personnel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
                    First Examiner
                  </span>
                  {schedule.firstExaminer ? (
                    <div className="flex items-start gap-3.5">
                      <LecturerAvatar
                        name={schedule.firstExaminer.fullName}
                        imageUrl={schedule.firstExaminer.profilePictureUrl}
                        size="lg"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 truncate">{schedule.firstExaminer.fullName}</div>
                        <div className="text-xs text-slate-500 truncate">{schedule.firstExaminer.designation}</div>
                        <div className="text-xs text-slate-500 truncate">{schedule.firstExaminer.email}</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Not assigned</p>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Second Examiner
                    </span>
                    {isHod && !isLocked && (
                      <button
                        onClick={handleOpenAssignModal}
                        className="text-xs text-red-800 hover:text-red-900 font-semibold underline"
                      >
                        {schedule.secondExaminer ? 'Change' : 'Assign Candidate'}
                      </button>
                    )}
                  </div>

                  {schedule.secondExaminer ? (
                    <div className="flex items-start gap-3.5">
                      <LecturerAvatar
                        name={schedule.secondExaminer.user.fullName}
                        imageUrl={schedule.secondExaminer.user.profilePictureUrl}
                        size="lg"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 truncate">{schedule.secondExaminer.user.fullName}</div>
                        <div className="text-xs text-slate-500 truncate">{schedule.secondExaminer.user.designation}</div>
                        <div className="text-xs text-slate-500 truncate">
                          {schedule.secondExaminer.institution} ({schedule.secondExaminer.examinerType})
                        </div>
                      </div>
                    </div>
                  ) : (() => {
                    const activeInv = schedule.invitations?.find(i => ['INVITED', 'ACCEPTED_PENDING_HOD'].includes(i.status));
                    if (activeInv) {
                      if (activeInv.status === 'ACCEPTED_PENDING_HOD') {
                        return (
                          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs space-y-2">
                            <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                              <span>Nomination Accepted by Candidate</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <LecturerAvatar
                                name={activeInv.requestedName}
                                imageUrl={activeInv.examinerProfile?.user?.profilePictureUrl}
                                size="sm"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-slate-900 truncate">{activeInv.requestedName}</div>
                                <div className="text-[11px] text-slate-500">{activeInv.requestedAffiliation || 'Examiner'}</div>
                              </div>
                            </div>
                            <p className="text-[11px] text-emerald-800">
                              Candidate has accepted the nomination. Submitted to HOD for final regulatory review and approval.
                            </p>
                            {isHod && (
                              <div className="flex items-center gap-2 pt-1 border-t border-emerald-200">
                                <button
                                  onClick={() => handleReviewInvitation(activeInv.id, true)}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded text-xs shadow-sm"
                                >
                                  Approve & Confirm Assignment
                                </button>
                                <button
                                  onClick={() => handleReviewInvitation(activeInv.id, false)}
                                  className="px-2.5 py-1 text-rose-700 hover:bg-rose-50 border border-rose-300 rounded text-xs"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      } else {
                        return (
                          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs space-y-2">
                            <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-700" />
                              <span>Nomination Sent to Lecturer</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <LecturerAvatar
                                name={activeInv.requestedName}
                                imageUrl={activeInv.examinerProfile?.user?.profilePictureUrl}
                                size="sm"
                              />
                              <div>
                                <strong className="text-slate-900">{activeInv.requestedName}</strong>
                              </div>
                            </div>
                            <p className="text-[11px] text-amber-800">
                              Waiting for nominee to sign in, review, and accept. Once accepted, HOD will review and approve.
                            </p>
                          </div>
                        );
                      }
                    }

                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-amber-700 italic">No Second Examiner assigned yet.</p>
                        {isFirstExaminer && !schedule.secondExaminer && (
                          <button
                            onClick={handleOpenAssignModal}
                            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Nominate 2nd Examiner</span>
                          </button>
                        )}
                        {isHod && (
                          <button
                            onClick={handleOpenAssignModal}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium"
                          >
                            Select Compliant Candidate
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Deadlines Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-3">Phase</th>
                      <th className="p-3">Trigger Event</th>
                      <th className="p-3">Original Due Date</th>
                      <th className="p-3">Approved Extension</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-3 font-semibold text-slate-800">First Marking (3 Months)</td>
                      <td className="p-3 text-slate-600">
                        {schedule.firstMarking?.collectedAt
                          ? `Collected: ${new Date(schedule.firstMarking.collectedAt).toLocaleDateString()}`
                          : 'Not collected'}
                      </td>
                      <td className="p-3 font-mono">
                        {schedule.firstMarking?.originalDueDate
                          ? new Date(schedule.firstMarking.originalDueDate).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="p-3 font-mono text-purple-700">
                        {schedule.firstMarking?.extendedDueDate
                          ? new Date(schedule.firstMarking.extendedDueDate).toLocaleDateString()
                          : 'None'}
                      </td>
                      <td className="p-3">
                        {schedule.firstMarking?.returnedAt ? (
                          <span className="text-emerald-700 font-semibold">Returned</span>
                        ) : schedule.firstMarkingOverdue ? (
                          <span className="text-rose-600 font-semibold">Overdue</span>
                        ) : (
                          <span className="text-slate-500">In Progress</span>
                        )}
                      </td>
                    </tr>

                    <tr>
                      <td className="p-3 font-semibold text-slate-800">Second Marking (1 Month)</td>
                      <td className="p-3 text-slate-600">
                        {schedule.secondMarking?.courierDispatchedAt
                          ? `Dispatched: ${new Date(schedule.secondMarking.courierDispatchedAt).toLocaleDateString()}`
                          : 'Not dispatched'}
                      </td>
                      <td className="p-3 font-mono">
                        {schedule.secondMarking?.originalDueDate
                          ? new Date(schedule.secondMarking.originalDueDate).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="p-3 font-mono text-purple-700">
                        {schedule.secondMarking?.extendedDueDate
                          ? new Date(schedule.secondMarking.extendedDueDate).toLocaleDateString()
                          : 'None'}
                      </td>
                      <td className="p-3">
                        {schedule.secondMarking?.arReceivedAt ? (
                          <span className="text-emerald-700 font-semibold">Received by AR</span>
                        ) : schedule.secondMarkingOverdue ? (
                          <span className="text-rose-600 font-semibold">Overdue</span>
                        ) : (
                          <span className="text-slate-500">In Progress</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Documents are stored in private storage and accessed via short-lived signed tokens with re-authorization checks.
                </span>
              </div>

              {schedule.documents && schedule.documents.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="p-3">Type</th>
                        <th className="p-3">Filename</th>
                        <th className="p-3">Version</th>
                        <th className="p-3">Size</th>
                        <th className="p-3">Uploaded</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedule.documents.map((doc) => (
                        <tr key={doc.id}>
                          <td className="p-3 font-semibold text-slate-800">{doc.documentType}</td>
                          <td className="p-3 text-slate-600">{doc.originalFilename}</td>
                          <td className="p-3 font-mono">v{doc.version}</td>
                          <td className="p-3 text-slate-500">{(doc.fileSizeBytes / 1024).toFixed(1)} KB</td>
                          <td className="p-3 text-slate-500">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                          <td className="p-3 text-right">
                            {isAr ? (
                              <span className="text-[11px] text-slate-400 italic">Downloads restricted for AR Office</span>
                            ) : (
                              <button
                                onClick={() => handleDownloadDocument(doc.id, doc.originalFilename)}
                                className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-800 rounded-lg font-medium inline-flex items-center gap-1 transition"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No documents have been uploaded for this schedule yet.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: HISTORY / AUDIT EVENTS */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {schedule.workflowEvents && schedule.workflowEvents.length > 0 ? (
                <div className="relative border-l-2 border-slate-200 ml-4 space-y-4 py-2">
                  {schedule.workflowEvents.map((evt) => (
                    <div key={evt.id} className="relative pl-6">
                      <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-slate-900 border-2 border-white" />
                      <div className="text-xs text-slate-400 font-mono">
                        {new Date(evt.createdAt).toLocaleString()}
                      </div>
                      <div className="text-sm font-semibold text-slate-800">{evt.description}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Actor: <span className="font-medium text-slate-700">{evt.actor?.fullName}</span> ({evt.actor?.designation})
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No workflow events recorded yet.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Schedule ID: {schedule.id}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* OTP Display Modal (Shows generated 6-digit code securely to requester) */}
      {otpModalData && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">{otpModalData.title}</h3>
              <p className="text-xs text-slate-500 mt-1">
                Communicate this one-time verification code in-person during physical handover.
              </p>
            </div>

            <div className="py-4 bg-slate-900 text-amber-300 font-mono text-3xl font-bold tracking-widest rounded-xl">
              {otpModalData.otp}
            </div>

            <p className="text-xs text-rose-600 font-medium">
              Expires at: {new Date(otpModalData.expiresAt).toLocaleTimeString()} (Single-use, 5 attempts max)
            </p>

            <div className="space-y-2">
              <button
                onClick={() => setOtpModalData(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition"
              >
                Done / Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Selection Modal (Seniority Check & X/3 Load limits) */}
      {showAssignModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">
                  {isFirstExaminer ? 'Nominate Second Examiner (Subject Request)' : 'Assign Compliant Second Examiner'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isFirstExaminer
                    ? 'Request a qualified lecturer to serve as Second Examiner. Nominee must accept and HOD will grant final approval.'
                    : 'Enforcing academic eligibility and maximum 3 active assigned subjects.'}
                </p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
              {loadingCandidates ? (
                <div className="p-6 text-center text-xs text-slate-500">Loading candidate examiners...</div>
              ) : (
                candidates.map((c) => (
                  <div
                    key={c.id}
                    className={`py-3 flex items-center justify-between ${!c.isEligible ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <LecturerAvatar
                        name={c.fullName}
                        imageUrl={c.profilePictureUrl}
                        size="md"
                      />
                      <div>
                        <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                          <span>{c.fullName}</span>
                        </div>
                        <div className="text-xs text-slate-500">{c.designation} • {c.institution}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[11px] font-medium ${c.isUnderLimit ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {c.slotsFilledLabel}
                          </span>
                          {!c.isEligible && (
                            <span className="text-[11px] text-rose-600 font-medium">({c.ineligibilityReason})</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSelectCandidate(c)}
                      disabled={!c.isEligible || loading}
                      className={`px-3 py-1.5 text-white rounded-lg text-xs font-semibold transition disabled:opacity-40 ${
                        isFirstExaminer ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-800 hover:bg-red-900'
                      }`}
                    >
                      {isFirstExaminer ? 'Nominate' : 'Assign'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
