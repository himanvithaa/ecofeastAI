import React, { useState, useEffect } from 'react';
import { 
  Utensils, 
  TrendingUp, 
  AlertTriangle, 
  Truck, 
  ChevronRight, 
  MessageSquare,
  RefreshCw,
  Clock,
  MapPin,
  LogOut,
  History as HistoryIcon,
  CheckCircle2,
  Dog,
  User as UserIcon,
  ShieldCheck,
  Heart,
  Info,
  Phone,
  HelpCircle,
  Mail,
  Globe,
  LifeBuoy,
  Play,
  X,
  Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  limit,
  doc,
  getDoc,
  where,
  updateDoc,
  setDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';
import Auth from './components/Auth';
import { cn } from './lib/utils';
import { 
  predictDemand, 
  getRecommendedAction, 
  findNearestPartner, 
  PARTNERS,
  type Partner,
  type PartnerCategory
} from './lib/logic';
import { analyzeFoodImage, getDecisionExplanation, getChatbotResponse } from './lib/gemini';
import { translations, type Language } from './lib/translations';

const RESTAURANT_LOCATION = {
  name: "EcoFeast Hub (Restaurant)",
  lat: 12.9716,
  lon: 77.5946
};

function getFriendlyFirestoreError(error: any) {
  const code = error?.code || '';
  switch (code) {
    case 'permission-denied':
      return "You don't have permission to perform this action. Please check your account settings.";
    case 'unauthenticated':
      return "Your session has expired. Please sign in again.";
    case 'resource-exhausted':
      return "Quota exceeded. Please try again later.";
    case 'unavailable':
      return "The database is currently unavailable. Please check your connection.";
    default:
      return "A database error occurred. Please try again later.";
  }
}

function handleFirestoreError(error: any, operationType: string, path: string) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    code: error?.code,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return getFriendlyFirestoreError(error);
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'donor' | 'receiver' | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'about' | 'contact' | 'support' | 'faq'>('dashboard');
  
  // Donor state
  const [pastSales, setPastSales] = useState<number>(50);
  const [timeOfDay, setTimeOfDay] = useState<string>('Lunch');
  const [actualStock, setActualStock] = useState<number>(60);
  const [foodType, setFoodType] = useState<string>('Edible');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [isDonating, setIsDonating] = useState(false);
  const [donationSuccess, setDonationSuccess] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [incomingDonations, setIncomingDonations] = useState<any[]>([]);
  const [myDonations, setMyDonations] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showChatPopup, setShowChatPopup] = useState(true);

  // Chatbot state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([
    { role: 'model', text: 'Hello! I am your EcoFeast AI assistant. How can I help you today?' }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const t = translations[language];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && userRole === 'donor') {
      const q = query(
        collection(db, 'users', user.uid, 'analyses'),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHistory(items);
      }, (error) => {
        const message = handleFirestoreError(error, 'list', `users/${user.uid}/analyses`);
        setAppError(message);
      });
      return () => unsubscribe();
    }
  }, [user, userRole]);

  useEffect(() => {
    if (user && userRole === 'donor') {
      const q = query(
        collection(db, 'donations'),
        where('donorId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMyDonations(items);
      }, (error) => {
        const message = handleFirestoreError(error, 'list', 'donations');
        setAppError(message);
      });
      return () => unsubscribe();
    }
  }, [user, userRole]);

  useEffect(() => {
    if (user && userRole === 'receiver') {
      const q = query(
        collection(db, 'donations'),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setIncomingDonations(items);
      }, (error) => {
        const message = handleFirestoreError(error, 'list', 'donations');
        setAppError(message);
      });
      return () => unsubscribe();
    }
  }, [user, userRole]);

  const runAnalysis = async () => {
    if (!user) return;
    setIsAnalyzing(true);
    setExplanation(null);
    setDonationSuccess(false);
    setSelectedPartner(null);
    
    try {
      const predicted = predictDemand(pastSales, timeOfDay);
      const surplus = actualStock - pastSales;

      const action = getRecommendedAction(surplus, foodType);
      
      let categories: PartnerCategory[] = [];
      if (foodType === 'Edible') categories = ['NGO', 'Orphanage'];
      else if (foodType === 'Semi-edible') categories = ['PetFeed'];
      else if (foodType === 'Wet Waste') categories = ['Fertilizer'];

      const filteredPartners = PARTNERS.filter(p => categories.includes(p.category));
      const nearest = findNearestPartner(filteredPartners);

      const newResults = {
        predictedDemand: predicted,
        surplus: Math.max(0, surplus),
        recommendedAction: action,
        ngo: nearest,
        pastSales,
        timeOfDay,
        actualStock,
        foodType,
        timestamp: new Date().toISOString()
      };

      setResults(newResults);
      setSelectedPartner(nearest);

      // Save to Firestore
      try {
        await addDoc(collection(db, 'users', user.uid, 'analyses'), newResults);
      } catch (error) {
        const message = handleFirestoreError(error, 'create', `users/${user.uid}/analyses`);
        setAppError(message);
      }
      
      setIsExplaining(true);
      const aiExplanation = await getDecisionExplanation(newResults, language);
      setExplanation(aiExplanation);
    } catch (error: any) {
      console.error("Analysis failed:", error);
      setAppError(error.message || "Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
      setIsExplaining(false);
    }
  };

  const handleDonation = async () => {
    if (!user || !selectedPartner || !results) return;
    setIsDonating(true);
    try {
      await addDoc(collection(db, 'donations'), {
        donorId: user.uid,
        donorName: user.displayName || 'EcoFeast Partner',
        ngoName: selectedPartner.name,
        ngoType: selectedPartner.type,
        mealsCount: results.surplus,
        category: selectedPartner.category,
        status: 'pending',
        timestamp: new Date().toISOString()
      });
      setDonationSuccess(true);
    } catch (error) {
      const message = handleFirestoreError(error, 'create', `donations`);
      setAppError(message);
    } finally {
      setIsDonating(false);
    }
  };

  const handleAcceptDonation = async (donationId: string) => {
    if (!user) return;
    try {
      const donationRef = doc(db, 'donations', donationId);
      const donationSnap = await getDoc(donationRef);
      
      if (donationSnap.exists() && donationSnap.data().status !== 'pending') {
        setAppError("This donation has already been accepted by another partner.");
        return;
      }

      await updateDoc(donationRef, {
        status: 'accepted',
        acceptedBy: user.uid,
        acceptedByName: user.displayName || 'EcoFeast Partner',
        acceptedAt: new Date().toISOString()
      });
    } catch (error) {
      const message = handleFirestoreError(error, 'update', `donations/${donationId}`);
      setAppError(message);
    }
  };

  const handleCompleteDonation = async (donationId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'donations', donationId), {
        status: 'completed',
        completedAt: new Date().toISOString()
      });
    } catch (error) {
      const message = handleFirestoreError(error, 'update', `donations/${donationId}`);
      setAppError(message);
    }
  };

  const handleRejectDonation = async (donationId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'donations', donationId), {
        status: 'rejected',
        rejectedBy: user.uid,
        rejectedAt: new Date().toISOString()
      });
    } catch (error) {
      const message = handleFirestoreError(error, 'update', `donations/${donationId}`);
      setAppError(message);
    }
  };

  const handleSkipTutorial = async () => {
    setIsPlaying(false);
    if (!user) {
      setShowTutorial(false);
      return;
    }
    try {
      await setDoc(doc(db, 'users', user.uid), { showTutorial: false }, { merge: true });
      setShowTutorial(false);
    } catch (error) {
      console.error("Error updating tutorial status:", error);
      setShowTutorial(false);
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || isChatLoading) return;

    const userMsg = { role: 'user', text: chatMessage };
    setChatHistory(prev => [...prev, userMsg]);
    setChatMessage('');
    setIsChatLoading(true);

    try {
      const response = await getChatbotResponse(chatMessage, chatHistory, language);
      setChatHistory(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsChatLoading(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user) {
    return <Auth language={language} setLanguage={setLanguage} />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Error Banner */}
        <AnimatePresence>
          {appError && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 text-red-700">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{appError}</p>
              </div>
              <button 
                onClick={() => setAppError(null)}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-500 p-2 rounded-lg">
                <Utensils className="text-white w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {t.appName}
              </h1>
            </div>
            <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  activeTab === 'dashboard' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {t.dashboard}
              </button>
              <button 
                onClick={() => setActiveTab('about')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  activeTab === 'about' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {t.about}
              </button>
              <button 
                onClick={() => setActiveTab('faq')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  activeTab === 'faq' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {t.faq}
              </button>
              <button 
                onClick={() => setActiveTab('contact')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  activeTab === 'contact' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {t.contact}
              </button>
              <button 
                onClick={() => setActiveTab('support')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  activeTab === 'support' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {t.support}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm text-sm font-medium outline-none"
            >
              <option value="en">English</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
            </select>
            {userRole === 'donor' && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setShowHistory(!showHistory);
                    setShowTracking(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border shadow-sm transition-all",
                    showHistory ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <HistoryIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">{t.history}</span>
                </button>
                <button 
                  onClick={() => {
                    setShowTracking(!showTracking);
                    setShowHistory(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl border shadow-sm transition-all",
                    showTracking ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <Truck className="w-4 h-4" />
                  <span className="text-sm font-medium">{t.redirectionTracking}</span>
                </button>
              </div>
            )}
            <button 
              onClick={async () => {
                if (!user) return;
                const newRole = userRole === 'donor' ? 'receiver' : 'donor';
                await setDoc(doc(db, 'users', user.uid), { role: newRole }, { merge: true });
                setUserRole(newRole);
              }}
              className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-100 shadow-sm hover:bg-emerald-100 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm font-bold">Switch to {userRole === 'donor' ? 'Receiver' : 'Donor'}</span>
            </button>
            <button 
              onClick={() => signOut(auth)}
              className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm hover:bg-red-50 hover:text-red-600 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">{t.logout}</span>
            </button>
          </div>
        </header>

        <main className="min-h-[60vh]">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {!userRole ? (
                  <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center">
                    <ShieldCheck className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Complete Your Profile</h2>
                    <p className="text-slate-500 mb-8">Please select your primary role to continue to the dashboard.</p>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={async () => {
                          if (!user) return;
                          const role = 'donor';
                          await setDoc(doc(db, 'users', user.uid), {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName || 'User',
                            role: role,
                            createdAt: new Date().toISOString()
                          }, { merge: true });
                          setUserRole(role);
                        }}
                        className="p-4 rounded-2xl border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                      >
                        <Heart className="w-8 h-8 text-slate-400 group-hover:text-emerald-600 mx-auto mb-2" />
                        <span className="text-sm font-bold text-slate-600 group-hover:text-emerald-700">GIVE FOOD</span>
                      </button>
                      <button
                        onClick={async () => {
                          if (!user) return;
                          const role = 'receiver';
                          await setDoc(doc(db, 'users', user.uid), {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName || 'User',
                            role: role,
                            createdAt: new Date().toISOString()
                          }, { merge: true });
                          setUserRole(role);
                        }}
                        className="p-4 rounded-2xl border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
                      >
                        <ShieldCheck className="w-8 h-8 text-slate-400 group-hover:text-emerald-600 mx-auto mb-2" />
                        <span className="text-sm font-bold text-slate-600 group-hover:text-emerald-700">GET FOOD</span>
                      </button>
                    </div>
                  </div>
                ) : userRole === 'receiver' ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold flex items-center gap-2">
                        <ShieldCheck className="w-7 h-7 text-emerald-600" />
                        {t.receiverDashboard}
                      </h2>
                      <div className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-bold">
                        Get Food Account
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <Heart className="w-5 h-5 text-red-500" />
                        {t.incomingDonations}
                      </h3>
                      
                      <div className="grid gap-4">
                        {incomingDonations.length > 0 ? incomingDonations.map((donation) => (
                          <div key={donation.id} className="p-6 rounded-2xl border border-slate-100 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="bg-white p-3 rounded-xl shadow-sm">
                                <Truck className="w-6 h-6 text-emerald-600" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{donation.mealsCount} {t.meals} ({donation.category})</p>
                                <p className="text-sm text-slate-500">
                                  From: {donation.donorName || 'EcoFeast Partner'} • {new Date(donation.timestamp).toLocaleString()}
                                </p>
                                <p className={cn(
                                  "text-xs font-bold mt-1",
                                  donation.status === 'accepted' ? "text-emerald-600" : 
                                  donation.status === 'rejected' ? "text-red-600" :
                                  donation.status === 'completed' ? "text-slate-500" : "text-amber-600"
                                )}>
                                  Status: {donation.status === 'rejected' ? t.rejected.toUpperCase() : donation.status.toUpperCase()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {donation.status === 'pending' && (
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => handleAcceptDonation(donation.id)}
                                    className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-all"
                                  >
                                    {t.acceptDonation}
                                  </button>
                                  <button 
                                    onClick={() => handleRejectDonation(donation.id)}
                                    className="bg-white text-red-600 border border-red-200 px-6 py-2 rounded-xl font-bold hover:bg-red-50 transition-all"
                                  >
                                    {t.rejectDonation}
                                  </button>
                                </div>
                              )}
                              {donation.status === 'accepted' && (
                                <>
                                  <div className="flex items-center gap-2 text-emerald-600 font-bold mr-4">
                                    <CheckCircle2 className="w-5 h-5" />
                                    {t.donationAccepted}
                                  </div>
                                  <button 
                                    onClick={() => handleCompleteDonation(donation.id)}
                                    className="bg-slate-800 text-white px-6 py-2 rounded-xl font-bold hover:bg-slate-900 transition-all"
                                  >
                                    {t.markAsCompleted}
                                  </button>
                                </>
                              )}
                              {donation.status === 'completed' && (
                                <div className="flex items-center gap-2 text-slate-500 font-bold">
                                  <CheckCircle2 className="w-5 h-5" />
                                  {t.completed}
                                </div>
                              )}
                            </div>
                          </div>
                        )) : (
                          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                            <p className="text-slate-400 font-medium">{t.noDonations}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {showHistory ? (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h2 className="text-xl font-bold flex items-center gap-2">
                            <HistoryIcon className="w-6 h-6 text-emerald-600" />
                            {t.analysisHistory}
                          </h2>
                          <button 
                            onClick={() => setShowHistory(false)}
                            className="text-emerald-600 font-medium hover:underline"
                          >
                            {t.backToDashboard}
                          </button>
                        </div>
                        <div className="grid gap-4">
                          {history.length > 0 ? history.map((item) => (
                            <div key={item.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div>
                                <p className="font-bold text-slate-900">{item.recommendedAction}</p>
                                <p className="text-sm text-slate-500">
                                  {item.timeOfDay} • {item.surplus} {t.meals} {t.surplus} • {new Date(item.timestamp).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-bold">
                                <CheckCircle2 className="w-4 h-4" />
                                Analyzed
                              </div>
                            </div>
                          )) : (
                            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
                              <p className="text-slate-500">{t.noHistory}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : showTracking ? (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h2 className="text-xl font-bold flex items-center gap-2">
                            <Truck className="w-6 h-6 text-emerald-600" />
                            {t.redirectionTracking}
                          </h2>
                          <button 
                            onClick={() => setShowTracking(false)}
                            className="text-emerald-600 font-medium hover:underline"
                          >
                            {t.backToDashboard}
                          </button>
                        </div>
                        <div className="grid gap-4">
                          {myDonations.length > 0 ? myDonations.map((donation) => (
                            <div key={donation.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "p-3 rounded-xl",
                                  donation.status === 'completed' ? "bg-slate-100 text-slate-400" : "bg-emerald-50 text-emerald-600"
                                )}>
                                  <Truck className="w-6 h-6" />
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900">{donation.mealsCount} {t.meals} to {donation.ngoName}</p>
                                  <p className="text-sm text-slate-500">
                                    {donation.category} • {new Date(donation.timestamp).toLocaleString()}
                                  </p>
                                  {donation.acceptedByName && (
                                    <p className="text-xs text-emerald-600 font-medium mt-1">
                                      Accepted by: {donation.acceptedByName}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider",
                                  donation.status === 'pending' ? "bg-amber-100 text-amber-700" :
                                  donation.status === 'accepted' ? "bg-emerald-100 text-emerald-700" :
                                  donation.status === 'rejected' ? "bg-red-100 text-red-700" :
                                  "bg-slate-100 text-slate-500"
                                )}>
                                  {donation.status === 'rejected' ? t.rejected : donation.status}
                                </div>
                              </div>
                            </div>
                          )) : (
                            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 border-dashed">
                              <p className="text-slate-500">{t.noDonationsFound}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between mb-2">
                          <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Utensils className="w-7 h-7 text-emerald-600" />
                            {t.appName} {t.dashboard}
                          </h2>
                          <div className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-bold">
                            Give Food Account
                          </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Left Column: Inputs */}
                        <div className="lg:col-span-4 space-y-6">
                          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                              <TrendingUp className="w-5 h-5 text-emerald-600" />
                              {t.parameters}
                            </h2>
                            
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t.pastSales}</label>
                                <input 
                                  type="number" 
                                  value={pastSales}
                                  onChange={(e) => setPastSales(Number(e.target.value))}
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t.timeOfDay}</label>
                                <select 
                                  value={timeOfDay}
                                  onChange={(e) => setTimeOfDay(e.target.value)}
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-white"
                                >
                                  <option>Breakfast</option>
                                  <option>Lunch</option>
                                  <option>Dinner</option>
                                  <option>Late Night</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t.currentStock}</label>
                                <input 
                                  type="number" 
                                  value={actualStock}
                                  onChange={(e) => setActualStock(Number(e.target.value))}
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t.foodType}</label>
                                <select 
                                  value={foodType}
                                  onChange={(e) => setFoodType(e.target.value)}
                                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-white"
                                >
                                  <option value="Edible">{t.edible}</option>
                                  <option value="Semi-edible">{t.semiEdible}</option>
                                  <option value="Wet Waste">{t.wetWaste}</option>
                                </select>
                              </div>

                              <button 
                                onClick={runAnalysis}
                                disabled={isAnalyzing}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                {isAnalyzing ? (
                                  <RefreshCw className="w-5 h-5 animate-spin" />
                                ) : (
                                  <>
                                    {t.analyze}
                                    <ChevronRight className="w-5 h-5" />
                                  </>
                                )}
                              </button>
                            </div>
                          </section>
                        </div>

                        {/* Right Column: Results */}
                        <div className="lg:col-span-8 space-y-6">
                          <AnimatePresence mode="wait">
                            {results ? (
                              <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-6"
                              >
                                {/* Summary Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-3 mb-2">
                                      <div className="bg-blue-100 p-2 rounded-lg">
                                        <Clock className="w-5 h-5 text-blue-600" />
                                      </div>
                                      <span className="text-sm font-medium text-slate-500">{t.predicted}</span>
                                    </div>
                                    <p className="text-3xl font-bold text-slate-900">{results.predictedDemand} <span className="text-sm font-normal text-slate-400">{t.meals}</span></p>
                                  </div>

                                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-3 mb-2">
                                      <div className="bg-amber-100 p-2 rounded-lg">
                                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                                      </div>
                                      <span className="text-sm font-medium text-slate-500">{t.surplus}</span>
                                    </div>
                                    <p className="text-3xl font-bold text-amber-600">{results.surplus} <span className="text-sm font-normal text-slate-400">{t.meals}</span></p>
                                  </div>

                                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-3 mb-2">
                                      <div className="bg-emerald-100 p-2 rounded-lg">
                                        <Truck className="w-5 h-5 text-emerald-600" />
                                      </div>
                                      <span className="text-sm font-medium text-slate-500">{t.impact}</span>
                                    </div>
                                    <p className="text-3xl font-bold text-emerald-600">+{results.surplus}</p>
                                    <p className="text-xs text-slate-400">{t.mealsSaved}</p>
                                  </div>
                                </div>

                                {/* Partner Selection */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <MapPin className="w-5 h-5 text-emerald-600" />
                                    {t.selectPartner}
                                  </h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {PARTNERS.filter(p => {
                                      if (foodType === 'Edible') return p.category === 'NGO' || p.category === 'Orphanage';
                                      if (foodType === 'Semi-edible') return p.category === 'PetFeed';
                                      if (foodType === 'Wet Waste') return p.category === 'Fertilizer';
                                      return false;
                                    }).map((partner) => (
                                      <button
                                        key={partner.id}
                                        onClick={() => setSelectedPartner(partner)}
                                        className={cn(
                                          "p-4 rounded-xl border text-left transition-all",
                                          selectedPartner?.id === partner.id 
                                            ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500" 
                                            : "border-slate-200 hover:border-emerald-200"
                                        )}
                                      >
                                        <div className="flex justify-between items-start mb-1">
                                          <span className="font-bold text-slate-900">{partner.name}</span>
                                          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">{partner.distance}{t.km}</span>
                                        </div>
                                        <p className="text-xs text-slate-500">{partner.type}</p>
                                      </button>
                                    ))}
                                  </div>

                                  {selectedPartner && (
                                    <div className="mt-6 pt-6 border-t border-slate-100">
                                      <div className="flex items-center justify-between mb-4">
                                        <div>
                                          <p className="text-sm text-slate-500">{t.redistributingTo}</p>
                                          <p className="font-bold text-lg">{selectedPartner.name}</p>
                                          <div className="mt-2 text-xs text-slate-400 space-y-1">
                                            <p className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {selectedPartner.address}</p>
                                            <p className="flex items-center gap-1"><Mail className="w-3 h-3" /> {selectedPartner.email}</p>
                                            <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedPartner.phone}</p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-sm text-slate-500">{t.totalSurplus}</p>
                                          <p className="font-bold text-lg text-emerald-600">{results.surplus} {t.meals}</p>
                                        </div>
                                      </div>
                                      
                                      {donationSuccess ? (
                                        <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-100 flex items-center gap-3">
                                          <CheckCircle2 className="w-6 h-6" />
                                          <span className="font-medium">{t.success}</span>
                                        </div>
                                      ) : results.surplus > 0 ? (
                                        <button 
                                          onClick={handleDonation}
                                          disabled={isDonating}
                                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                          {isDonating ? <RefreshCw className="w-5 h-5 animate-spin" /> : t.confirm}
                                        </button>
                                      ) : (
                                        <div className="bg-amber-50 text-amber-700 p-4 rounded-xl border border-amber-100 flex items-center gap-3">
                                          <Info className="w-6 h-6" />
                                          <span className="text-sm font-medium">No surplus food to redistribute at this time.</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Agent Reasoning */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <MessageSquare className="w-5 h-5 text-emerald-600" />
                                      <h3 className="font-semibold">{t.reasoning}</h3>
                                    </div>
                                    {isExplaining && <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />}
                                  </div>
                                  <div className="p-6 prose prose-slate max-w-none">
                                    {explanation ? (
                                      <div className="text-slate-600 leading-relaxed text-sm">
                                        <ReactMarkdown>{explanation}</ReactMarkdown>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col gap-2">
                                        <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse" />
                                        <div className="h-4 bg-slate-100 rounded w-1/2 animate-pulse" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            ) : (
                              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border border-slate-200 border-dashed">
                                <div className="bg-slate-50 p-6 rounded-full mb-4">
                                  <TrendingUp className="w-12 h-12 text-slate-300" />
                                </div>
                                <h3 className="text-xl font-semibold text-slate-900 mb-2">{t.ready}</h3>
                                <p className="text-slate-500 max-w-md">
                                  {t.readyDesc}
                                </p>
                              </div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  )}
                  </>
                )}
              </motion.div>
            )}

            {activeTab === 'about' && (
              <motion.div
                key="about"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h2 className="text-3xl font-bold text-slate-900 mb-6">{t.about}</h2>
                  
                  {/* Video Tutorial Section */}
                  <div className="mb-12 p-6 rounded-3xl bg-slate-900 text-white overflow-hidden relative">
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                      <div className="flex-1 space-y-4">
                        <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                          <Video className="w-3 h-3" />
                          {t.videoTutorial}
                        </div>
                        <h3 className="text-2xl font-bold">See how EcoFeast AI works</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">
                          Watch our quick guide to understand how our AI predicts demand and helps redistribute surplus food to those in need.
                        </p>
                        <button 
                          onClick={() => setShowTutorial(true)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          {t.watchTutorial}
                        </button>
                      </div>
                      <div className="flex-1 w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative group cursor-pointer" onClick={() => setShowTutorial(true)}>
                        <img 
                          src="https://picsum.photos/seed/tutorial-thumb/800/450" 
                          alt="Tutorial Thumbnail" 
                          className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-white/20 backdrop-blur-md p-4 rounded-full border border-white/30 group-hover:scale-110 transition-all">
                            <Play className="w-8 h-8 text-white fill-current" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-8 mb-12">
                    <div className="space-y-3">
                      <div className="bg-emerald-100 w-12 h-12 rounded-2xl flex items-center justify-center">
                        <Globe className="w-6 h-6 text-emerald-600" />
                      </div>
                      <h3 className="text-xl font-bold">{t.mission}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed">{t.missionDesc}</p>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-blue-100 w-12 h-12 rounded-2xl flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-blue-600" />
                      </div>
                      <h3 className="text-xl font-bold">{t.vision}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed">{t.visionDesc}</p>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-amber-100 w-12 h-12 rounded-2xl flex items-center justify-center">
                        <Heart className="w-6 h-6 text-amber-600" />
                      </div>
                      <h3 className="text-xl font-bold">{t.values}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed">{t.valuesDesc}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'faq' && (
              <motion.div
                key="faq"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h2 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <HelpCircle className="w-8 h-8 text-emerald-600" />
                    {t.faqTitle}
                  </h2>
                  <div className="space-y-4">
                    {[
                      { q: t.q1, a: t.a1 },
                      { q: t.q2, a: t.a2 },
                      { q: t.q3, a: t.a3 },
                      { q: t.q4, a: t.a4 },
                      { q: t.q5, a: t.a5 },
                      { q: t.q6, a: t.a6 },
                      { q: t.q7, a: t.a7 }
                    ].map((item, i) => (
                      <div key={i} className="p-6 rounded-2xl border border-slate-100 bg-slate-50">
                        <h4 className="font-bold text-slate-900 mb-2">{item.q}</h4>
                        <p className="text-slate-600 text-sm">{item.a}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'contact' && (
              <motion.div
                key="contact"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid md:grid-cols-2 gap-8"
              >
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Mail className="w-6 h-6 text-emerald-600" />
                    {t.contactInfo}
                  </h2>
                  <div className="space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="bg-slate-100 p-3 rounded-xl">
                        <MapPin className="w-5 h-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.address}</p>
                        <p className="text-slate-700">EcoFeast AI HQ, 10th Floor, Tech Park, Bangalore, India</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="bg-slate-100 p-3 rounded-xl">
                        <Mail className="w-5 h-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.email}</p>
                        <p className="text-slate-700">support@ecofeast.ai</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="bg-slate-100 p-3 rounded-xl">
                        <Phone className="w-5 h-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.phone}</p>
                        <p className="text-slate-700">+91 80 1234 5678</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Globe className="w-6 h-6 text-emerald-600" />
                    {t.partnerDetails}
                  </h2>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {PARTNERS.slice(0, 5).map((partner) => (
                      <div key={partner.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                        <p className="font-bold text-slate-900">{partner.name}</p>
                        <p className="text-xs text-slate-500 mb-2">{partner.type}</p>
                        <div className="text-[10px] text-slate-400 space-y-1">
                          <p className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {partner.address}</p>
                          <p className="flex items-center gap-1"><Mail className="w-3 h-3" /> {partner.email}</p>
                          <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {partner.phone}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'support' && (
              <motion.div
                key="support"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                {/* Video Tutorial Section */}
                <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
                  <div className="p-8 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white">{t.tutorialTitle}</h2>
                      <p className="text-slate-400 text-sm">{t.tutorialDesc}</p>
                    </div>
                  </div>
                  
                  <div className="aspect-video bg-black relative group">
                    {!isPlaying ? (
                      <>
                        <img 
                          src="https://picsum.photos/seed/tutorial-support/1280/720" 
                          alt="Tutorial Video Placeholder" 
                          className="w-full h-full object-cover opacity-40"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <button 
                            onClick={() => setIsPlaying(true)}
                            className="bg-emerald-600 p-6 rounded-full shadow-xl hover:scale-110 transition-all cursor-pointer"
                          >
                            <Play className="w-10 h-10 text-white fill-current" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <video 
                        src="https://assets.mixkit.co/videos/preview/mixkit-delivery-man-carrying-a-box-of-food-41168-large.mp4" 
                        className="w-full h-full object-contain"
                        controls
                        autoPlay
                        onEnded={() => setIsPlaying(false)}
                      />
                    )}
                  </div>
                </div>

                <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center">
                  <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <LifeBuoy className="w-10 h-10 text-emerald-600 animate-spin-slow" />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-4">{t.support}</h2>
                  <p className="text-slate-500 mb-8">{t.supportDesc}</p>
                  <button className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-3">
                    <MessageSquare className="w-6 h-6" />
                    {t.customerCare}
                  </button>
                  <div className="mt-8 grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Response Time</p>
                      <p className="font-bold text-slate-900">&lt; 5 Minutes</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Availability</p>
                      <p className="font-bold text-slate-900">24/7 Support</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Floating Chatbot */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          <AnimatePresence>
            {showChatPopup && !isChatOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                className="bg-emerald-600 text-white px-4 py-2 rounded-2xl rounded-br-none shadow-xl text-sm font-medium relative mb-2"
              >
                How can I help you?
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowChatPopup(false);
                  }}
                  className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-0.5 hover:bg-slate-700 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isChatOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-80 md:w-96 h-[500px] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden mb-4"
              >
                <div className="bg-emerald-600 p-4 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    <span className="font-bold">{t.chatbot}</span>
                  </div>
                  <button onClick={() => setIsChatOpen(false)} className="hover:bg-emerald-700 p-1 rounded-lg transition-colors">
                    <ChevronRight className="w-5 h-5 rotate-90" />
                  </button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-4 space-y-4">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={cn(
                      "flex",
                      msg.role === 'user' ? "justify-end" : "justify-start"
                    )}>
                      <div className={cn(
                        "max-w-[80%] p-3 rounded-2xl text-sm",
                        msg.role === 'user' 
                          ? "bg-emerald-600 text-white rounded-tr-none" 
                          : "bg-slate-100 text-slate-800 rounded-tl-none"
                      )}>
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none">
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleChat} className="p-4 border-t border-slate-100 flex gap-2">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder={t.chatPlaceholder}
                    className="flex-grow px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  />
                  <button 
                    type="submit"
                    disabled={isChatLoading}
                    className="bg-emerald-600 text-white p-2 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
          
          <button
            onClick={() => {
              setIsChatOpen(!isChatOpen);
              setShowChatPopup(false);
            }}
            className="bg-emerald-600 text-white p-4 rounded-full shadow-2xl hover:bg-emerald-700 transition-all hover:scale-110 active:scale-95"
          >
            {isChatOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
          </button>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 text-sm">
          <p>© 2026 EcoFeast AI Agent • Hackathon MVP • Powered by Firebase & Gemini</p>
        </footer>
      </div>
    </div>
  );
}
