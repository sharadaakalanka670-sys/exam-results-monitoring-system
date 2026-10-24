import React, { useState, useEffect } from 'react';
import { ExamSchedule, User } from '../types';
import { api } from '../api/client';
import { StatusBadge } from './StatusBadge';
import { LecturerAvatar } from './LecturerAvatar';
import { Search, Filter, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';

interface Props {
  user: User;
  onSelectSchedule: (schedule: ExamSchedule) => void;
}

export const SchedulesList: React.FC<Props> = ({ user, onSelectSchedule }) => {
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [programme, setProgramme] = useState('');
  const [batch, setBatch] = useState('');
  const [status, setStatus] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (programme) params.append('programmeGroup', programme);
      if (batch) params.append('batchLabel', batch);
      if (status) params.append('status', status);
      if (overdueOnly) params.append('overdueOnly', 'true');

      const res = await api.get(`/exam-schedules?${params.toString()}`);
      setSchedules(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [search, programme, batch, status, overdueOnly]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Examination Results Monitoring Master Register</h2>
          <p className="text-xs text-slate-500">
            Interactive digital tracking replacing manual spreadsheet monitoring.
          </p>
        </div>

        <button
          onClick={fetchSchedules}
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition flex items-center gap-1.5 text-xs font-semibold self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search course code, title, or examiner..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border rounded-xl"
          />
        </div>

        {/* Programme Filter */}
        <select
          value={programme}
          onChange={(e) => setProgramme(e.target.value)}
          className="px-3 py-1.5 text-xs border rounded-xl bg-white"
        >
          <option value="">All Programmes</option>
          <option value="BSc in IT / BSc (Hons) in IT">BSc in IT</option>
          <option value="BSc in Applied Sciences (Computer Science) / BSc (Hons) in Applied Sciences (Computer Science)">
            BSc in Applied Sciences
          </option>
        </select>

        {/* Batch Filter */}
        <select
          value={batch}
          onChange={(e) => setBatch(e.target.value)}
          className="px-3 py-1.5 text-xs border rounded-xl bg-white"
        >
          <option value="">All Batches</option>
          <option value="2023/2024">2023/2024 (Year 1)</option>
          <option value="2022/2023">2022/2023 (Year 2)</option>
          <option value="2021/2022">2021/2022 (Year 3)</option>
          <option value="2020/2021">2020/2021 (Year 4)</option>
        </select>

        {/* Status Filter */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-1.5 text-xs border rounded-xl bg-white"
        >
          <option value="">All Workflow States</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="FIRST_COLLECTION_REQUESTED">OTP Requested</option>
          <option value="FIRST_MARKING_ACTIVE">1st Marking Active</option>
          <option value="SECOND_MARKING_READY">Ready for Courier</option>
          <option value="SECOND_MARKING_ACTIVE">2nd Marking Active</option>
          <option value="SECOND_MARKING_COMPLETE">2nd Marking Done</option>
          <option value="FINAL_MARKSHEET_SUBMITTED">Pending HOD Approval</option>
          <option value="APPROVED_LOCKED">Approved & Locked</option>
        </select>

        {/* Overdue Checkbox */}
        <label className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
          />
          <span>Overdue Deadlines Only</span>
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
            <tr>
              <th className="p-3.5">Course Code</th>
              <th className="p-3.5">Course Title</th>
              <th className="p-3.5">Batch / Semester</th>
              <th className="p-3.5">1st Examiner</th>
              <th className="p-3.5">2nd Examiner</th>
              <th className="p-3.5">Exam Date</th>
              <th className="p-3.5">Workflow Status</th>
              <th className="p-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {schedules.map((s) => (
              <tr
                key={s.id}
                onClick={() => onSelectSchedule(s)}
                className="hover:bg-slate-50 cursor-pointer transition"
              >
                <td className="p-3.5 font-mono font-bold text-slate-900">{s.courseOffering.course.courseCode}</td>
                <td className="p-3.5 font-medium text-slate-800">{s.courseOffering.course.courseTitle}</td>
                <td className="p-3.5 text-slate-500">
                  {s.courseOffering.batchLabel} • Sem {s.courseOffering.semester}
                </td>
                <td className="p-3.5 text-slate-700">
                  {s.firstExaminer ? (
                    <div className="flex items-center gap-2">
                      <LecturerAvatar
                        name={s.firstExaminer.fullName}
                        imageUrl={s.firstExaminer.profilePictureUrl}
                        size="xs"
                      />
                      <span className="font-medium truncate max-w-[130px]" title={s.firstExaminer.fullName}>
                        {s.firstExaminer.fullName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">Not Assigned</span>
                  )}
                </td>
                <td className="p-3.5 text-slate-700">
                  {s.secondExaminer ? (
                    <div className="flex items-center gap-2">
                      <LecturerAvatar
                        name={s.secondExaminer.user.fullName}
                        imageUrl={s.secondExaminer.user.profilePictureUrl}
                        size="xs"
                      />
                      <span className="font-medium truncate max-w-[130px]" title={s.secondExaminer.user.fullName}>
                        {s.secondExaminer.user.fullName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-amber-700 font-semibold text-[11px] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Pending 2nd Examiner
                    </span>
                  )}
                </td>
                <td className="p-3.5 font-mono text-slate-500">
                  {s.examDate ? s.examDate.split('T')[0] : '—'}
                </td>
                <td className="p-3.5">
                  <StatusBadge status={s.workflowStatus} isOverdue={s.isOverdue} size="sm" />
                </td>
                <td className="p-3.5 text-right">
                  <span className="text-red-800 font-bold hover:underline inline-flex items-center gap-1">
                    <span>Manage</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {schedules.length === 0 && !loading && (
          <div className="p-8 text-center text-slate-400">No schedules matched the filter criteria.</div>
        )}
      </div>
    </div>
  );
};
