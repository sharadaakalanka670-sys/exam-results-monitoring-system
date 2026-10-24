import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { BarChart3, CheckCircle2, AlertCircle, Clock, ShieldCheck } from 'lucide-react';

export const DeanDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const res = await api.get('/dashboards/dean');
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading Dean Analytics Dashboard...</div>;
  }

  const summary = data?.summary || {};
  const programmeBreakdown = data?.programmeBreakdown || [];
  const stageBreakdown = data?.stageBreakdown || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dean's Institutional Performance Analytics</h2>
          <p className="text-xs text-slate-500">
            High-level oversight of paper marking efficiency, on-time completion rates, and programme trends across the Faculty of Applied Sciences.
          </p>
        </div>

        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Privacy Enforced: Aggregate Metrics Only</span>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 block mb-1">Total Exam Workflows</span>
          <div className="text-3xl font-extrabold text-slate-900">{summary.totalSchedules || 0}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 block mb-1">Approved & Locked</span>
          <div className="text-3xl font-extrabold text-emerald-800">{summary.approvedCount || 0}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-blue-600 block mb-1">In-Progress Workflows</span>
          <div className="text-3xl font-extrabold text-blue-800">{summary.inProgressCount || 0}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-semibold text-purple-600 block mb-1">Overall Completion Rate</span>
          <div className="text-3xl font-extrabold text-purple-800">{summary.completionRate || 0}%</div>
        </div>
      </div>

      {/* Programme Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Performance by Degree Programme</h3>

          <div className="space-y-4">
            {programmeBreakdown.map((p: any, idx: number) => {
              const rate = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
              return (
                <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between font-bold text-xs text-slate-800">
                    <span>{p.programme}</span>
                    <span>{rate}% Completed</span>
                  </div>

                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${rate}%` }} />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Total Courses: {p.total}</span>
                    <span className="text-emerald-700 font-medium">Completed: {p.completed}</span>
                    <span className="text-blue-700 font-medium">In Progress: {p.inProgress}</span>
                    {p.overdue > 0 && <span className="text-rose-600 font-bold">Overdue: {p.overdue}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Workflow Stage Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Active Lifecycle Phase Distribution</h3>

          <div className="space-y-2.5">
            {stageBreakdown.map((s: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <span className="font-medium text-slate-700">{s.stage}</span>
                <span className="font-bold font-mono bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                  {s.count} course(s)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
