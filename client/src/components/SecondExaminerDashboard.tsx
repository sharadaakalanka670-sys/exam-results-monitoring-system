import React, { useState, useEffect } from 'react';
import { User, ExamSchedule } from '../types';
import { api } from '../api/client';
import { StatusBadge } from './StatusBadge';
import { Truck, CheckCircle2, Clock, Upload, ArrowRight, Check, X } from 'lucide-react';

interface Props {
  user: User;
  onSelectSchedule: (schedule: ExamSchedule) => void;
}

export const SecondExaminerDashboard: React.FC<Props> = ({ user, onSelectSchedule }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/dashboards/second-examiner');
      setData(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load second examiner workspace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.id]);

  const handleRespondInvitation = async (invitationId: number, accept: boolean) => {
    try {
      await api.post(`/invitations/${invitationId}/respond`, { accept });
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to respond to invitation');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading Second Examiner Workspace...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 p-6 rounded-2xl border border-red-200 text-center text-red-700 space-y-3">
        <p className="font-semibold text-sm">{error}</p>
        <button
          onClick={loadData}
          className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const invitations = data?.invitations || [];
  const assignedSchedules = data?.assignedSchedules || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Second Examiner & Evaluator Workspace</h2>
        <p className="text-xs text-slate-500">
          Academic qualifications and workload limits enforced. Manage invitations, couriered script acknowledgments, and second marking reports.
        </p>
      </div>

      {/* Invitations Section */}
      {invitations.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-amber-900 text-sm">Examiner Invitations Pending Your Response</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {invitations.map((inv: any) => (
              <div key={inv.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-xs">
                    {inv.examSchedule?.courseOffering?.course?.courseCode} - {inv.examSchedule?.courseOffering?.course?.courseTitle}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    1st Examiner: {inv.examSchedule?.firstExaminer?.fullName}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {inv.status === 'ACCEPTED_PENDING_HOD' ? (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>Accepted — Awaiting HOD Confirmation</span>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleRespondInvitation(inv.id, false)}
                        className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50 border border-rose-200 text-xs"
                        title="Decline"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRespondInvitation(inv.id, true)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept Nomination</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assigned Subjects */}
      <div>
        <h3 className="font-bold text-slate-900 text-sm mb-3">Assigned Examination Subjects</h3>

        {assignedSchedules.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
            No subjects currently assigned to you for second marking.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignedSchedules.map((s: any) => {
              const dispatched = Boolean(s.secondMarking?.courierDispatchedAt);
              const acknowledged = Boolean(s.secondMarking?.acknowledgedAt);
              const reportUploaded = Boolean(s.secondMarking?.reportDocumentId);

              return (
                <div
                  key={s.id}
                  onClick={() => onSelectSchedule(s)}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-slate-300 cursor-pointer transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-sm bg-purple-900 text-white px-2 py-0.5 rounded">
                        {s.courseOffering?.course?.courseCode}
                      </span>
                      <StatusBadge status={s.workflowStatus} isOverdue={s.isOverdue} size="sm" />
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm mb-1 leading-snug">
                      {s.courseOffering?.course?.courseTitle}
                    </h4>
                    <div className="text-xs text-slate-500 mb-4">
                      1st Examiner: {s.firstExaminer?.fullName}
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-slate-600">Courier Tracking:</span>
                        <span className={`font-semibold ${dispatched ? 'text-purple-700' : 'text-slate-400'}`}>
                          {dispatched ? s.secondMarking?.courierReference || 'Dispatched' : 'Awaiting Dispatch'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-slate-600">Scripts Receipt:</span>
                        <span className={`font-semibold ${acknowledged ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {acknowledged ? 'Acknowledged' : 'Pending Acknowledgment'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-slate-600">2nd Marking Report:</span>
                        <span className={`font-semibold ${reportUploaded ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {reportUploaded ? 'Uploaded' : 'Pending Upload'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-purple-800 font-semibold">
                      Due: {s.secondMarking?.originalDueDate ? new Date(s.secondMarking.originalDueDate).toLocaleDateString() : '—'}
                    </span>
                    <span className="text-red-800 font-bold flex items-center gap-1 group">
                      <span>Open Subject</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
