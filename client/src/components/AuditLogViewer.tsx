import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import {
  Activity,
  Search,
  ShieldCheck,
  ArrowUp,
  ArrowDown,
  Sliders,
  PanelRight,
  Maximize2,
  Minimize2,
  RefreshCw,
  X,
  Filter
} from 'lucide-react';

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(100);
  const [resultFilter, setResultFilter] = useState<'ALL' | 'SUCCESS' | 'FAILURE'>('ALL');

  // Height slider state to control the scrollable container height
  const [sliderHeight, setSliderHeight] = useState<number>(520);
  // Slide-out drawer mode toggle
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const drawerContainerRef = useRef<HTMLDivElement>(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/audit-logs?search=${encodeURIComponent(search)}&limit=${limit}`);
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [search, limit]);

  const scrollToTop = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (drawerContainerRef.current) {
      drawerContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({
        top: tableContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
    if (drawerContainerRef.current) {
      drawerContainerRef.current.scrollTo({
        top: drawerContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (resultFilter === 'ALL') return true;
    return log.result === resultFilter;
  });

  const renderTableContent = () => (
    <table className="w-full text-left text-xs">
      <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold sticky top-0 z-10 shadow-xs backdrop-blur-xs">
        <tr>
          <th className="p-3 whitespace-nowrap bg-slate-100">Timestamp (UTC)</th>
          <th className="p-3 whitespace-nowrap bg-slate-100">Actor / User</th>
          <th className="p-3 whitespace-nowrap bg-slate-100">Course / Schedule</th>
          <th className="p-3 whitespace-nowrap bg-slate-100">Action</th>
          <th className="p-3 whitespace-nowrap bg-slate-100">Result</th>
          <th className="p-3 whitespace-nowrap bg-slate-100">Metadata</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {loading ? (
          <tr>
            <td colSpan={6} className="p-8 text-center text-slate-400">
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-red-800" />
                <span>Loading audit trail records...</span>
              </div>
            </td>
          </tr>
        ) : filteredLogs.length === 0 ? (
          <tr>
            <td colSpan={6} className="p-8 text-center text-slate-400">
              No audit logs found matching your filters.
            </td>
          </tr>
        ) : (
          filteredLogs.map((log) => (
            <tr key={log.id} className="hover:bg-slate-50/80 transition group">
              <td className="p-3 font-mono text-slate-500 whitespace-nowrap">
                {new Date(log.timestamp).toLocaleString()}
              </td>
              <td className="p-3">
                {log.user ? (
                  <div>
                    <span className="font-semibold text-slate-800 group-hover:text-red-900 transition">
                      {log.user.fullName}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{log.user.designation}</span>
                  </div>
                ) : (
                  <span className="text-slate-400 italic">System / Automated</span>
                )}
              </td>
              <td className="p-3 font-mono font-medium text-slate-700 whitespace-nowrap">
                {log.examSchedule?.courseOffering?.course?.courseCode ? (
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {log.examSchedule.courseOffering.course.courseCode}
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className="p-3 font-semibold text-slate-900 whitespace-nowrap">{log.action}</td>
              <td className="p-3 whitespace-nowrap">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                    log.result === 'SUCCESS'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      log.result === 'SUCCESS' ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  />
                  {log.result}
                </span>
              </td>
              <td className="p-3 font-mono text-[11px] text-slate-500 max-w-xs truncate" title={log.safeMetadataJson || ''}>
                {log.safeMetadataJson || '—'}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header & Description */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-900 flex items-center justify-center font-bold">
              <Activity className="w-4 h-4 text-red-800" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">System Audit Trail</h2>
              <p className="text-xs text-slate-500">
                Append-only regulatory log. View constrained in a slider container so site height remains constant.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Slider Drawer Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white rounded-xl shadow-xs flex items-center gap-1.5 transition"
            title="Open in a slide-out right drawer panel"
          >
            <PanelRight className="w-3.5 h-3.5 text-red-300" />
            <span>Slide-out Panel</span>
          </button>

          <button
            onClick={loadLogs}
            disabled={loading}
            className="p-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter & Slider Controls Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
        {/* Search & Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search action, user, course..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl w-56 md:w-64 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-800"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            {(['ALL', 'SUCCESS', 'FAILURE'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setResultFilter(mode)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
                  resultFilter === mode
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {mode === 'ALL' ? 'All' : mode === 'SUCCESS' ? 'Success' : 'Failure'}
              </button>
            ))}
          </div>

          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="py-1.5 px-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white"
            title="Max records fetched"
          >
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
            <option value={200}>200 rows</option>
          </select>
        </div>

        {/* View Height Slider & Jump Buttons */}
        <div className="flex items-center gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          {/* Height Slider */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
              Slider Height: <strong className="text-slate-800">{sliderHeight}px</strong>
            </span>
            <input
              type="range"
              min={340}
              max={760}
              step={20}
              value={sliderHeight}
              onChange={(e) => setSliderHeight(Number(e.target.value))}
              className="w-24 sm:w-32 accent-red-800 cursor-pointer"
              title="Drag slider to adjust audit log viewport height"
            />
          </div>

          {/* Quick Height Preset Buttons */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => setSliderHeight(380)}
              className={`px-2 py-1 text-[10px] rounded-lg border transition ${
                sliderHeight === 380 ? 'bg-red-800 text-white border-red-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Compact
            </button>
            <button
              onClick={() => setSliderHeight(520)}
              className={`px-2 py-1 text-[10px] rounded-lg border transition ${
                sliderHeight === 520 ? 'bg-red-800 text-white border-red-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => setSliderHeight(680)}
              className={`px-2 py-1 text-[10px] rounded-lg border transition ${
                sliderHeight === 680 ? 'bg-red-800 text-white border-red-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Tall
            </button>
          </div>

          {/* Slider Jump Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={scrollToTop}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
              title="Slide to Top"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={scrollToBottom}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
              title="Slide to Bottom"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Slider Container (Fixed / User-controlled height, with custom scroll slider) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Status Bar */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Showing <strong>{filteredLogs.length}</strong> of <strong>{total}</strong> logged events
            </span>
          </div>
          <span className="text-[10px] text-slate-400">
            Use mouse wheel or the side slider track to navigate
          </span>
        </div>

        {/* Scrollable Viewport (Prevents page height expansion) */}
        <div
          ref={tableContainerRef}
          style={{ height: `${sliderHeight}px` }}
          className="slider-scroll overflow-y-auto overflow-x-auto relative transition-[height] duration-200"
        >
          {renderTableContent()}
        </div>
      </div>

      {/* SLIDE-OUT DRAWER PANEL (Alternative slide view that isolates audit trail completely) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in">
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={() => setIsDrawerOpen(false)} />

          {/* Drawer container */}
          <div className="relative z-10 w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-slide-left">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-red-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">System Audit Trail (Side Slider)</h3>
                  <p className="text-[11px] text-slate-400">
                    Independent side slider view — zero impact on underlying page height.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={scrollToTop}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Scroll to Top"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={scrollToBottom}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Scroll to Bottom"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-white transition"
                  title="Close side slider"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawer Search & Stats */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl w-full bg-white"
                />
              </div>

              <span className="text-[11px] text-slate-500">
                {filteredLogs.length} events loaded
              </span>
            </div>

            {/* Drawer Scrollable Content */}
            <div ref={drawerContainerRef} className="slider-scroll flex-1 overflow-y-auto overflow-x-auto p-4">
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                {renderTableContent()}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>Department of Computing, RUSL</span>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-xl text-xs transition"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
