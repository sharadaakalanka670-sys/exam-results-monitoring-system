import React, { useState, useEffect } from 'react';
import { User, ExamSchedule } from './types';
import { api } from './api/client';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { EditProfileModal } from './components/EditProfileModal';
import { RoleManagementView } from './components/RoleManagementView';
import { SchedulesList } from './components/SchedulesList';
import { ScheduleDetailModal } from './components/ScheduleDetailModal';
import { HodDashboard } from './components/HodDashboard';
import { LecturerDashboard } from './components/LecturerDashboard';
import { SecondExaminerDashboard } from './components/SecondExaminerDashboard';
import { ArDashboard } from './components/ArDashboard';
import { ClerkDashboard } from './components/ClerkDashboard';
import { DeanDashboard } from './components/DeanDashboard';
import { AuditLogViewer } from './components/AuditLogViewer';
import { EmailViewerModal } from './components/EmailViewerModal';
import {
  GraduationCap,
  ArrowRight,
  UserPlus,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedSchedule, setSelectedSchedule] = useState<ExamSchedule | null>(null);
  const [showEmailViewer, setShowEmailViewer] = useState(false);
  const [emailViewerInitialTab, setEmailViewerInitialTab] = useState<'inbox' | 'settings'>('inbox');
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Authentication & Auth Modes
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

  // Manual login form state
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('Password@123');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Sign up state
  const [signupFullName, setSignupFullName] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupDesignation, setSignupDesignation] = useState('Senior Lecturer Grade II');
  const [signupRole, setSignupRole] = useState('LECTURER');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  // Forgot password state
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetMaskedEmail, setResetMaskedEmail] = useState<string | null>(null);
  const [resetDebugOtp, setResetDebugOtp] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Check existing session
  const checkSession = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleLogin = async (username: string, pass: string) => {
    try {
      setLoginLoading(true);
      setLoginError(null);
      const res = await api.post('/auth/login', { username, password: pass });
      setUser(res.data.user);
      setActiveTab('dashboard');
      setSelectedSchedule(null);
    } catch (err: any) {
      setLoginError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSignupLoading(true);
      setLoginError(null);
      const res = await api.post('/auth/register', {
        fullName: signupFullName,
        username: signupUsername,
        email: signupEmail,
        password: signupPassword,
        designation: signupDesignation,
        requestedRole: signupRole,
        phoneNumber: signupPhone,
      });

      setAuthSuccessMsg(res.data.message);
      setAuthMode('login');
      setUsernameInput(signupUsername);
      setPasswordInput(signupPassword);
      // Reset form
      setSignupFullName('');
      setSignupUsername('');
      setSignupEmail('');
      setSignupPassword('');
    } catch (err: any) {
      setLoginError(err.response?.data?.message || 'Registration failed');
    } finally {
      setSignupLoading(false);
    }
  };

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setResetLoading(true);
      setLoginError(null);
      const res = await api.post('/auth/forgot-password', { identifier: resetIdentifier });
      setResetMaskedEmail(res.data.email);
      setResetDebugOtp(res.data.debugOtp || null);
      setResetStep(2);
    } catch (err: any) {
      setLoginError(err.response?.data?.message || 'Failed to request reset OTP');
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetNewPassword !== resetConfirmPassword) {
      setLoginError('Passwords do not match');
      return;
    }
    try {
      setResetLoading(true);
      setLoginError(null);
      const res = await api.post('/auth/reset-password', {
        identifier: resetIdentifier,
        otp: resetOtp,
        newPassword: resetNewPassword,
      });

      setAuthSuccessMsg(res.data.message);
      setAuthMode('login');
      setUsernameInput(resetIdentifier);
      setPasswordInput(resetNewPassword);
      setResetStep(1);
      setResetOtp('');
      setResetNewPassword('');
      setResetConfirmPassword('');
    } catch (err: any) {
      setLoginError(err.response?.data?.message || 'Password reset failed');
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error(err);
    }
    setUser(null);
    setSelectedSchedule(null);
  };

  const handleRefreshSchedule = async () => {
    if (!selectedSchedule) return;
    try {
      const res = await api.get(`/exam-schedules/${selectedSchedule.id}`);
      setSelectedSchedule(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto animate-pulse">
            <img src="/rusl-logo.png" alt="RUSL Logo" className="w-full h-full object-contain drop-shadow-lg" />
          </div>
          <p className="text-sm font-semibold tracking-wide">Connecting to RUSL Exam Results Monitoring System...</p>
        </div>
      </div>
    );
  }

  // Not authenticated: Render Login, Sign Up, or Password Reset Portal
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 flex flex-col justify-center py-10 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="w-24 h-24 mx-auto mb-3 flex items-center justify-center">
            <img
              src="/rusl-logo.png"
              alt="Rajarata University of Sri Lanka Official Crest"
              className="w-full h-full object-contain drop-shadow-2xl"
            />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Examination Results Monitoring System
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            Department of Computing • Faculty of Applied Sciences<br />
            Rajarata University of Sri Lanka (RUSL)
          </p>
        </div>

        <div className={`mt-6 sm:mx-auto sm:w-full ${authMode === 'signup' ? 'sm:max-w-xl' : 'sm:max-w-md'} px-4`}>
          <div className="bg-white py-8 px-6 shadow-2xl rounded-3xl border border-slate-100 sm:px-10 space-y-5">
            {/* Success Message Banner */}
            {authSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">{authSuccessMsg}</div>
                <button onClick={() => setAuthSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Error Message Banner */}
            {loginError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {/* ======================================================== */}
            {/* MODE 1: SIGN IN (DEFAULT)                                */}
            {/* ======================================================== */}
            {authMode === 'login' && (
              <>
                {/* Manual Login Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleLogin(usernameInput, passwordInput);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Username / Email</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter username or official email"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-red-800 outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">Password</label>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('forgot');
                          setLoginError(null);
                        }}
                        className="text-[11px] font-semibold text-red-800 hover:text-red-950 transition"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="Enter your password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-red-800 outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full py-2.5 bg-red-800 hover:bg-red-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <span>{loginLoading ? 'Authenticating...' : 'Sign In'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                {/* Switch to Sign Up */}
                <div className="pt-2 border-t border-slate-100 text-center">
                  <p className="text-xs text-slate-500">
                    New academic staff member?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setLoginError(null);
                      }}
                      className="font-bold text-red-800 hover:text-red-950 underline transition"
                    >
                      Sign Up & Request Role Authorization
                    </button>
                  </p>
                </div>
              </>
            )}

            {/* ======================================================== */}
            {/* MODE 2: SIGN UP / NEW MEMBER REGISTRATION                */}
            {/* ======================================================== */}
            {authMode === 'signup' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-red-800" />
                    <h3 className="font-bold text-sm text-slate-900">New Staff Member Registration</h3>
                  </div>
                  <button
                    onClick={() => {
                      setAuthMode('login');
                      setLoginError(null);
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Login</span>
                  </button>
                </div>

                <form onSubmit={handleSignup} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name & Academic Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Nimal Wickramasinghe"
                      value={signupFullName}
                      onChange={(e) => setSignupFullName(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-red-800 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Username *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. nimal"
                        value={signupUsername}
                        onChange={(e) => setSignupUsername(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-red-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="nimal@rusl.ac.lk"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-red-800 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Password * (min 6 chars)</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="••••••••"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-red-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        placeholder="e.g. 077-1234567"
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-red-800 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Designation</label>
                      <select
                        value={signupDesignation}
                        onChange={(e) => setSignupDesignation(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-red-800 outline-none"
                      >
                        <option value="Senior Professor">Senior Professor</option>
                        <option value="Professor">Professor</option>
                        <option value="Associate Professor">Associate Professor</option>
                        <option value="Senior Lecturer Grade I">Senior Lecturer Grade I</option>
                        <option value="Senior Lecturer Grade II">Senior Lecturer Grade II</option>
                        <option value="Lecturer (Confirmed)">Lecturer (Confirmed)</option>
                        <option value="Lecturer (Probationary)">Lecturer (Probationary)</option>
                        <option value="Visiting Lecturer">Visiting Lecturer</option>
                        <option value="Assistant Lecturer">Assistant Lecturer</option>
                        <option value="Assistant Registrar">Assistant Registrar</option>
                        <option value="HOD Clerk">HOD Clerk</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Requested Primary Role *</label>
                      <select
                        value={signupRole}
                        onChange={(e) => setSignupRole(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-red-800 outline-none font-semibold text-red-900"
                      >
                        <option value="LECTURER">Lecturer (1st Marking & Teaching)</option>
                        <option value="SECOND_EXAMINER">Second Examiner (Moderation)</option>
                        <option value="HOD_CLERK">HOD Clerk (Department Data)</option>
                        <option value="AR_OFFICE">AR Office (Logistics & Custody)</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                    <strong>Institutional Policy:</strong> Upon submission, your account is created and an authorization request will be sent to the Head of Department (HOD) for official role sanction.
                  </div>

                  <button
                    type="submit"
                    disabled={signupLoading}
                    className="w-full py-2.5 bg-red-800 hover:bg-red-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <span>{signupLoading ? 'Submitting Registration...' : 'Sign Up & Request Role Authorization'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="pt-2 text-center">
                  <button
                    onClick={() => {
                      setAuthMode('login');
                      setLoginError(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 underline font-semibold"
                  >
                    Already have an account? Sign In
                  </button>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* MODE 3: FORGOT PASSWORD / PASSWORD RESET OTP             */}
            {/* ======================================================== */}
            {authMode === 'forgot' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-red-800" />
                    <h3 className="font-bold text-sm text-slate-900">Password Recovery Portal</h3>
                  </div>
                  <button
                    onClick={() => {
                      setAuthMode('login');
                      setLoginError(null);
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Login</span>
                  </button>
                </div>

                {resetStep === 1 ? (
                  /* Step 1: Enter Username or Email */
                  <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                    <p className="text-xs text-slate-600">
                      Enter your registered university username or official email address. A 6-digit cryptographic verification code will be dispatched to your account.
                    </p>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Username or University Email
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. charith or charith@rusl.ac.lk"
                        value={resetIdentifier}
                        onChange={(e) => setResetIdentifier(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-red-800 outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full py-2.5 bg-red-800 hover:bg-red-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <span>{resetLoading ? 'Dispatching Verification Code...' : 'Send Verification OTP'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  /* Step 2: Enter OTP Code and New Password */
                  <form onSubmit={handleConfirmPasswordReset} className="space-y-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs">
                      <span>Verification code sent to <strong>{resetMaskedEmail}</strong>.</span>
                      {resetDebugOtp && (
                        <div className="mt-1 font-mono font-bold text-red-800">
                          [Demo Mode OTP: {resetDebugOtp}]
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        6-Digit Verification Code (OTP) *
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        placeholder="e.g. 123456"
                        value={resetOtp}
                        onChange={(e) => setResetOtp(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm tracking-widest font-mono text-center font-bold border rounded-xl focus:ring-2 focus:ring-red-800 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">New Password *</label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          placeholder="••••••••"
                          value={resetNewPassword}
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-red-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password *</label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          placeholder="••••••••"
                          value={resetConfirmPassword}
                          onChange={(e) => setResetConfirmPassword(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs border rounded-xl focus:ring-2 focus:ring-red-800 outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full py-2.5 bg-red-800 hover:bg-red-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <span>{resetLoading ? 'Updating Password...' : 'Confirm Reset & Return to Login'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Team Branding */}
          <p className="mt-4 text-center text-xs text-slate-400">
            Engineered by <span className="font-semibold text-slate-200">Syntax Squad</span> • Department of Computing, RUSL
          </p>
        </div>
      </div>
    );
  }

  // Render Role Dashboard
  const renderRoleDashboard = () => {
    if (user.roles.includes('HOD')) {
      return <HodDashboard user={user} onSelectSchedule={setSelectedSchedule} />;
    }
    if (user.roles.includes('AR_OFFICE')) {
      return <ArDashboard user={user} onSelectSchedule={setSelectedSchedule} />;
    }
    if (user.roles.includes('HOD_CLERK')) {
      return <ClerkDashboard user={user} onSelectSchedule={setSelectedSchedule} />;
    }
    if (user.roles.includes('DEAN')) {
      return <DeanDashboard />;
    }
    if (user.roles.includes('SECOND_EXAMINER') && !user.roles.includes('LECTURER')) {
      return <SecondExaminerDashboard user={user} onSelectSchedule={setSelectedSchedule} />;
    }
    // Default to Lecturer dashboard
    return <LecturerDashboard user={user} onSelectSchedule={setSelectedSchedule} />;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left Operations Sidebar */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        onOpenEmails={() => {
          setEmailViewerInitialTab('inbox');
          setShowEmailViewer(true);
        }}
        onOpenEmailSettings={() => {
          setEmailViewerInitialTab('settings');
          setShowEmailViewer(true);
        }}
        onOpenEditProfile={() => setIsEditProfileOpen(true)}
        isOpenMobile={isSidebarOpenMobile}
        onCloseMobile={() => setIsSidebarOpenMobile(false)}
      />

      {/* Main Operations Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <TopHeader
          user={user}
          activeTab={activeTab}
          onOpenMobileSidebar={() => setIsSidebarOpenMobile(true)}
          onOpenEmails={() => {
            setEmailViewerInitialTab('inbox');
            setShowEmailViewer(true);
          }}
          onOpenEditProfile={() => setIsEditProfileOpen(true)}
          onLogout={handleLogout}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {activeTab === 'dashboard' && renderRoleDashboard()}
          {activeTab === 'first-marking' && <LecturerDashboard user={user} onSelectSchedule={setSelectedSchedule} />}
          {activeTab === 'second-marking' && <SecondExaminerDashboard user={user} onSelectSchedule={setSelectedSchedule} />}
          {activeTab === 'schedules' && <SchedulesList user={user} onSelectSchedule={setSelectedSchedule} />}
          {activeTab === 'roles' && (user.roles.includes('HOD') || user.roles.includes('HOD_CLERK')) && <RoleManagementView user={user} />}
          {activeTab === 'audit' && user.roles.includes('HOD') && <AuditLogViewer />}
          {activeTab === 'dean' && (user.roles.includes('DEAN') || user.roles.includes('HOD')) && <DeanDashboard />}
        </main>
      </div>

      {/* Schedule Detail Modal */}
      {selectedSchedule && (
        <ScheduleDetailModal
          schedule={selectedSchedule}
          user={user}
          onClose={() => setSelectedSchedule(null)}
          onRefresh={handleRefreshSchedule}
        />
      )}

      {/* Auto-Customized Notification Email Viewer Modal */}
      {showEmailViewer && user && (
        <EmailViewerModal
          isOpen={showEmailViewer}
          onClose={() => setShowEmailViewer(false)}
          user={user}
          initialTab={emailViewerInitialTab}
        />
      )}

      {/* Edit Profile Modal */}
      {isEditProfileOpen && user && (
        <EditProfileModal
          user={user}
          isOpen={isEditProfileOpen}
          onClose={() => setIsEditProfileOpen(false)}
          onProfileUpdated={(updated) => setUser(updated)}
        />
      )}
    </div>
  );
};
