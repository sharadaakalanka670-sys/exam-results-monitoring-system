import React, { useState, useEffect } from 'react';
import { User, ExamSchedule } from '../types';
import { api } from '../api/client';
import { StatusBadge } from './StatusBadge';
import { LecturerAvatar } from './LecturerAvatar';
import {
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Lock,
  UserCheck,
  Send,
  Plus,
  Search,
  Filter,
  Check,
  X
} from 'lucide-react';

interface Props {
  user: User;
  onSelectSchedule: (schedule: ExamSchedule) => void;
}

export const HodDashboard: React.FC<Props> = ({ user, onSelectSchedule }) => {
  const [data, setData] = useState<any>(null);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Draft Creation Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>('');
  const [examDateInput, setExamDateInput] = useState<string>('');
  const [firstExaminerInput, setFirstExaminerInput] = useState<string>('');
  const [secondExaminerInput, setSecondExaminerInput] = useState<string>('');
  const [candidateSecondExaminers, setCandidateSecondExaminers] = useState<any[]>([]);
  const [lecturers, setLecturers] = useState<any[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dashRes, schedRes] = await Promise.all([
        api.get('/dashboards/hod'),
        api.get('/exam-schedules')
      ]);
      setData(dashRes.data);
      setSchedules(schedRes.data);
    } catch (err) {
      console.error('Failed to load HOD dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreateModal = async () => {
    setShowCreateModal(true);
    try {
      const [offRes, candRes] = await Promise.all([
        api.get('/course-offerings'),
        api.get('/examiners/candidates')
      ]);
      setOfferings(offRes.data);
      setLecturers(candRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFirstExaminerChange = async (userIdStr: string) => {
    setFirstExaminerInput(userIdStr);
    setSecondExaminerInput('');
    if (!userIdStr) {
      setCandidateSecondExaminers([]);
      return;
    }
    try {
      const res = await api.get(`/examiners/candidates?firstExaminerUserId=${userIdStr}`);
      setCandidateSecondExaminers(res.data);
    } catch (err) {
      console.error('Failed to load compliant candidates:', err);
    }
  };

  const handleCreateAndActivateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferingId || !examDateInput || !firstExaminerInput || !secondExaminerInput) {
      alert('Cannot plan or activate exam: Both First Examiner and Second Examiner must be assigned in compliance with university examination regulations.');
      return;
    }

    try {
      // 1. Create draft with both examiners
      const draftRes = await api.post('/exam-schedules', {
        courseOfferingId: parseInt(selectedOfferingId, 10),
        examDate: examDateInput,
        firstExaminerUserId: parseInt(firstExaminerInput, 10),
        secondExaminerProfileId: parseInt(secondExaminerInput, 10),
      });

      // 2. Activate with HOD authority
      await api.post(`/exam-schedules/${draftRes.data.id}/activate`, {
        examDate: examDateInput,
        firstExaminerUserId: parseInt(firstExaminerInput, 10),
        secondExaminerProfileId: parseInt(secondExaminerInput, 10),
      });

      setShowCreateModal(false);
      setSelectedOfferingId('');
      setExamDateInput('');
      setFirstExaminerInput('');
      setSecondExaminerInput('');
      setCandidateSecondExaminers([]);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create and activate schedule');
    }
  };

  const handleReviewExtension = async (requestId: number, approved: boolean) => {
    const reason = prompt(`Enter ${approved ? 'approval' : 'rejection'} remark:`) || '';
    try {
      await api.post(`/extension-requests/${requestId}/review`, {
        approved,
        decisionReason: reason
      });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to review extension');
    }
  };

  const handleReviewInvitation = async (invitationId: number, approved: boolean) => {
    const reason = prompt(`Enter ${approved ? 'approval' : 'rejection'} remark:`) || '';
    try {
      await api.post(`/invitations/${invitationId}/review`, {
        approved,
        decisionReason: reason
      });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to review invitation');
    }
  };

  const filteredSchedules = schedules.filter(s => {
    const matchesSearch =
      s.courseOffering.course.courseCode.toLowerCase().includes(search.toLowerCase()) ||
      s.courseOffering.course.courseTitle.toLowerCase().includes(search.toLowerCase()) ||
      (s.firstExaminer?.fullName || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus = filterStatus ? s.workflowStatus === filterStatus : true;
    return matchesSearch && matchesStatus;
  });

  if (loading && !data) {
    return <div className="p-8 text-center text-slate-500">Loading HOD Executive Dashboard...</div>;
  }

  const metrics = data?.metrics || {};
  const actionQueue = data?.actionQueue || {};
  const examinerLoad = data?.examinerLoad || [];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Welcome & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <LecturerAvatar
            name={user.fullName}
            imageUrl={user.profilePictureUrl}
            size="lg"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{user.fullName}</h2>
              <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full border border-red-200">
                Head of Department
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Monitoring paper marking progress, deadline enforcement, examiner assignments, and final marksheet approvals.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Activate New Exam Schedule</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 mb-1">Total Active</div>
          <div className="text-2xl font-bold text-slate-900">{metrics.totalSchedules || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-blue-600 mb-1">1st Marking</div>
          <div className="text-2xl font-bold text-blue-900">{metrics.firstMarkingActive || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-purple-600 mb-1">2nd Marking</div>
          <div className="text-2xl font-bold text-purple-900">{metrics.secondMarkingActive || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-orange-600 mb-1">Pending Approval</div>
          <div className="text-2xl font-bold text-orange-900">{metrics.pendingApprovalCount || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-rose-600 mb-1">Overdue Work</div>
          <div className="text-2xl font-bold text-rose-900">{metrics.overdueCount || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-emerald-600 mb-1">Locked & Approved</div>
          <div className="text-2xl font-bold text-emerald-900">{metrics.approvedLockedCount || 0}</div>
        </div>
      </div>

      {/* Urgent Action Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Queue 1: Pending Final Submissions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Send className="w-4 h-4 text-orange-600" />
              <span>Final Marksheets for Review</span>
            </h3>
            <span className="text-xs font-bold bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
              {actionQueue.pendingFinalSubmissions?.length || 0}
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {actionQueue.pendingFinalSubmissions?.length > 0 ? (
              actionQueue.pendingFinalSubmissions.map((s: any) => (
                <div
                  key={s.id}
                  onClick={() => onSelectSchedule(s)}
                  className="p-3 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-xs">
                      {s.courseOffering?.course?.courseCode} - {s.courseOffering?.course?.courseTitle}
                    </div>
                    <div className="text-[11px] text-slate-500">1st Examiner: {s.firstExaminer?.fullName}</div>
                  </div>
                  <span className="text-xs text-red-800 font-semibold underline">Review</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No final submissions pending review.</p>
            )}
          </div>
        </div>

        {/* Queue 2: Pending Deadline Extensions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-600" />
              <span>Deadline Extension Requests</span>
            </h3>
            <span className="text-xs font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
              {actionQueue.pendingExtensions?.length || 0}
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {actionQueue.pendingExtensions?.length > 0 ? (
              actionQueue.pendingExtensions.map((ext: any) => (
                <div key={ext.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">
                      {ext.examSchedule?.courseOffering?.course?.courseCode} ({ext.phase})
                    </span>
                    <span className="text-[10px] text-purple-700 font-semibold">
                      New: {new Date(ext.requestedDueDate).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 italic">"{ext.reason}"</p>
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      onClick={() => handleReviewExtension(ext.id, false)}
                      className="px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50 rounded"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleReviewExtension(ext.id, true)}
                      className="px-2.5 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No extension requests pending.</p>
            )}
          </div>
        </div>

        {/* Queue 3: 2nd Examiner Nominations & Approvals */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>2nd Examiner Nominations (HOD Approval)</span>
            </h3>
            <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              {actionQueue.pendingInvitations?.length || 0}
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {actionQueue.pendingInvitations?.length > 0 ? (
              actionQueue.pendingInvitations.map((inv: any) => (
                <div key={inv.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">{inv.requestedName}</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                      {inv.examinerProfile ? 'Academic Staff' : (inv.requestedAffiliation || 'External')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Course: <strong className="text-slate-800">{inv.examSchedule?.courseOffering?.course?.courseCode}</strong>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Nominated by: {inv.examSchedule?.firstExaminer?.fullName || 'First Examiner'}
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      {inv.status === 'ACCEPTED_PENDING_HOD' ? 'Accepted by Nominee' : 'Pending Review'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleReviewInvitation(inv.id, false)}
                        className="px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50 rounded border border-rose-200"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleReviewInvitation(inv.id, true)}
                        className="px-2.5 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded shadow-sm"
                      >
                        Approve Assignment
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">No examiner nominations pending HOD review.</p>
            )}
          </div>
        </div>
      </div>

      {/* Examiner Load Matrix (Section 7.1, 7.2) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Examiner Allocation & Active Load Matrix (X/3 Limit)</h3>
            <p className="text-xs text-slate-500">
              Department regulation: A Second Examiner cannot hold more than 3 active subjects simultaneously.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {examinerLoad.map((c: any) => (
            <div key={c.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <LecturerAvatar
                    name={c.fullName}
                    imageUrl={c.profilePictureUrl}
                    size="sm"
                  />
                  <span className="font-bold text-xs text-slate-900 truncate">{c.fullName}</span>
                </div>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                  {c.examinerType === 'INTERNAL' ? 'Internal' : 'External'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 line-clamp-1">{c.designation} • {c.institution}</div>
              <div className="pt-1">
                <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                  <span className={c.isUnderLimit ? 'text-emerald-700' : 'text-rose-600'}>
                    {c.slotsFilledLabel}
                  </span>
                  <span className="text-slate-400">{c.activeSubjectCount}/3</span>
                </div>
                {/* Visual Progress Bar */}
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      c.activeSubjectCount >= 3 ? 'bg-rose-600' : c.activeSubjectCount === 2 ? 'bg-amber-500' : 'bg-emerald-600'
                    }`}
                    style={{ width: `${(c.activeSubjectCount / 3) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All Schedules Monitoring Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900 text-sm">Examination Schedules Tracking</h3>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search course or examiner..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border rounded-lg w-52"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs border rounded-lg bg-white"
            >
              <option value="">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="FIRST_MARKING_ACTIVE">1st Marking Active</option>
              <option value="SECOND_MARKING_ACTIVE">2nd Marking Active</option>
              <option value="FINAL_MARKSHEET_SUBMITTED">Pending Approval</option>
              <option value="APPROVED_LOCKED">Approved & Locked</option>
            </select>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="p-3">Course Code</th>
                <th className="p-3">Course Title</th>
                <th className="p-3">Programme / Batch</th>
                <th className="p-3">1st Examiner</th>
                <th className="p-3">2nd Examiner</th>
                <th className="p-3">Exam Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSchedules.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onSelectSchedule(s)}
                  className="hover:bg-slate-50/80 cursor-pointer transition"
                >
                  <td className="p-3 font-mono font-bold text-slate-900">{s.courseOffering.course.courseCode}</td>
                  <td className="p-3 font-medium text-slate-800">{s.courseOffering.course.courseTitle}</td>
                  <td className="p-3 text-slate-500">
                    {s.courseOffering.programmeGroup.includes('IT') ? 'BSc IT' : 'Applied Sci'} • {s.courseOffering.batchLabel}
                  </td>
                  <td className="p-3 text-slate-700">
                    {s.firstExaminer ? (
                      <div className="flex items-center gap-2">
                        <LecturerAvatar
                          name={s.firstExaminer.fullName}
                          imageUrl={s.firstExaminer.profilePictureUrl}
                          size="xs"
                        />
                        <span className="font-medium truncate max-w-[120px]" title={s.firstExaminer.fullName}>
                          {s.firstExaminer.fullName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Not Assigned</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-700">
                    {s.secondExaminer ? (
                      <div className="flex items-center gap-2">
                        <LecturerAvatar
                          name={s.secondExaminer.user.fullName}
                          imageUrl={s.secondExaminer.user.profilePictureUrl}
                          size="xs"
                        />
                        <span className="font-medium truncate max-w-[120px]" title={s.secondExaminer.user.fullName}>
                          {s.secondExaminer.user.fullName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-amber-700 font-semibold text-[11px] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Pending 2nd Examiner
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-slate-500">
                    {s.examDate ? s.examDate.split('T')[0] : '—'}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={s.workflowStatus} isOverdue={s.isOverdue} size="sm" />
                  </td>
                  <td className="p-3 text-right">
                    <button className="text-red-800 font-semibold hover:underline">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Activate New Exam Schedule */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-slate-900">Activate New Exam Schedule</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAndActivateSchedule} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Select Course Offering:</label>
                <select
                  value={selectedOfferingId}
                  onChange={(e) => setSelectedOfferingId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
                >
                  <option value="">-- Choose Course Offering from Catalogue --</option>
                  {offerings.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.course.courseCode} - {o.course.courseTitle} ({o.batchLabel}, Sem {o.semester})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Confirmed Exam Date:</label>
                <input
                  type="date"
                  value={examDateInput}
                  onChange={(e) => setExamDateInput(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border rounded-lg"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Assign First Examiner:</label>
                <select
                  value={firstExaminerInput}
                  onChange={(e) => handleFirstExaminerChange(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
                >
                  <option value="">-- Choose Assigned First Examiner --</option>
                  {lecturers.map((l) => (
                    <option key={l.userId} value={l.userId}>
                      {l.fullName} ({l.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Assign Second Examiner (Mandatory Regulatory Requirement):
                </label>
                <select
                  value={secondExaminerInput}
                  onChange={(e) => setSecondExaminerInput(e.target.value)}
                  required
                  disabled={!firstExaminerInput}
                  className="w-full px-3 py-2 text-xs border rounded-lg bg-white disabled:bg-slate-100"
                >
                  <option value="">
                    {!firstExaminerInput
                      ? '-- Select First Examiner First to Filter Candidates --'
                      : '-- Choose Compliant Second Examiner (Load & Eligibility Validated) --'}
                  </option>
                  {candidateSecondExaminers.map((c) => (
                    <option key={c.id} value={c.id} disabled={!c.isEligible}>
                      {c.fullName} ({c.designation}) - {c.institution} [{c.slotsFilledLabel}] {!c.isEligible ? `(${c.ineligibilityReason})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-amber-700 mt-1">
                  * Regulatory Requirement: Second Examiner must meet academic appointment criteria and maximum 3 active subjects.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white rounded-lg text-xs font-semibold"
                >
                  Confirm & Activate Workflow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
