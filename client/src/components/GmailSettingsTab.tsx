import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { User } from '../types';
import {
  Mail,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  Save,
  Send,
  RefreshCw,
  Server,
  HelpCircle,
  Sparkles,
  Link2,
  Unlink,
  Clock,
} from 'lucide-react';

interface Props {
  user: User;
  onRefreshEmails?: () => void;
}

export const GmailSettingsTab: React.FC<Props> = ({ user, onRefreshEmails }) => {
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [emailFrom, setEmailFrom] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpPassConfigured, setSmtpPassConfigured] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Linked Details States
  const [isLinked, setIsLinked] = useState(false);
  const [linkedAt, setLinkedAt] = useState<string | null>(null);
  const [unlinkLoading, setUnlinkLoading] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [unlinkFeedback, setUnlinkFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Status & Feedback States
  const [loading, setLoading] = useState(true);
  const [smtpStatus, setSmtpStatus] = useState<{ connected: boolean; message: string } | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testConnLoading, setTestConnLoading] = useState(false);
  const [testConnFeedback, setTestConnFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Test Email States
  const [testRecipient, setTestRecipient] = useState(user.email || '');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettingsAndStatus = async () => {
    try {
      setLoading(true);
      const [settingsRes, statusRes] = await Promise.allSettled([
        api.get('/emails/settings'),
        api.get('/emails/smtp-status'),
      ]);

      if (settingsRes.status === 'fulfilled') {
        const s = settingsRes.value.data;
        setIsLinked(Boolean(s.isLinked || (s.smtpUser && s.smtpPassConfigured)));
        setLinkedAt(s.linkedAt || null);
        setSmtpUser(s.smtpUser || '');
        setSmtpPassConfigured(s.smtpPassConfigured || false);
        setEmailFrom(s.emailFrom || '');
        if (s.smtpHost) setSmtpHost(s.smtpHost);
        if (s.smtpPort) setSmtpPort(s.smtpPort);
        if (s.smtpSecure !== undefined) setSmtpSecure(s.smtpSecure);
      }

      if (statusRes.status === 'fulfilled') {
        setSmtpStatus(statusRes.value.data);
      }
    } catch (err) {
      console.error('Failed to load email settings / status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsAndStatus();
  }, []);

  const handleUnlink = async () => {
    try {
      setUnlinkLoading(true);
      setUnlinkFeedback(null);
      const res = await api.post('/emails/unlink');
      setUnlinkFeedback({ type: 'success', text: res.data.message || 'Gmail account unlinked successfully.' });
      setIsLinked(false);
      setLinkedAt(null);
      setSmtpUser('');
      setSmtpPass('');
      setSmtpPassConfigured(false);
      setEmailFrom('');
      setShowUnlinkConfirm(false);
      await fetchSettingsAndStatus();
      if (onRefreshEmails) onRefreshEmails();
    } catch (err: any) {
      setUnlinkFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to unlink Gmail account.',
      });
    } finally {
      setUnlinkLoading(false);
    }
  };

  const handleTestCredentials = async () => {
    if (!smtpUser.trim()) {
      setTestConnFeedback({ type: 'error', text: 'Please enter a Gmail address.' });
      return;
    }
    if (!smtpPass.trim() && !smtpPassConfigured) {
      setTestConnFeedback({ type: 'error', text: 'Please enter the 16-character App Password.' });
      return;
    }

    try {
      setTestConnLoading(true);
      setTestConnFeedback(null);
      const res = await api.post('/emails/test-connection', {
        smtpUser: smtpUser.trim(),
        smtpPass: smtpPass.trim(),
        smtpHost,
        smtpPort,
        smtpSecure,
      });

      if (res.data.connected) {
        setTestConnFeedback({ type: 'success', text: '✔ ' + res.data.message });
      } else {
        setTestConnFeedback({ type: 'error', text: '❌ ' + res.data.message });
      }
    } catch (err: any) {
      setTestConnFeedback({
        type: 'error',
        text: '❌ ' + (err.response?.data?.message || 'Connection test failed.'),
      });
    } finally {
      setTestConnLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpUser.trim()) {
      setSaveFeedback({ type: 'error', text: 'Please enter a valid Gmail address.' });
      return;
    }

    try {
      setSaveLoading(true);
      setSaveFeedback(null);
      const res = await api.post('/emails/settings', {
        smtpUser: smtpUser.trim(),
        smtpPass: smtpPass.trim() || undefined,
        emailFrom: emailFrom.trim() || undefined,
        smtpHost: smtpHost.trim(),
        smtpPort,
        smtpSecure,
      });

      const isConnected = res.data.verification?.connected;
      setSaveFeedback({
        type: isConnected ? 'success' : 'error',
        text: res.data.message,
      });
      setSmtpStatus(res.data.verification);
      setSmtpPassConfigured(true);
      setSmtpPass('');
      if (onRefreshEmails) onRefreshEmails();
    } catch (err: any) {
      setSaveFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save settings.',
      });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testRecipient.trim()) {
      setTestEmailResult({ type: 'error', text: 'Please enter a recipient email address.' });
      return;
    }

    try {
      setSendingTestEmail(true);
      setTestEmailResult(null);
      const res = await api.post('/emails/send-test', {
        recipientEmail: testRecipient.trim(),
      });

      setTestEmailResult({
        type: 'success',
        text: `✔ Test email sent! Log ID #${res.data.emailLog.id} (Status: ${res.data.emailLog.status})`,
      });
      if (onRefreshEmails) onRefreshEmails();
    } catch (err: any) {
      setTestEmailResult({
        type: 'error',
        text: '❌ ' + (err.response?.data?.message || 'Failed to send test email.'),
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-red-800 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading Gmail configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header & Status Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-700">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Gmail Automated Dispatch Configuration
                </h2>
                <p className="text-xs text-slate-500">
                  Configure real-time automated exam notifications, OTP deliveries, and marksheet alerts via Gmail.
                </p>
              </div>
            </div>

            {/* Live Connection Status Badge */}
            <div className="flex items-center gap-2">
              {smtpStatus?.connected ? (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-800">Connected to Gmail</span>
                </div>
              ) : isLinked ? (
                <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-bold text-amber-800">Reconnection Needed</span>
                </div>
              ) : (
                <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <span className="text-xs font-bold text-slate-600">No Account Linked</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* LINKED GMAIL DETAILS & UNLINK OPTION                     */}
        {/* ======================================================== */}
        {isLinked && (
          <div className="bg-white rounded-2xl border border-emerald-200/90 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Currently Linked Gmail Account</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      Active &amp; Linked
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Live outbound exam notifications, OTPs, and marksheet alerts are linked to this address</p>
                </div>
              </div>

              {/* Unlink Action */}
              {!showUnlinkConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowUnlinkConfirm(true)}
                  className="px-3 py-1.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto shadow-2xs"
                  title="Disconnect and remove this Gmail account from the system"
                >
                  <Unlink className="w-3.5 h-3.5 text-rose-600" />
                  <span>Unlink Gmail</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 self-start sm:self-auto p-1.5 bg-rose-50 border border-rose-200 rounded-xl animate-fade-in">
                  <span className="text-[11px] font-semibold text-rose-900 px-1">Confirm unlink?</span>
                  <button
                    type="button"
                    disabled={unlinkLoading}
                    onClick={handleUnlink}
                    className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition"
                  >
                    {unlinkLoading ? 'Unlinking...' : 'Yes, Unlink'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUnlinkConfirm(false)}
                    className="px-2 py-1 text-slate-600 hover:text-slate-800 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Linked Account Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Linked Gmail Address</span>
                <div className="font-bold text-slate-900 font-mono flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-red-700" />
                  <span>{smtpUser}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Sender "From" Header</span>
                <div className="font-semibold text-slate-800 truncate" title={emailFrom}>
                  {emailFrom || `RUSL Exam Monitoring <${smtpUser}>`}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Connection Security</span>
                <div className="text-slate-700 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>16-digit Google App Password via Port {smtpPort} (SSL/TLS)</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Account Status &amp; Link Date</span>
                <div className="text-slate-700 font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{linkedAt ? `Linked on ${new Date(linkedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Connected & Ready'}</span>
                </div>
              </div>
            </div>

            {unlinkFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  unlinkFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {unlinkFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                )}
                <span className="font-medium">{unlinkFeedback.text}</span>
              </div>
            )}
          </div>
        )}

        {/* 3-Step Interactive Instructions Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-md">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
              Quick 3-Step Gmail Setup
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
              <div className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 font-bold flex items-center justify-center text-[10px] mb-2">
                1
              </div>
              <h4 className="font-bold text-white mb-1">Enable 2-Step Verification</h4>
              <p className="text-[11px] text-slate-300">
                In your Google Account Security settings, verify 2-Step Verification is turned ON.
              </p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
              <div className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 font-bold flex items-center justify-center text-[10px] mb-2">
                2
              </div>
              <h4 className="font-bold text-white mb-1">Generate App Password</h4>
              <p className="text-[11px] text-slate-300 mb-2">
                Create a 16-character password for this app on Google.
              </p>
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-amber-200 underline"
              >
                <span>Open Google App Passwords</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
              <div className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 font-bold flex items-center justify-center text-[10px] mb-2">
                3
              </div>
              <h4 className="font-bold text-white mb-1">Paste Below &amp; Save</h4>
              <p className="text-[11px] text-slate-300">
                Enter your Gmail and the 16-character code below, then click &quot;Save &amp; Activate&quot;.
              </p>
            </div>
          </div>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Key className="w-4 h-4 text-red-800" />
            <span>{isLinked ? 'Update Account Credentials / Reconnect' : 'Connect Sender Account'}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Sender Gmail */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sender Gmail / Google Workspace Address <span className="text-rose-600">*</span>
              </label>
              <input
                type="email"
                required
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="department.exams@gmail.com"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:border-red-800 focus:ring-2 focus:ring-red-800/20 outline-none transition"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                The account used to dispatch official exam emails.
              </p>
            </div>

            {/* 16-character App Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                16-Character Google App Password <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder={smtpPassConfigured ? '•••••••••••••••• (Password configured)' : 'e.g. abcd efgh ijkl mnop'}
                  className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl border border-slate-300 focus:border-red-800 focus:ring-2 focus:ring-red-800/20 outline-none transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {smtpPassConfigured
                  ? 'Password is saved securely in MySQL. Leave blank to keep existing password.'
                  : 'Enter the 16 characters from Google App Passwords (spaces allowed).'}
              </p>
            </div>
          </div>

          {/* Sender Display Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Sender Display Name (&quot;From&quot; Header)
            </label>
            <input
              type="text"
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
              placeholder="RUSL Exam Monitoring <noreply@rusl.ac.lk>"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:border-red-800 focus:ring-2 focus:ring-red-800/20 outline-none transition"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Recipients will see this name in their inbox (e.g. &quot;RUSL Examinations Branch&quot;).
            </p>
          </div>

          {/* Advanced Server Details Accordion */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition"
            >
              <div className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-slate-500" />
                <span>Advanced SMTP Parameters (Pre-configured for Gmail)</span>
              </div>
              <span className="text-[10px] text-slate-400">{showAdvanced ? 'Hide' : 'Show'}</span>
            </button>

            {showAdvanced && (
              <div className="p-4 bg-white grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-200">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">SMTP Host</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">SMTP Port</label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">SSL / TLS Protocol</label>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="smtpSecure"
                      checked={smtpSecure}
                      onChange={(e) => setSmtpSecure(e.target.checked)}
                      className="rounded border-slate-300 text-red-800 focus:ring-red-800"
                    />
                    <label htmlFor="smtpSecure" className="text-xs text-slate-700 font-medium">
                      Port 465 SSL/TLS Secure
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Test & Save Feedback Alerts */}
          {saveFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                saveFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {saveFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <span className="font-medium">{saveFeedback.text}</span>
            </div>
          )}

          {testConnFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                testConnFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {testConnFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <span className="font-medium">{testConnFeedback.text}</span>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              disabled={testConnLoading || !smtpUser}
              onClick={handleTestCredentials}
              className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
            >
              {testConnLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>Test Connection Only</span>
            </button>

            <button
              type="submit"
              disabled={saveLoading || !smtpUser}
              className="px-5 py-2.5 rounded-xl bg-red-800 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-2 transition shadow-md disabled:opacity-50"
            >
              {saveLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save &amp; Activate Gmail</span>
            </button>
          </div>
        </form>

        {/* Live Test Email Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-700" />
            <span>Send a Live Verification Email</span>
          </h3>

          <p className="text-xs text-slate-600">
            Verify real inbox delivery right now. The system will send a test notification letterhead to the specified email address.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="email"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 outline-none transition"
            />
            <button
              type="button"
              disabled={sendingTestEmail || !testRecipient}
              onClick={handleSendTestEmail}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-xs disabled:opacity-50"
            >
              {sendingTestEmail ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>Send Test Email</span>
            </button>
          </div>

          {testEmailResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                testEmailResult.type === 'success'
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {testEmailResult.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <span className="font-medium">{testEmailResult.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
