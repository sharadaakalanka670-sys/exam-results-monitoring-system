import React, { useState, useEffect } from 'react';
import { User, ExamSchedule } from '../types';
import { api } from '../api/client';
import { LecturerAvatar } from './LecturerAvatar';
import { Key, Truck, CheckCircle2, RotateCcw, ShieldAlert, ArrowRight } from 'lucide-react';

interface Props {
  user: User;
  onSelectSchedule: (schedule: ExamSchedule) => void;
}

export const ArDashboard: React.FC<Props> = ({ user, onSelectSchedule }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'collection' | 'return' | 'courier' | 'receipt'>('collection');

  // Input states
  const [otpInput, setOtpInput] = useState<{ [scheduleId: number]: string }>({});
  const [courierInput, setCourierInput] = useState<{ [scheduleId: number]: string }>({});
  const [scriptCountInput, setScriptCountInput] = useState<{ [scheduleId: number]: number }>({});
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboards/ar');
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleArGenerateOtp = async (scheduleId: number) => {
    const count = scriptCountInput[scheduleId] || 50;
    try {
      setSubmitting(true);
      const res = await api.post(`/exam-schedules/${scheduleId}/first-marking/ar-generate-collection-otp`, {
        scriptCount: count,
      });
      alert(`Collection OTP (${res.data.otp}) generated! Auto-alert email dispatched to First Examiner (${res.data.recipientName}).`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to generate OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCollectionOtp = async (scheduleId: number) => {
    const code = otpInput[scheduleId];
    if (!code || code.length < 6) {
      alert('Please enter a valid 6-digit OTP code');
      return;
    }
    try {
      setSubmitting(true);
      await api.post(`/exam-schedules/${scheduleId}/first-marking/verify-collection-otp`, { otp: code });
      alert('Physical collection verified! 3-month deadline has started.');
      setOtpInput(prev => ({ ...prev, [scheduleId]: '' }));
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyReturnOtp = async (scheduleId: number) => {
    const code = otpInput[scheduleId];
    if (!code || code.length < 6) {
      alert('Please enter a valid 6-digit OTP code');
      return;
    }
    try {
      setSubmitting(true);
      await api.post(`/exam-schedules/${scheduleId}/first-marking/verify-return-otp`, { otp: code });
      alert('Physical script return verified successfully!');
      setOtpInput(prev => ({ ...prev, [scheduleId]: '' }));
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispatchCourier = async (scheduleId: number) => {
    const ref = courierInput[scheduleId] || 'SLPOST-COURIER';
    try {
      setSubmitting(true);
      await api.post(`/exam-schedules/${scheduleId}/second-marking/courier-dispatch`, { courierReference: ref });
      alert('Courier dispatch recorded! 1-month second marking deadline started.');
      setCourierInput(prev => ({ ...prev, [scheduleId]: '' }));
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Courier dispatch recording failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmArReceipt = async (scheduleId: number) => {
    try {
      setSubmitting(true);
      await api.post(`/exam-schedules/${scheduleId}/second-marking/confirm-ar-receipt`);
      alert('Confirmed receipt of scripts returned by 2nd Examiner!');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Receipt confirmation failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading AR Office Logistics Console...</div>;
  }

  const collectionQueue = data?.collectionQueue || [];
  const returnQueue = data?.returnQueue || [];
  const courierQueue = data?.courierQueue || [];
  const receiptQueue = data?.receiptQueue || [];

  return (
    <div className="space-y-6 animate-fade-in">
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
              <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                Examinations Branch (AR Office)
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Physical script custody verification, OTP stamp validation, and courier tracking. (Document downloads strictly prohibited).
            </p>
          </div>
        </div>

        <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-1.5 font-medium shrink-0">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>RBAC Protected: PDF viewing disabled</span>
        </div>
      </div>

      {/* Logistics Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('collection')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 ${
            activeTab === 'collection'
              ? 'bg-white border-t-2 border-red-800 text-red-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Collection OTPs ({collectionQueue.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('return')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 ${
            activeTab === 'return'
              ? 'bg-white border-t-2 border-red-800 text-red-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Return OTPs ({returnQueue.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('courier')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 ${
            activeTab === 'courier'
              ? 'bg-white border-t-2 border-red-800 text-red-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Courier Dispatch ({courierQueue.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('receipt')}
          className={`px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 ${
            activeTab === 'receipt'
              ? 'bg-white border-t-2 border-red-800 text-red-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Receipt from 2nd Examiner ({receiptQueue.length})</span>
        </button>
      </div>

      {/* Tab 1: Collection OTP Queue */}
      {activeTab === 'collection' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Scripts Collection & Handover Queue</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Examinations Branch (AR Office) holds concluded paper packets, counts scripts, and generates the handover OTP.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-full text-slate-600">
              {collectionQueue.length} Active Packets
            </span>
          </div>

          {collectionQueue.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No script collections pending AR action.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {collectionQueue.map((s: any) => {
                const isRequested = s.workflowStatus === 'FIRST_COLLECTION_REQUESTED';
                return (
                  <div key={s.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <LecturerAvatar
                        name={s.firstExaminer?.fullName || 'First Examiner'}
                        imageUrl={s.firstExaminer?.profilePictureUrl}
                        size="md"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onSelectSchedule(s)}
                            className="font-bold text-slate-900 text-sm hover:text-blue-600 transition text-left"
                          >
                            {s.courseOffering?.course?.courseCode} - {s.courseOffering?.course?.courseTitle}
                          </button>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isRequested
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {isRequested ? 'OTP Issued — Awaiting Collection' : 'Ready for Packet Counting'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2">
                          <span>1st Examiner: <strong className="text-slate-700">{s.firstExaminer?.fullName}</strong></span>
                          <span>•</span>
                          <span>
                            AR Script Count: <strong className="text-blue-700">{s.firstMarking?.scriptCount ? `${s.firstMarking.scriptCount} scripts` : 'Not counted yet'}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {!isRequested ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <label className="text-[11px] text-slate-500 font-medium">Scripts:</label>
                            <input
                              type="number"
                              min="1"
                              value={scriptCountInput[s.id] ?? (s.firstMarking?.scriptCount || 50)}
                              onChange={(e) => setScriptCountInput({ ...scriptCountInput, [s.id]: parseInt(e.target.value, 10) })}
                              className="w-20 px-2 py-1 text-xs border rounded-lg text-center font-bold"
                            />
                          </div>
                          <button
                            onClick={() => handleArGenerateOtp(s.id)}
                            disabled={submitting}
                            className="px-3 py-1.5 bg-rose-800 hover:bg-rose-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>Issue Collection OTP</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="Counter OTP"
                            value={otpInput[s.id] || ''}
                            onChange={(e) => setOtpInput({ ...otpInput, [s.id]: e.target.value })}
                            className="px-2.5 py-1 text-xs border rounded-lg font-mono text-center tracking-widest w-28"
                          />
                          <button
                            onClick={() => handleVerifyCollectionOtp(s.id)}
                            disabled={submitting || (otpInput[s.id]?.length || 0) < 6}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                          >
                            Verify
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => onSelectSchedule(s)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Return OTP Queue */}
      {activeTab === 'return' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Scripts Return Verification Queue</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                First Examiners generate a single-use Return OTP after uploading the 1st Marking Report. Enter the code to confirm custody return.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-full text-slate-600">
              {returnQueue.length} Active Schedules
            </span>
          </div>

          {returnQueue.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No script returns pending OTP verification.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {returnQueue.map((s: any) => {
                const reportUploaded = !!s.firstMarking?.reportDocumentId;
                return (
                  <div key={s.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <LecturerAvatar
                        name={s.firstExaminer?.fullName || 'First Examiner'}
                        imageUrl={s.firstExaminer?.profilePictureUrl}
                        size="md"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onSelectSchedule(s)}
                            className="font-bold text-slate-900 text-sm hover:text-blue-600 transition text-left"
                          >
                            {s.courseOffering?.course?.courseCode} - {s.courseOffering?.course?.courseTitle}
                          </button>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            reportUploaded
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {reportUploaded ? 'Report Uploaded • Ready for Return' : 'Marking in Progress'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2">
                          <span>1st Examiner: <strong className="text-slate-700">{s.firstExaminer?.fullName}</strong></span>
                          <span>•</span>
                          <span>
                            Packets: <strong className="text-blue-700">{s.firstMarking?.scriptCount || 50} scripts</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Enter Return OTP"
                        value={otpInput[s.id] || ''}
                        onChange={(e) => setOtpInput({ ...otpInput, [s.id]: e.target.value })}
                        className="px-2.5 py-1 text-xs border rounded-lg font-mono text-center tracking-widest w-32"
                      />
                      <button
                        onClick={() => handleVerifyReturnOtp(s.id)}
                        disabled={submitting || (otpInput[s.id]?.length || 0) < 6}
                        className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition"
                      >
                        Confirm Return
                      </button>
                      <button
                        onClick={() => onSelectSchedule(s)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Courier Dispatch */}
      {activeTab === 'courier' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Ready for Courier Dispatch to Second Examiner</h3>
          {courierQueue.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No subjects currently ready for courier dispatch.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {courierQueue.map((s: any) => (
                <div key={s.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <LecturerAvatar
                      name={s.secondExaminer?.user?.fullName || 'Second Examiner'}
                      imageUrl={s.secondExaminer?.user?.profilePictureUrl}
                      size="md"
                    />
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {s.courseOffering?.course?.courseCode} - {s.courseOffering?.course?.courseTitle}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Recipient 2nd Examiner: <span className="font-semibold text-purple-800">{s.secondExaminer?.user?.fullName || 'Not Assigned'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Tracking / Courier Ref"
                      value={courierInput[s.id] || ''}
                      onChange={(e) => setCourierInput({ ...courierInput, [s.id]: e.target.value })}
                      className="px-3 py-1.5 text-xs border rounded-lg w-44"
                    />
                    <button
                      onClick={() => handleDispatchCourier(s.id)}
                      disabled={submitting || !s.secondExaminerProfileId}
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold disabled:opacity-40"
                    >
                      Dispatch
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Receipt from 2nd Examiner */}
      {activeTab === 'receipt' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Scripts Returned by Second Examiner</h3>
          {receiptQueue.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No dispatched courier parcels pending return receipt.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {receiptQueue.map((s: any) => (
                <div key={s.id} className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <LecturerAvatar
                      name={s.secondExaminer?.user?.fullName || 'Second Examiner'}
                      imageUrl={s.secondExaminer?.user?.profilePictureUrl}
                      size="md"
                    />
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {s.courseOffering?.course?.courseCode} - {s.courseOffering?.course?.courseTitle}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        From: <span className="font-semibold">{s.secondExaminer?.user?.fullName}</span> | Ref: {s.secondMarking?.courierReference || 'N/A'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleConfirmArReceipt(s.id)}
                    disabled={submitting}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                  >
                    Confirm AR Receipt
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
