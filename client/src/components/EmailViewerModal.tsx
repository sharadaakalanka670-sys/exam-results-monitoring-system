import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { EmailLog, User } from '../types';
import {
  Mail,
  X,
  RefreshCw,
  Star,
  Archive,
  Trash2,
  AlertOctagon,
  Clock,
  Printer,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Reply,
  Forward,
  MoreVertical,
  Search,
  Inbox,
  Tag,
  Lock,
  ExternalLink,
  Code,
  FileText,
  Settings,
} from 'lucide-react';
import { GmailSettingsTab } from './GmailSettingsTab';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  initialTab?: 'inbox' | 'settings';
}

export const EmailViewerModal: React.FC<Props> = ({ isOpen, onClose, user, initialTab = 'inbox' }) => {
  const [activeSection, setActiveSection] = useState<'inbox' | 'settings'>(initialTab);
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'html' | 'text'>('html');
  const [showDetails, setShowDetails] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFolder, setFilterFolder] = useState<'inbox' | 'starred'>('inbox');

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const res = await api.get('/emails/my-emails');
      setEmails(res.data);
      if (res.data.length > 0 && !selectedEmail) {
        setSelectedEmail(res.data[0]);
      } else if (res.data.length > 0 && selectedEmail) {
        const found = res.data.find((e: EmailLog) => e.id === selectedEmail.id);
        setSelectedEmail(found || res.data[0]);
      }
    } catch (err) {
      console.error('Failed to load emails', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEmails();
      if (initialTab) {
        setActiveSection(initialTab);
      }
    }
  }, [isOpen, user.id, initialTab]);

  if (!isOpen) return null;

  const toggleStar = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredEmails = emails.filter((email) => {
    if (filterFolder === 'starred' && !starredIds.has(email.id)) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      email.subject.toLowerCase().includes(q) ||
      email.recipientName.toLowerCase().includes(q) ||
      email.recipientEmail.toLowerCase().includes(q) ||
      (email.senderName && email.senderName.toLowerCase().includes(q)) ||
      (email.senderEmail && email.senderEmail.toLowerCase().includes(q)) ||
      email.contentText.toLowerCase().includes(q)
    );
  });

  const currentIndex = selectedEmail
    ? filteredEmails.findIndex((e) => e.id === selectedEmail.id)
    : -1;

  const handlePrevEmail = () => {
    if (currentIndex > 0) {
      setSelectedEmail(filteredEmails[currentIndex - 1]);
    }
  };

  const handleNextEmail = () => {
    if (currentIndex < filteredEmails.length - 1 && currentIndex >= 0) {
      setSelectedEmail(filteredEmails[currentIndex + 1]);
    }
  };

  const formatGmailDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 lg:p-6 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* ========================================================= */}
        {/* Gmail-Style Top Header                                    */}
        {/* ========================================================= */}
        <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
          {/* Left: Gmail branding & University Workspace */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img
                src="/rusl-logo.png"
                alt="RUSL Logo"
                className="w-8 h-8 object-contain drop-shadow-xs"
              />
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-bold text-slate-800 text-sm tracking-tight">Gmail</span>
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-900">
                    RUSL Workspace
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">Department of Computing</span>
              </div>
            </div>
          </div>

          {/* Center: Gmail Search Bar */}
          <div className="flex-1 max-w-xl mx-2">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search in mail (subject, course code, sender)..."
                className="w-full pl-9 pr-8 py-2 bg-slate-100 hover:bg-slate-200/80 focus:bg-white text-xs rounded-full border border-transparent focus:border-slate-300 focus:ring-2 focus:ring-red-800/20 transition outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right: Toggle Setup / Inbox & Close controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setActiveSection(activeSection === 'settings' ? 'inbox' : 'settings')}
              className={`py-1.5 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition ${
                activeSection === 'settings'
                  ? 'bg-red-800 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
              title="Configure automated Gmail dispatch"
            >
              {activeSection === 'settings' ? (
                <>
                  <Inbox className="w-3.5 h-3.5" />
                  <span>View Dispatches</span>
                </>
              ) : (
                <>
                  <Settings className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden sm:inline">Gmail Setup</span>
                </>
              )}
            </button>
            <button
              onClick={fetchEmails}
              disabled={loading}
              className="p-2 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 transition"
              title="Refresh inbox"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition"
              title="Close window"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* Main Body: Gmail Split Pane View OR Settings Tab          */}
        {/* ========================================================= */}
        {activeSection === 'settings' ? (
          <GmailSettingsTab user={user} onRefreshEmails={fetchEmails} />
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Gmail Inbox Sidebar & List */}
            <div className="w-full sm:w-80 md:w-96 border-r border-slate-200 flex flex-col bg-slate-50/70">
              {/* Quick Folder Tabs */}
              <div className="p-2 border-b border-slate-200 bg-white flex items-center gap-1 text-xs">
                <button
                  onClick={() => {
                    setActiveSection('inbox');
                    setFilterFolder('inbox');
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1 transition ${
                    filterFolder === 'inbox'
                      ? 'bg-red-50 text-red-900 font-bold border border-red-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Inbox className="w-3.5 h-3.5" />
                  <span className="truncate">Inbox ({emails.length})</span>
                </button>
                <button
                  onClick={() => {
                    setActiveSection('inbox');
                    setFilterFolder('starred');
                  }}
                  className={`py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1 transition ${
                    filterFolder === 'starred'
                      ? 'bg-amber-50 text-amber-900 font-bold border border-amber-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="truncate">Starred</span>
                </button>
                <button
                  onClick={() => setActiveSection('settings')}
                  className="py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1 text-slate-600 hover:bg-slate-100 transition"
                  title="Configure Gmail on this site"
                >
                  <Settings className="w-3.5 h-3.5 text-amber-600" />
                  <span className="truncate">Setup</span>
                </button>
              </div>

            {/* Email List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loading && emails.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-slate-300" />
                  <span>Loading university dispatches...</span>
                </div>
              ) : filteredEmails.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                  <Mail className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-600">No emails match your filter</p>
                  <p className="text-[11px] text-slate-400">
                    System emails are generated during Handover OTP generation, examiner nominations, and HOD approvals.
                  </p>
                </div>
              ) : (
                filteredEmails.map((e) => {
                  const isSelected = selectedEmail?.id === e.id;
                  const isStarred = starredIds.has(e.id);
                  const sender = e.senderName || 'RUSL Examinations System';

                  return (
                    <div
                      key={e.id}
                      onClick={() => setSelectedEmail(e)}
                      className={`w-full text-left p-3 transition cursor-pointer flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-white border-l-4 border-red-800 shadow-xs'
                          : 'hover:bg-slate-100/80 bg-white/60'
                      }`}
                    >
                      {/* Star Button */}
                      <button
                        onClick={(evt) => toggleStar(e.id, evt)}
                        className="mt-0.5 text-slate-300 hover:text-amber-400 transition"
                        title={isStarred ? 'Starred' : 'Not starred'}
                      >
                        <Star
                          className={`w-4 h-4 ${
                            isStarred ? 'fill-amber-400 text-amber-400' : 'hover:stroke-amber-400'
                          }`}
                        />
                      </button>

                      {/* Content Snippet */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span
                            className={`text-xs truncate ${
                              isSelected ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
                            }`}
                          >
                            {sender}
                          </span>
                          <span className="text-[10px] text-slate-400 flex-shrink-0">
                            {new Date(e.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="text-xs text-slate-900 font-medium truncate mb-0.5">
                          {e.subject}
                        </div>

                        <div className="text-[11px] text-slate-500 line-clamp-1">
                          {e.contentText}
                        </div>

                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Verified
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(e.sentAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* Right: Gmail Message View (High Trust & Authentic Preview)*/}
          {/* ========================================================= */}
          <div className="hidden sm:flex flex-1 flex-col bg-white overflow-hidden">
            {selectedEmail ? (
              <>
                {/* 1. Gmail Top Action Toolbar */}
                <div className="px-6 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between text-slate-600">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <button
                      className="p-1.5 rounded-full hover:bg-slate-100 hover:text-slate-900 transition"
                      title="Archive"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1.5 rounded-full hover:bg-slate-100 hover:text-slate-900 transition"
                      title="Report spam"
                    >
                      <AlertOctagon className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1.5 rounded-full hover:bg-slate-100 hover:text-slate-900 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="h-4 w-px bg-slate-200 mx-1" />
                    <button
                      className="p-1.5 rounded-full hover:bg-slate-100 hover:text-slate-900 transition"
                      title="Mark as unread"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                    <button
                      className="p-1.5 rounded-full hover:bg-slate-100 hover:text-slate-900 transition"
                      title="Snooze"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                    <div className="h-4 w-px bg-slate-200 mx-1" />
                    <button
                      onClick={() => window.print()}
                      className="p-1.5 rounded-full hover:bg-slate-100 hover:text-slate-900 transition"
                      title="Print all"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Right: View Mode Toggle & Pagination */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                      <button
                        onClick={() => setViewMode('html')}
                        className={`px-2 py-1 rounded-md font-semibold flex items-center gap-1 transition ${
                          viewMode === 'html'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5 text-red-800" />
                        <span>Gmail HTML</span>
                      </button>
                      <button
                        onClick={() => setViewMode('text')}
                        className={`px-2 py-1 rounded-md font-semibold flex items-center gap-1 transition ${
                          viewMode === 'text'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Code className="w-3.5 h-3.5 text-slate-600" />
                        <span>Plain Text</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
                      <span>
                        {currentIndex + 1} of {filteredEmails.length}
                      </span>
                      <button
                        onClick={handlePrevEmail}
                        disabled={currentIndex <= 0}
                        className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleNextEmail}
                        disabled={currentIndex >= filteredEmails.length - 1}
                        className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Gmail Subject Header */}
                <div className="px-6 pt-5 pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-800">
                          Inbox
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          Important
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-900 border border-red-300">
                          RUSL Official Notice
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-snug">
                        {selectedEmail.subject}
                      </h2>
                    </div>

                    <button
                      onClick={() => toggleStar(selectedEmail.id)}
                      className="p-1.5 rounded-full hover:bg-slate-100 transition text-slate-400 hover:text-amber-400"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          starredIds.has(selectedEmail.id)
                            ? 'fill-amber-400 text-amber-400'
                            : 'stroke-slate-400'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 3. Gmail Authentic Sender & Recipient Card */}
                <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/50">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Sender Icon + From/To Info */}
                    <div className="flex items-start gap-3">
                      {/* Sender Avatar: Official Crest */}
                      <div className="relative w-10 h-10 rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center overflow-hidden flex-shrink-0 mt-0.5">
                        <img
                          src="/rusl-logo.png"
                          alt="RUSL Crest"
                          className="w-8 h-8 object-contain"
                        />
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                      </div>

                      {/* From & To Details */}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">
                            {selectedEmail.senderName || 'RUSL Examinations Branch'}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            &lt;{selectedEmail.senderEmail || 'noreply@rusl.ac.lk'}&gt;
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full font-semibold">
                            <Lock className="w-3 h-3" />
                            Verified Sender
                          </span>
                        </div>

                        {/* Dropdown "to me" button like Gmail */}
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                          <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 px-1.5 py-0.5 rounded transition font-medium"
                          >
                            <span>
                              to {selectedEmail.recipientEmail === user.email ? 'me' : selectedEmail.recipientName}
                            </span>
                            {showDetails ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right: Date, Reply & Action Icons */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-shrink-0">
                      <span>{formatGmailDate(selectedEmail.sentAt)}</span>
                      <span className="text-[11px] text-slate-400">
                        ({formatRelativeTime(selectedEmail.sentAt)})
                      </span>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          className="p-1.5 rounded-full hover:bg-slate-200/70 hover:text-slate-800 transition"
                          title="Reply"
                        >
                          <Reply className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 rounded-full hover:bg-slate-200/70 hover:text-slate-800 transition"
                          title="More options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Gmail Detailed Headers Dropdown */}
                  {showDetails && (
                    <div className="mt-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm text-xs font-mono space-y-1.5 animate-fade-in max-w-xl">
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-slate-400 text-right">from:</span>
                        <span className="text-slate-800 font-semibold">
                          {selectedEmail.senderName || 'RUSL Examinations System'} &lt;
                          {selectedEmail.senderEmail || 'noreply@rusl.ac.lk'}&gt;
                        </span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-slate-400 text-right">reply-to:</span>
                        <span className="text-slate-800">
                          {selectedEmail.replyTo || 'examinations.computing@rusl.ac.lk'}
                        </span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-slate-400 text-right">to:</span>
                        <span className="text-slate-800 font-semibold">
                          {selectedEmail.recipientName} &lt;{selectedEmail.recipientEmail}&gt;
                        </span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-slate-400 text-right">date:</span>
                        <span className="text-slate-800">
                          {new Date(selectedEmail.sentAt).toUTCString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-slate-400 text-right">subject:</span>
                        <span className="text-slate-800">{selectedEmail.subject}</span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-slate-400 text-right">mailed-by:</span>
                        <span className="text-slate-800">fas.rusl.ac.lk</span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-slate-400 text-right">signed-by:</span>
                        <span className="text-slate-800">rusl.ac.lk</span>
                      </div>
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-slate-400 text-right">security:</span>
                        <span className="text-emerald-700 flex items-center gap-1 font-sans">
                          <Lock className="w-3 h-3 text-emerald-600" />
                          Standard encryption (TLS)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Trust & Security Institutional Notice */}
                <div className="px-6 py-2 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between text-[11px] text-amber-900">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-700 flex-shrink-0" />
                    <span>
                      <strong>Official Examination Notification:</strong> Authenticated digital communication from the Department of Computing, Rajarata University of Sri Lanka.
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded">
                    TEMPLATE: {selectedEmail.templateKey}
                  </span>
                </div>

                {/* 5. Email Body: Authentic Gmail HTML or Plain Text View */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50">
                  {viewMode === 'html' ? (
                    <div className="max-w-2xl mx-auto">
                      <div
                        className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
                        dangerouslySetInnerHTML={{ __html: selectedEmail.contentHtml }}
                      />
                    </div>
                  ) : (
                    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {selectedEmail.contentText}
                    </div>
                  )}

                  {/* 6. Gmail Authentic Bottom Reply / Forward Card */}
                  <div className="max-w-2xl mx-auto mt-6 flex items-center gap-3">
                    <button
                      className="px-4 py-2 rounded-full border border-slate-300 hover:bg-white bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 shadow-xs transition"
                      onClick={() => alert(`Reply composer opens to ${selectedEmail.senderEmail || 'examinations.computing@rusl.ac.lk'}`)}
                    >
                      <Reply className="w-3.5 h-3.5 text-slate-600" />
                      <span>Reply</span>
                    </button>
                    <button
                      className="px-4 py-2 rounded-full border border-slate-300 hover:bg-white bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 shadow-xs transition"
                      onClick={() => alert(`Forwarding dispatch: ${selectedEmail.subject}`)}
                    >
                      <Forward className="w-3.5 h-3.5 text-slate-600" />
                      <span>Forward</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Mail className="w-14 h-14 text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-700">No message selected</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Select an email from the left sidebar to read official notification letterheads, single-use OTP codes, and academic requests.
                </p>
              </div>
            )}
          </div>
        </div>
        )}

        {/* ========================================================= */}
        {/* Modal Bottom Status Bar                                   */}
        {/* ========================================================= */}
        <div className="px-6 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-medium text-slate-600">
              Institutional Dispatch Engine Online — 100% In-App Delivery & Auditing
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Recipient: <strong className="text-slate-700">{user.fullName}</strong> ({user.email})
            </span>
            <button
              onClick={onClose}
              className="px-3.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg transition text-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
