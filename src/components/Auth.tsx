import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { 
  Utensils, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  Loader2, 
  Chrome, 
  ShieldCheck, 
  Heart,
  Check,
  MessageSquare
} from 'lucide-react';
import { motion } from 'motion/react';

interface AuthProps {
  language: 'en' | 'kn';
  setLanguage: (lang: 'en' | 'kn') => void;
}

export default function Auth({ language, setLanguage }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'donor' | 'receiver'>('donor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFriendlyErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/invalid-email':
        return 'The email address is not valid.';
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/wrong-password':
        return 'Incorrect password.';
      case 'auth/email-already-in-use':
        return 'An account already exists with this email.';
      default:
        return 'An unexpected error occurred.';
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'User',
          role: role,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await updateProfile(user, { displayName: name });
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: name,
          role: role,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* Header */}
      <header className="bg-[#00966d] px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2 text-white">
          <div className="bg-white p-1.5 rounded-lg">
            <Utensils className="w-5 h-5 text-[#00966d]" />
          </div>
          <span className="text-xl font-bold tracking-tight">EcoFeast AI</span>
        </div>
        <button 
          onClick={() => setIsLogin(!isLogin)}
          className="bg-white text-[#00966d] px-5 py-1.5 rounded-full text-sm font-bold hover:bg-emerald-50 transition-all shadow-sm"
        >
          {isLogin ? 'Sign Up' : 'Login'}
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-12">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#1E293B] leading-tight">
            India's Premier <span className="relative inline-block text-[#00966d]">
              Food Waste
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 25 0, 50 5 T 100 5" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </span> Marketplace
          </h1>
          <p className="text-slate-500 mt-6 text-lg font-medium">
            Eliminate waste. Feed the hungry. Join 10,000+ verified restaurants and NGOs across Karnataka and beyond.
          </p>
        </div>

        {/* Auth Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[420px] bg-white rounded-[40px] shadow-2xl overflow-hidden border border-slate-100"
        >
          {/* Card Top Section */}
          <div className="bg-[#00966d] p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="relative z-10">
              <div className="bg-white/20 backdrop-blur-md w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Utensils className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">EcoFeast AI</h2>
              <p className="text-emerald-50 text-sm mt-1 opacity-90">Direct connection, better impact.</p>
            </div>
          </div>

          <div className="p-8 space-y-6">
            {/* Role Selection */}
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">
                CHOOSE YOUR ROLE TO START
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRole('donor')}
                  className={`relative flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all duration-300 ${
                    role === 'donor' 
                      ? 'border-[#00966d] bg-emerald-50/50 shadow-lg shadow-emerald-100' 
                      : 'border-slate-100 bg-slate-50/50 hover:border-emerald-200'
                  }`}
                >
                  {role === 'donor' && (
                    <div className="absolute top-2 right-2 bg-[#00966d] rounded-full p-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className={`p-3 rounded-2xl mb-2 transition-colors ${role === 'donor' ? 'bg-[#00966d] text-white' : 'bg-white text-slate-400 shadow-sm'}`}>
                    <Heart className="w-6 h-6" />
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${role === 'donor' ? 'text-[#00966d]' : 'text-slate-400'}`}>
                    GIVE FOOD
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('receiver')}
                  className={`relative flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all duration-300 ${
                    role === 'receiver' 
                      ? 'border-[#00966d] bg-emerald-50/50 shadow-lg shadow-emerald-100' 
                      : 'border-slate-100 bg-slate-50/50 hover:border-emerald-200'
                  }`}
                >
                  {role === 'receiver' && (
                    <div className="absolute top-2 right-2 bg-[#00966d] rounded-full p-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className={`p-3 rounded-2xl mb-2 transition-colors ${role === 'receiver' ? 'bg-[#00966d] text-white' : 'bg-white text-slate-400 shadow-sm'}`}>
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${role === 'receiver' ? 'text-[#00966d]' : 'text-slate-400'}`}>
                    GET FOOD
                  </span>
                </button>
              </div>
            </div>

            {/* Language Switcher */}
            <div className="flex justify-center gap-2">
              <button 
                onClick={() => setLanguage('en')}
                className={`px-4 py-1 rounded-full text-[10px] font-bold transition-all ${language === 'en' ? 'bg-[#00966d] text-white' : 'bg-slate-100 text-slate-400'}`}
              >
                English
              </button>
              <button 
                onClick={() => setLanguage('kn')}
                className={`px-4 py-1 rounded-full text-[10px] font-bold transition-all ${language === 'kn' ? 'bg-[#00966d] text-white' : 'bg-slate-100 text-slate-400'}`}
              >
                ಕನ್ನಡ
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-[#00966d] outline-none transition-all text-sm placeholder:text-slate-400"
                    placeholder="Full Name"
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-[#00966d] outline-none transition-all text-sm placeholder:text-slate-400"
                  placeholder="Email Address"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-[#00966d] outline-none transition-all text-sm placeholder:text-slate-400"
                  placeholder="Password"
                />
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="text-xs text-red-500 font-medium bg-red-50 p-3 rounded-xl border border-red-100"
                >
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#00966d] hover:bg-[#008560] text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Login' : 'Create Account'}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-[10px] font-bold text-slate-400 hover:text-[#00966d] uppercase tracking-wider transition-colors"
              >
                {isLogin ? "NEED AN ACCOUNT? SIGN UP" : 'ALREADY HAVE AN ACCOUNT? LOGIN'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Social Login */}
        <div className="mt-8 w-full max-w-[420px]">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-600 font-bold py-3.5 px-4 rounded-2xl border border-slate-200 shadow-sm transition-all disabled:opacity-50 text-sm"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Chrome className="w-5 h-5 text-blue-500" />}
            Continue with Google
          </button>
        </div>
      </main>

      {/* Floating Chat Icon */}
      <div className="fixed bottom-8 right-8">
        <div className="bg-[#00966d] p-4 rounded-full shadow-xl cursor-pointer hover:scale-110 transition-transform">
          <MessageSquare className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}
