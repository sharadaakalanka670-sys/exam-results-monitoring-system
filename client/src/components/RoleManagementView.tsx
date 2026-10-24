import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { User, RoleName } from '../types';
import { LecturerAvatar } from './LecturerAvatar';
import {
  Users,
  Shield,
  ShieldCheck,
  UserPlus,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Search,
  Filter,
  Check,
  X,
  AlertCircle,
  UserCheck,
  Send,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface RoleRequest {
  id: number;
  roleId: number;
  role: { id: number; name: string };
  action: 'ADD' | 'REMOVE' | 'ASSIGN';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  targetUser: {
    id: number;
    fullName: string;
    username: string;
    email: string;
    designation: string;
  };
  requestedByUser?: {
    id: number;
    fullName: string;
    username: string;
  } | null;
  reviewedByUser?: {
    id: number;
    fullName: string;
  } | null;
  reason?: string | null;
  reviewNotes?: string | null;
  createdAt: string;
}

interface MemberUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  designation: string;
  phoneNumber?: string | null;
  profilePictureUrl?: string | null;
  institution?: string | null;
  examinerType?: 'INTERNAL' | 'EXTERNAL';
  seniorityLevel?: number | null;
  isVerified?: boolean;
  examinerProfileId?: number | null;
  roles: string[];
  pendingRequests: Array<{
    id: number;
    roleName: string;
    action: string;
    status: string;
    requestedBy: string;
    reason?: string;
  }>;
}

const ACADEMIC_DESIGNATIONS = [
  'Senior Professor',
  'Professor',
  'Associate Professor',
  'Senior Lecturer Grade I',
  'Senior Lecturer Grade II',
  'Lecturer (Confirmed)',
  'Lecturer (Probationary)',
  'Visiting Lecturer',
  'Assistant Lecturer',
  'Assistant Registrar',
  'HOD Clerk',
];

interface Props {
  user: User;
}

export const RoleManagementView: React.FC<Props> = ({ user }) => {
  const isHod = user.roles.includes('HOD');
  const isClerk = user.roles.includes('HOD_CLERK');

  const [activeSubTab, setActiveSubTab] = useState<'approvals' | 'members' | 'roles'>('approvals');
  const [members, setMembers] = useState<MemberUser[]>([]);
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal for Reviewing, Verifying & Editing Academic Profile (HOD Only)
  const [profileModalMember, setProfileModalMember] = useState<MemberUser | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editInstitution, setEditInstitution] = useState('');
  const [editExaminerType, setEditExaminerType] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [editProfileLoading, setEditProfileLoading] = useState(false);

  // Modal for Modifying / Requesting Role
  const [selectedMember, setSelectedMember] = useState<MemberUser | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [targetRoleId, setTargetRoleId] = useState<string>('');
  const [targetAction, setTargetAction] = useState<'ADD' | 'REMOVE'>('ADD');
  const [targetReason, setTargetReason] = useState('');

  // Form for Creating New Custom Role
  const [newRoleName, setNewRoleName] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [membersRes, requestsRes, rolesRes] = await Promise.all([
        api.get('/roles/users'),
        api.get('/roles/requests'),
        api.get('/roles/all'),
      ]);
      setMembers(membersRes.data);
      setRequests(requestsRes.data);
      setAvailableRoles(rolesRes.data);
      if (rolesRes.data.length > 0 && !targetRoleId) {
        setTargetRoleId(rolesRes.data[0].name);
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to load role governance data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');

  const handleApprove = async (requestId: number) => {
    try {
      setActionLoading(true);
      const res = await api.post(`/roles/requests/${requestId}/approve`, {
        reviewNotes: 'Authorized by Head of Department',
      });
      setFeedback({ type: 'success', message: res.data.message });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Approval failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (requestId: number) => {
    const reason = window.prompt('Please enter reason for declining this role request:');
    if (reason === null) return;

    try {
      setActionLoading(true);
      const res = await api.post(`/roles/requests/${requestId}/reject`, { reason });
      setFeedback({ type: 'success', message: res.data.message });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Rejection failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    try {
      setActionLoading(true);
      const res = await api.post('/roles/create-role', { name: newRoleName });
      setFeedback({ type: 'success', message: res.data.message });
      setNewRoleName('');
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Role creation failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenRoleModal = (member: MemberUser) => {
    setSelectedMember(member);
    setTargetRoleId(availableRoles[0]?.name || 'LECTURER');
    setTargetAction('ADD');
    setTargetReason('');
    setIsRoleModalOpen(true);
  };

  const handleSubmitRoleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !targetRoleId) return;

    try {
      setActionLoading(true);
      const res = await api.post('/roles/request-change', {
        targetUserId: selectedMember.id,
        roleName: targetRoleId,
        action: targetAction,
        reason: targetReason,
      });

      setFeedback({ type: 'success', message: res.data.message });
      setIsRoleModalOpen(false);
      setSelectedMember(null);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Role modification failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenProfileModal = (m: MemberUser) => {
    setProfileModalMember(m);
    setEditFullName(m.fullName);
    setEditDesignation(m.designation || 'Senior Lecturer Grade II');
    setEditInstitution(m.institution || 'Rajarata University of Sri Lanka');
    setEditExaminerType(m.examinerType || 'INTERNAL');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileModalMember) return;
    try {
      setEditProfileLoading(true);
      const res = await api.put(`/roles/users/${profileModalMember.id}/profile`, {
        fullName: editFullName.trim(),
        designation: editDesignation.trim(),
        institution: editInstitution.trim(),
        examinerType: editExaminerType,
      });
      setFeedback({ type: 'success', message: res.data.message || 'Academic profile verified and updated.' });
      setProfileModalMember(null);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to update academic profile' });
    } finally {
      setEditProfileLoading(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.username.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.designation.toLowerCase().includes(q) ||
      m.roles.some((r) => r.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-red-100 text-red-900">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Role Governance & Approvals Console
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            {isHod
              ? 'Head of Department Administrative Authority — Approve, Assign & Manage Academic Roles'
              : 'HOD Clerk Role Management — Propose Role Modifications and Register Members for HOD Sanction'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-xs font-semibold border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveSubTab('approvals')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeSubTab === 'approvals'
              ? 'border-red-800 text-red-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Pending Approvals</span>
          {pendingRequests.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800">
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('members')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeSubTab === 'members'
              ? 'border-red-800 text-red-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Department Members ({members.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('roles')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeSubTab === 'roles'
              ? 'border-red-800 text-red-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>System Roles & Creation</span>
        </button>
      </div>

      {/* TAB 1: PENDING APPROVALS */}
      {activeSubTab === 'approvals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              Role Change & Registration Requests Awaiting HOD Sanction ({pendingRequests.length})
            </h2>
            <span className="text-[11px] text-slate-400">
              {isHod ? 'Click Approve to activate operational access' : 'HOD review required for all requests'}
            </span>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-80" />
              <h3 className="font-bold text-slate-800 text-sm">All Role Requests Handled</h3>
              <p className="text-xs text-slate-400 mt-1">
                There are no pending role change or new member registration authorizations at this time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    {/* Header: Action tag & Date */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          req.action === 'ADD' || req.action === 'ASSIGN'
                            ? 'bg-blue-100 text-blue-900 border border-blue-200'
                            : 'bg-rose-100 text-rose-900 border border-rose-200'
                        }`}
                      >
                        {req.action === 'REMOVE' ? 'Revoke Role' : 'Assign Role'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(req.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Member details */}
                    <div className="flex items-center gap-3">
                      <LecturerAvatar name={req.targetUser.fullName} size="md" />
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{req.targetUser.fullName}</h4>
                        <p className="text-xs text-slate-500">{req.targetUser.email}</p>
                        <p className="text-[11px] text-slate-400 capitalize">{req.targetUser.designation}</p>
                      </div>
                    </div>

                    {/* Requested Role badge */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Requested Operational Role:</span>
                        <span className="font-bold text-red-900 bg-red-100 px-2 py-0.5 rounded text-xs">
                          {req.role.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-700">Requested By: </span>
                        <span>{req.requestedByUser?.fullName || 'Self Registration Form'}</span>
                      </div>
                      {req.reason && (
                        <div className="text-[11px] text-slate-500 italic mt-1 pt-1 border-t border-slate-200">
                          "{req.reason}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {isHod ? (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={actionLoading}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve & Activate</span>
                      </button>
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={actionLoading}
                        className="py-2 px-3 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-800 text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </button>
                    </div>
                  ) : (
                    <div className="py-2 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                      <span>Submitted to Head of Department for Authorization</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DEPARTMENT MEMBERS & DIRECT MODIFICATION */}
      {activeSubTab === 'members' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search staff members by name, email, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-800 focus:outline-none"
              />
            </div>

            <span className="text-xs text-slate-500 font-medium">
              Showing {filteredMembers.length} of {members.length} Members
            </span>
          </div>

          {/* Members Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-3.5">Staff Member</th>
                    <th className="px-4 py-3.5">Designation</th>
                    <th className="px-4 py-3.5">Current Roles</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <LecturerAvatar name={m.fullName} imageUrl={m.profilePictureUrl} size="sm" />
                          <div>
                            <div className="font-bold text-slate-900">{m.fullName}</div>
                            <div className="text-[11px] text-slate-400 font-mono">@{m.username} • {m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800">{m.designation || 'Academic Staff'}</div>
                        <div className="text-[11px] text-slate-400">{m.institution || 'Rajarata University of Sri Lanka'}</div>
                        <div className="mt-1">
                          {m.isVerified ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Verified Profile</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Pending HOD Review</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {m.roles.map((r) => (
                            <span
                              key={r}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200"
                            >
                              {r}
                            </span>
                          ))}
                          {m.pendingRequests.length > 0 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              <span>Pending {m.pendingRequests[0].roleName}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Active
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isHod && (
                            <button
                              onClick={() => handleOpenProfileModal(m)}
                              className="px-2.5 py-1.5 rounded-lg border border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                              title="Review, verify and edit academic designation before allocation"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Verify &amp; Edit</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenRoleModal(m)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 hover:border-red-700 bg-white hover:bg-red-50 text-slate-700 hover:text-red-900 text-xs font-semibold transition"
                          >
                            {isHod ? 'Modify Roles' : 'Propose Role'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM ROLES & CREATION */}
      {activeSubTab === 'roles' && (
        <div className="space-y-6">
          {/* Create Custom Role Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 max-w-xl">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-red-800" />
              <h3 className="font-bold text-sm text-slate-900">Define & Create New Operational Role</h3>
            </div>
            <p className="text-xs text-slate-500">
              Create departmental or external examination roles (e.g. <code>QUALITY_ASSURANCE</code>, <code>MODERATOR</code>).
            </p>

            <form onSubmit={handleCreateRole} className="flex gap-2">
              <input
                type="text"
                required
                placeholder="e.g. QUALITY_ASSURANCE, MODERATOR"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-800 outline-none uppercase font-mono"
              />
              <button
                type="submit"
                disabled={actionLoading || !newRoleName.trim()}
                className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <span>Create Role</span>
              </button>
            </form>
          </div>

          {/* Grid of System Roles */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800">Standard & Registered Roles in System ({availableRoles.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableRoles.map((r) => (
                <div key={r.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-slate-900 font-mono">{r.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                      ID #{r.id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {r.name === 'HOD' && 'Head of Department: Overall governance, role approvals, and permanent workflow locking.'}
                    {r.name === 'LECTURER' && 'Course First Examiner: Paper collection, OTP verification, 2nd marker nomination & marksheets.'}
                    {r.name === 'SECOND_EXAMINER' && 'Independent Examiner: Couriered scripts evaluation, moderation, and 2nd marking reports.'}
                    {r.name === 'AR_OFFICE' && 'Assistant Registrar Office: Physical script packets custody and OTP verification.'}
                    {r.name === 'HOD_CLERK' && 'Departmental Clerk: Timetable coordination, draft schedules, and role proposals.'}
                    {r.name === 'DEAN' && 'Faculty Dean: Cross-departmental examination milestone velocity and analytics.'}
                    {!['HOD', 'LECTURER', 'SECOND_EXAMINER', 'AR_OFFICE', 'HOD_CLERK', 'DEAN'].includes(r.name) &&
                      'Custom departmental academic role.'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Role Modification Modal (Clerk or HOD) */}
      {isRoleModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-fade-in">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  {isHod ? 'Modify Staff Role Assignment' : 'Propose Staff Role Assignment'}
                </h3>
                <p className="text-xs text-slate-300">Target Member: {selectedMember.fullName}</p>
              </div>
              <button onClick={() => setIsRoleModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRoleChange} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Role</label>
                <select
                  value={targetRoleId}
                  onChange={(e) => setTargetRoleId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-800"
                >
                  {availableRoles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetAction('ADD')}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      targetAction === 'ADD'
                        ? 'bg-blue-50 border-blue-600 text-blue-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Assign / Add Role
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetAction('REMOVE')}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      targetAction === 'REMOVE'
                        ? 'bg-rose-50 border-rose-600 text-rose-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Revoke Role
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason / Administrative Justification
                </label>
                <textarea
                  rows={2}
                  value={targetReason}
                  onChange={(e) => setTargetReason(e.target.value)}
                  placeholder="e.g. Appointed as 2nd Examiner for semester examinations"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-800"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500">
                {isHod
                  ? '⚡ As Head of Department, your submission will immediately activate and update this member’s privileges.'
                  : '📋 As HOD Clerk, this proposal will be forwarded to the Head of Department for official authorization.'}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2 rounded-xl bg-red-800 hover:bg-red-900 text-white text-xs font-bold shadow-xs transition"
                >
                  {isHod ? 'Confirm & Apply' : 'Submit to HOD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Review, Verify & Edit Academic Profile (HOD Only) */}
      {profileModalMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-gradient-to-r from-red-900 to-red-800 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm">Review &amp; Verify Academic Profile</h3>
                  <p className="text-[11px] text-red-200">Validate staff designation &amp; examiner eligibility</p>
                </div>
              </div>
              <button onClick={() => setProfileModalMember(null)} className="text-red-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <LecturerAvatar name={profileModalMember.fullName} imageUrl={profileModalMember.profilePictureUrl} size="md" />
                <div>
                  <div className="font-bold text-slate-900 text-sm">{profileModalMember.fullName}</div>
                  <div className="text-xs text-slate-500 font-mono">@{profileModalMember.username} • {profileModalMember.email}</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name &amp; Academic Title</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Academic Designation / Post *
                </label>
                <select
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-800 outline-none font-semibold text-slate-800"
                >
                  {ACADEMIC_DESIGNATIONS.map((title) => (
                    <option key={title} value={title}>
                      {title}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  The system automatically verifies academic seniority and active subject limits for examiner allocation.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Institution</label>
                  <input
                    type="text"
                    required
                    value={editInstitution}
                    onChange={(e) => setEditInstitution(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-800 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Examiner Scope</label>
                  <select
                    value={editExaminerType}
                    onChange={(e) => setEditExaminerType(e.target.value as 'INTERNAL' | 'EXTERNAL')}
                    className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-800 outline-none font-semibold"
                  >
                    <option value="INTERNAL">Internal Examiner (RUSL)</option>
                    <option value="EXTERNAL">External Examiner</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 leading-relaxed">
                <strong>HOD Verification:</strong> Confirming this profile verifies this staff member for course allocations and second examiner moderation appointments.
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProfileModalMember(null)}
                  className="flex-1 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editProfileLoading}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editProfileLoading ? 'Verifying...' : 'Verify & Save Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
