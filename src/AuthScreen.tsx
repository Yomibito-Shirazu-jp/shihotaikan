import React, { useState, useEffect } from 'react';
import { LogIn, FileText, Mail, User as UserIcon, Phone, MapPin, Calendar, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { auth, db } from './firebase';
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, GoogleAuthProvider, signInWithPopup, signInAnonymously } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [formData, setFormData] = useState({
    name: '',
    birthdate: '',
    birthplace: '',
    phone: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');
  const [isAuthNotAllowed, setIsAuthNotAllowed] = useState(false);

  useEffect(() => {
    const handleEmailLink = async () => {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
          email = window.prompt('確認のため、メールアドレスを入力してください。');
        }
        if (email) {
          setLoading(true);
          try {
            const result = await signInWithEmailLink(auth, email, window.location.href);
            window.localStorage.removeItem('emailForSignIn');
            
            const savedDataStr = window.localStorage.getItem('userDataForSignIn');
            if (savedDataStr) {
              const savedData = JSON.parse(savedDataStr);
              await setDoc(doc(db, 'users', result.user.uid), {
                ...savedData,
                createdAt: serverTimestamp()
              }, { merge: true });
              window.localStorage.removeItem('userDataForSignIn');
            }
          } catch (err: any) {
            console.error(err);
            setError('ログイントークンの有効期限が切れているか、無効です。もう一度お試しください。');
          } finally {
            setLoading(false);
          }
        }
      }
    };
    handleEmailLink();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setIsAuthNotAllowed(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      setError('メールアドレスを入力してください');
      return;
    }
    
    setLoading(true);
    setError('');
    setIsAuthNotAllowed(false);

    try {
      const actionCodeSettings = {
        url: window.location.origin, 
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(auth, formData.email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', formData.email);
      
      if (mode === 'register' || mode === 'login') {
        window.localStorage.setItem('userDataForSignIn', JSON.stringify({
          name: formData.name,
          birthdate: formData.birthdate,
          birthplace: formData.birthplace,
          phone: formData.phone,
          email: formData.email
        }));
      }

      setEmailSent(true);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setIsAuthNotAllowed(true);
        setError('Firebase側でメールリンク認証が未設定のため、自動メール送信ができません。顧客情報（Firebase設定）が確認できるまでの間、以下の代替手段（メールソフト・仮ログイン・Googleログイン）で進めてください。');
      } else {
        setError('メール送信に失敗しました。時間をおいて再度お試しください。');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      setError('Googleログインに失敗しました');
    }
  };

  const handleMockLogin = async () => {
    try {
      setLoading(true);
      // Fallback: Anonymously long in and save data to allow them into the app
      const result = await signInAnonymously(auth);
      await setDoc(doc(db, 'users', result.user.uid), {
         name: formData.name || 'ゲストユーザー',
         email: formData.email || 'guest@example.com',
         isAnonymousFallback: true,
         createdAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error(err);
      setError('仮ログインに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleMailto = () => {
    const subject = encodeURIComponent('【司法大観】システム利用申請');
    const body = encodeURIComponent(`以下の内容でシステム利用申請をします。\n\n【申請者情報】\n氏名: ${formData.name}\n生年月日: ${formData.birthdate}\n出身地: ${formData.birthplace}\n電話番号: ${formData.phone}\nメールアドレス: ${formData.email}\n\n※管理者の方は、このメールを受け取り次第、ユーザーの本人確認およびシステムへのアクセス許可を行ってください。`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6 font-sans">
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-neutral-200 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-4 text-neutral-800">認証メールを送信しました</h2>
          <p className="text-neutral-600 text-sm mb-6 leading-relaxed">
            <span className="font-medium text-black">{formData.email}</span> 宛にログイン用のリンクを送信しました。メール内のリンクをクリックして認証を完了してください。
          </p>
          <button 
            onClick={() => setEmailSent(false)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-center items-center p-6 font-sans">
      
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <FileText className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">司法大観</h1>
        <p className="text-neutral-500 mt-1">オンライン入稿システム</p>
      </div>

      <div className="bg-white w-full max-w-md rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        
        <div className="flex border-b border-neutral-200">
          <button
            type="button"
            className={`flex-1 py-4 text-sm font-medium transition-colors ${
              mode === 'register' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
            }`}
            onClick={() => { setMode('register'); setError(''); setIsAuthNotAllowed(false); }}
          >
            新規登録
          </button>
          <button
            type="button"
            className={`flex-1 py-4 text-sm font-medium transition-colors ${
              mode === 'login' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
            }`}
            onClick={() => { setMode('login'); setError(''); setIsAuthNotAllowed(false); }}
          >
            ログイン
          </button>
        </div>

        <div className="p-6 sm:p-8">
          
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className={`space-y-4 ${mode === 'login' ? 'opacity-50' : ''}`}>
              {/* 名前 */}
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">氏名</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-4 w-4 text-neutral-400" />
                  </div>
                  <input
                    type="text"
                    name="name"
                    required={mode === 'register'}
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="例: 法曹 太郎"
                    className="block w-full pl-10 pr-3 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 sm:text-sm outline-none"
                  />
                </div>
              </div>

              {/* 生年月日 */}
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">生年月日</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-4 w-4 text-neutral-400" />
                  </div>
                  <input
                    type="date"
                    name="birthdate"
                    required={mode === 'register'}
                    value={formData.birthdate}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 sm:text-sm outline-none"
                  />
                </div>
              </div>

              {/* 出身地 */}
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">出身地</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-4 w-4 text-neutral-400" />
                  </div>
                  <input
                    type="text"
                    name="birthplace"
                    required={mode === 'register'}
                    value={formData.birthplace}
                    onChange={handleChange}
                    placeholder="例: 東京都"
                    className="block w-full pl-10 pr-3 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 sm:text-sm outline-none"
                  />
                </div>
              </div>

              {/* 携帯電話 */}
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">携帯電話</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-neutral-400" />
                  </div>
                  <input
                    type="tel"
                    name="phone"
                    required={mode === 'register'}
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="090-0000-0000"
                    className="block w-full pl-10 pr-3 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 sm:text-sm outline-none"
                  />
                </div>
              </div>
            </div>

            {/* メールアドレス（両方で必須） */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-neutral-600 mb-1">メールアドレス {mode === 'login' && '(ログイン用)'}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-neutral-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="example@hosokai.or.jp"
                  className="block w-full pl-10 pr-3 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 sm:text-sm outline-none"
                />
              </div>
              {mode === 'login' && <p className="text-xs text-neutral-500 mt-2">※既存登録がある方は、メールアドレスのみで本人確認（認証メール送信）を行います。</p>}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex flex-col items-start text-sm mt-4">
                <div className="flex items-center mb-2 font-medium">
                  <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
                  <span>エラーが発生しました</span>
                </div>
                <p className="leading-relaxed">{error}</p>
                
                {isAuthNotAllowed && (
                  <div className="mt-4 w-full space-y-2">
                    <button
                      type="button"
                      onClick={handleMailto}
                      className="w-full flex items-center justify-center bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      メールソフトを起動して申請情報を送る
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleMockLogin}
                      className="w-full flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                    >
                      開発用: 上記情報を保存して強制ログイン
                    </button>
                  </div>
                )}
              </div>
            )}

            {!isAuthNotAllowed && (
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-6"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  mode === 'register' ? '登録して認証メールを送信' : '認証メールを送信してログイン'
                )}
              </button>
            )}

            <div className="relative mt-8 mb-4 border-t border-neutral-200">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 text-xs text-neutral-400">または</span>
            </div>

            <button 
              type="button"
              onClick={handleGoogleLogin} 
              className="w-full flex items-center justify-center bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Googleアカウントでログイン
            </button>

          </form>

        </div>
      </div>
      
      <p className="mt-8 text-xs text-neutral-400">© {new Date().getFullYear()} 法曹会 All Rights Reserved.</p>
    </div>
  );
}
