import React, { useState, useEffect } from 'react';
import { User, ExamSchedule } from '../types';
import { api } from '../api/client';
import { StatusBadge } from './StatusBadge';
import { LecturerAvatar } from './LecturerAvatar';
import { FileText, Key, Upload, Clock, AlertTriangle, ArrowRight } from 'lucide-react';

interface Props {
  user: User;
  onSelectSchedule: (schedule: ExamSchedule) => void;
}

export const LecturerDashboard: React.FC<Props> = ({ user, onSelectSchedule }) => {
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/dashboards/lecturer');
      setSchedules(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load assigned subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, [user.id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading Assigned Subjects...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 p-6 rounded-2xl border border-red-200 text-center text-red-700 space-y-3">
        <p className="font-semibold text-sm">{error}</p>
        <button
          onClick={loadSchedules}
          className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3.5">
        <LecturerAvatar
          name={user.fullName}
          imageUrl={user.profilePictureUrl}
          size="lg"
        />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">{user.fullName}</h2>
            <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200">
              {user.designation}
            </span>
            {user.phoneNumber && (
              <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono">
                📞 {user.phoneNumber}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Showing subjects where you are assigned as First Examiner. Manage physical script OTP handovers, marking reports, CA compilation, and final marksheets.
          </p>
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
          No examination schedules currently assigned to you as First Examiner.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedules.map((s) => {
            const firstCollected = Boolean(s.firstMarking?.collectedAt);
            const firstReturned = Boolean(s.firstMarking?.returnedAt);
            const firstReport = Boolean(s.firstMarking?.reportDocumentId);

            return (
              <div
                key={s.id}
                onClick={() => onSelectSchedule(s)}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-slate-300 cursor-pointer transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-sm bg-slate-900 text-white px-2 py-0.5 rounded">
                      {s.courseOffering.course.courseCode}
                    </span>
                    <StatusBadge status={s.workflowStatus} isOverdue={s.isOverdue} size="sm" />
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm mb-1 leading-snug">
                    {s.courseOffering.course.courseTitle}
                  </h3>
                  <div className="text-xs text-slate-500 mb-4">
                    {s.courseOffering.programmeGroup} • Sem {s.courseOffering.semester}
                  </div>

                  {/* Checkpoint Status Pills */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">Physical Scripts:</span>
                      <span className={`font-semibold ${firstCollected ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {firstReturned ? 'Returned to AR' : firstCollected ? 'Collected' : 'Pending OTP Collection'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">1st Marking Report:</span>
                      <span className={`font-semibold ${firstReport ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {firstReport ? 'Uploaded' : 'Not Uploaded'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600">2nd Examiner:</span>
                      {s.secondExaminer ? (
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <LecturerAvatar
                            name={s.secondExaminer.user.fullName}
                            imageUrl={s.secondExaminer.user.profilePictureUrl}
                            size="xs"
                          />
                          <span className="truncate max-w-[120px]">{s.secondExaminer.user.fullName}</span>
                        </div>
                      ) : (
                        <span className="text-amber-700 font-semibold text-[11px] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Pending Assignment
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Exam: {s.examDate ? s.examDate.split('T')[0] : 'N/A'}
                  </span>
                  <span className="text-red-800 font-bold flex items-center gap-1 group">
                    <span>Manage Workflow</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
