import React, { useState, useEffect } from 'react';
import { User, ExamSchedule } from '../types';
import { api } from '../api/client';
import { Plus, Search, FileSpreadsheet, Clock, ArrowRight, X } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

interface Props {
  user: User;
  onSelectSchedule: (schedule: ExamSchedule) => void;
}

export const ClerkDashboard: React.FC<Props> = ({ user, onSelectSchedule }) => {
  const [drafts, setDrafts] = useState<ExamSchedule[]>([]);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [lecturers, setLecturers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [examDate, setExamDate] = useState('');
  const [firstExaminerId, setFirstExaminerId] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [draftsRes, offRes, candRes] = await Promise.all([
        api.get('/exam-schedules?status=DRAFT'),
        api.get('/course-offerings'),
        api.get('/examiners/candidates')
      ]);
      setDrafts(draftsRes.data);
      setOfferings(offRes.data);
      setLecturers(candRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferingId) return;

    try {
      await api.post('/exam-schedules', {
        courseOfferingId: parseInt(selectedOfferingId, 10),
        examDate: examDate || null,
        firstExaminerUserId: firstExaminerId ? parseInt(firstExaminerId, 10) : null,
      });
      setShowModal(false);
      setSelectedOfferingId('');
      setExamDate('');
      setFirstExaminerId('');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create draft');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading Clerk Data Entry Console...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">HOD Office Clerk Data Entry Workspace</h2>
          <p className="text-xs text-slate-500">
            Prepare draft examination schedules and queue them for HOD review and activation.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Prepare Draft Schedule</span>
        </button>
      </div>

      {/* Draft Schedules Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm">Prepared Draft Schedules Pending HOD Activation</h3>

        {drafts.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No draft schedules currently queued.</p>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="p-3">Course Code</th>
                  <th className="p-3">Course Title</th>
                  <th className="p-3">Batch</th>
                  <th className="p-3">Proposed 1st Examiner</th>
                  <th className="p-3">Proposed Exam Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drafts.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">{d.courseOffering.course.courseCode}</td>
                    <td className="p-3 text-slate-800">{d.courseOffering.course.courseTitle}</td>
                    <td className="p-3 text-slate-500">{d.courseOffering.batchLabel}</td>
                    <td className="p-3 text-slate-700">{d.firstExaminer?.fullName || 'Not assigned'}</td>
                    <td className="p-3 font-mono text-slate-500">{d.examDate ? d.examDate.split('T')[0] : '—'}</td>
                    <td className="p-3">
                      <StatusBadge status={d.workflowStatus} size="sm" />
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onSelectSchedule(d)}
                        className="text-red-800 font-semibold hover:underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Draft */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-slate-900">Prepare Draft Schedule</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDraft} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Select Course Offering:</label>
                <select
                  value={selectedOfferingId}
                  onChange={(e) => setSelectedOfferingId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
                >
                  <option value="">-- Choose Course Offering --</option>
                  {offerings.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.course.courseCode} - {o.course.courseTitle} ({o.batchLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Proposed Exam Date (Optional):</label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Proposed First Examiner (Optional):</label>
                <select
                  value={firstExaminerId}
                  onChange={(e) => setFirstExaminerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
                >
                  <option value="">-- Select Lecturer --</option>
                  {lecturers.map((l) => (
                    <option key={l.userId} value={l.userId}>
                      {l.fullName} ({l.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
                >
                  Save Draft for HOD Activation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
