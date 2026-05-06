import React, { useState, useEffect, useRef } from 'react';
import { auth, db, handleFirestoreError } from './firebase';
import { collection, getDocs, doc, updateDoc, query, orderBy, writeBatch, serverTimestamp } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { AlertCircle, CheckCircle2, ChevronRight, FileText, Search, LogIn, LogOut, UploadCloud } from 'lucide-react';

export default function Admin() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchSubmissions();
      } else {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      alert('ログインに失敗しました');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    const path = 'submissions';
    try {
      const q = query(collection(db, path), orderBy('createdAt', 'desc'));
      const qs = await getDocs(q);
      const data = qs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSubmissions(data);
    } catch (err) {
      handleFirestoreError(err, 'get' as any, path);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const text = await file.text();
      const jsonData = JSON.parse(text);

      if (!Array.isArray(jsonData)) {
        alert('JSONは配列形式である必要があります。');
        return;
      }

      const path = 'submissions';
      // Batch write setup
      let batch = writeBatch(db);
      let count = 0;
      let totalImported = 0;

      for (const item of jsonData) {
        // Validation check for past data import mapping
        // We will store it with a special flag e.g., isImportedPastData: true
        const newDocRef = doc(collection(db, path));
        
        batch.set(newDocRef, {
          ...item,
          isImportedPastData: true,
          createdAt: serverTimestamp(),
          // Default required fields for validations if missing
          department: item.department || '未設定',
          lastName: item.lastName || '',
          firstName: item.firstName || '',
          lastNameKana: item.lastNameKana || '',
          firstNameKana: item.firstNameKana || '',
          jobTitle: item.jobTitle || '',
          careerType: item.careerType || '過去データ',
          photoType: item.photoType || '過去データ',
          agreeTerms: item.agreeTerms !== undefined ? item.agreeTerms : true,
          userId: item.userId || 'admin_import', // Default fallback
        });

        count++;
        totalImported++;

        // Firestore batch limits to 500 operations
        if (count >= 490) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      
      if (count > 0) {
        await batch.commit();
      }

      alert(`${totalImported}件の過去データをインポートしました。`);
      fetchSubmissions();
      
    } catch (err) {
      console.error(err);
      alert('インポートに失敗しました。JSONの形式が正しいか確認してください。');
      // If it throws firestore error, try caching it but manual err might suffice here
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleGarbledStatus = async (id: string, currentStatus: boolean) => {
    const path = `submissions/${id}`;
    try {
      await updateDoc(doc(db, 'submissions', id), {
        needsGarbledTextCheck: !currentStatus
      });
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, needsGarbledTextCheck: !currentStatus } : s));
    } catch (err) {
      handleFirestoreError(err, 'update' as any, path);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-6 font-sans">
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-neutral-200 text-center max-w-sm w-full">
          <FileText className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-6 text-neutral-800">管理画面</h2>
          <button onClick={login} className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm">
            <LogIn className="w-5 h-5 mr-2" />
            Googleでログイン
          </button>
        </div>
      </div>
    );
  }

  const renderStats = () => {
    const total = submissions.length;
    const importedCount = submissions.filter(s => s.isImportedPastData).length;
    const newCount = total - importedCount;
    const needsCheckCount = submissions.filter(s => s.needsGarbledTextCheck).length;

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200">
          <p className="text-sm text-neutral-500 font-medium mb-1">総原稿数</p>
          <div className="text-3xl font-bold text-neutral-800">{total} <span className="text-sm font-normal text-neutral-500 ml-1">件</span></div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200">
          <p className="text-sm text-neutral-500 font-medium mb-1">新規登録・更新</p>
          <div className="text-3xl font-bold text-blue-600">{newCount} <span className="text-sm font-normal text-neutral-500 ml-1">件</span></div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200">
          <p className="text-sm text-neutral-500 font-medium mb-1">過去データ (インポート)</p>
          <div className="text-3xl font-bold text-neutral-600">{importedCount} <span className="text-sm font-normal text-neutral-500 ml-1">件</span></div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200">
          <p className="text-sm text-neutral-500 font-medium mb-1">要確認 (外字疑いなど)</p>
          <div className="text-3xl font-bold text-amber-500">{needsCheckCount} <span className="text-sm font-normal text-neutral-500 ml-1">件</span></div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-100 p-6 font-sans">

      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
          <h1 className="text-2xl font-bold flex items-center text-neutral-800">
            <FileText className="w-6 h-6 mr-3 text-blue-600" />
            原稿管理システム
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center text-sm text-neutral-600 bg-neutral-50 px-3 py-1.5 rounded-full border border-neutral-200">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
              {user.email}
              <button onClick={handleLogout} className="ml-3 flex items-center text-red-500 hover:text-red-700 transition-colors">
                <LogOut className="w-3 h-3 mr-1" />
                ログアウト
              </button>
            </div>
            
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isImporting}
              className="text-sm flex items-center bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg font-medium transition-colors border border-blue-200 disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4 mr-2" />
              {isImporting ? 'インポート中...' : '過去データ入力 (JSON)'}
            </button>
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImport} 
            />

            <button onClick={fetchSubmissions} className="text-sm bg-neutral-100 hover:bg-neutral-200 px-4 py-2 rounded-lg font-medium transition-colors text-neutral-700 border border-neutral-200">
              更新
            </button>
          </div>
        </header>

        {!loading && renderStats()}

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* List View */}
            <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col h-[calc(100vh-140px)]">
              <div className="p-4 border-b border-neutral-100 bg-neutral-50 flex items-center">
                <Search className="w-4 h-4 text-neutral-400 mr-2" />
                <input 
                  type="text" 
                  placeholder="氏名や官職で検索..." 
                  className="bg-transparent border-none outline-none text-sm w-full font-medium"
                />
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-1">
                {submissions.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setPreviewId(sub.id)}
                    className={`w-full text-left p-4 rounded-lg transition-colors flex items-start justify-between group ${previewId === sub.id ? 'bg-blue-50 border-blue-200 border text-blue-900' : 'hover:bg-neutral-50 text-neutral-700 border-transparent border'}`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold">{sub.lastName} {sub.firstName}</span>
                        {sub.needsGarbledTextCheck && (
                          <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">要確認</span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500 line-clamp-1">{sub.department} / {sub.jobTitle}</div>
                    </div>
                    <ChevronRight className={`w-4 h-4 mt-2 ${previewId === sub.id ? 'text-blue-500' : 'text-neutral-300 group-hover:text-neutral-400'}`} />
                  </button>
                ))}
                {submissions.length === 0 && (
                  <div className="p-8 text-center text-neutral-500 text-sm">
                    データがありません
                  </div>
                )}
              </div>
            </div>

            {/* Preview View */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden h-[calc(100vh-140px)] flex flex-col">
              {previewId ? (
                (() => {
                  const sub = submissions.find(s => s.id === previewId);
                  if (!sub) return null;
                  return (
                    <div className="flex flex-col h-full">
                      <div className="p-6 border-b border-neutral-100 flex justify-between items-start bg-neutral-50/50">
                        <div>
                          <h2 className="text-xl font-bold text-neutral-800">{sub.lastName} {sub.firstName} <span className="text-sm font-normal text-neutral-500 bg-neutral-200/50 px-2 mt-1 py-0.5 rounded ml-2">{sub.lastNameKana} {sub.firstNameKana}</span></h2>
                          <div className="mt-2 text-sm text-neutral-600 space-x-4">
                            <span>{sub.department}</span>
                            <span>{sub.jobTitle}</span>
                            <span>{sub.birthEra}{sub.birthYear}年{sub.birthMonth}月{sub.birthDay}日生</span>
                            {sub.birthPlace && <span>{sub.birthPlace}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleGarbledStatus(sub.id, !!sub.needsGarbledTextCheck)}
                          className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${sub.needsGarbledTextCheck ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'}`}
                        >
                          <AlertCircle className="w-4 h-4 mr-2" />
                          {sub.needsGarbledTextCheck ? '文字化け確認を解除' : '文字化けフラグを立てる'}
                        </button>
                      </div>
                      
                      <div className="flex-1 overflow-auto p-4 md:p-8 bg-neutral-100/50 flex flex-col md:flex-row items-center justify-center">
                        
                        {/* Book mock-up: Represents a single card in Taikan */}
                        <div className="bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-neutral-300 w-full max-w-[640px] md:h-[500px] font-serif p-10 relative overflow-hidden flex transform sm:scale-110 origin-center text-black">
                           {/* Right Area (Title, Name, Birth) in Vertical Text */}
                           <div className="flex flex-row-reverse w-1/2 h-full" style={{ writingMode: 'vertical-rl' }}>
                              <div className="text-lg tracking-[0.2em] leading-relaxed ml-6 mt-4">
                                {sub.jobTitle}
                              </div>
                              <div className="flex flex-col ml-8 items-center mt-12">
                                 <div className="text-3xl font-bold tracking-[0.6em] whitespace-nowrap">
                                    {sub.lastName}　{sub.firstName}
                                 </div>
                                 <div className="text-xs mt-6 tracking-widest text-neutral-800 pt-8">
                                    {sub.birthEra}{sub.birthYear}{sub.birthYear ? '年' : ''}{sub.birthMonth}{sub.birthMonth ? '月' : ''}{sub.birthDay}{sub.birthDay ? '日生' : ''}
                                 </div>
                              </div>
                           </div>

                           {/* Left Area (Photo, Career) */}
                           <div className="w-1/2 h-full relative border-l border-neutral-200/50 pl-6">
                              {/* Photo Box */}
                              <div className="w-[110px] h-[150px] border border-neutral-400 bg-neutral-100 mb-6 absolute top-0 left-6 flex items-center justify-center overflow-hidden">
                                 <span className="text-neutral-400 text-xs text-center leading-relaxed font-sans font-medium">
                                   【写真】<br/>
                                   {sub.photoType === '新規提出' ? sub.photoFileName : `${sub.oldPhotoDepartment}\n${sub.oldPhotoPage}頁 流用`}
                                 </span>
                              </div>

                              {/* Career Text in Vertical */}
                              <div className="absolute top-[170px] left-6 bottom-0 right-0 overflow-hidden" style={{ writingMode: 'vertical-rl' }}>
                                 <div className="text-xs leading-[2.5] tracking-widest text-neutral-800 h-full w-full">
                                    {sub.careerType === '新規入力' ? sub.careerNew?.map((c: any, i: number) => (
                                      <div key={i} className="mb-2">
                                        <span className="mr-3 inline-block min-w-[6em]">{c.date}</span>
                                        <span>{c.content}</span>
                                      </div>
                                    )) : (
                                      <div className="text-neutral-500 font-sans text-[11px] leading-relaxed w-full">
                                         <p className="border border-neutral-300 p-2 mb-4 bg-neutral-50">
                                          【令和3年版 流用指定】<br/>
                                          {sub.oldCareerDepartment} {sub.oldCareerPage}頁<br/>
                                         </p>
                                         <div style={{ writingMode: 'vertical-rl' }} className="font-serif text-black mt-2">
                                          {sub.careerAdd?.map((c: any, i: number) => (
                                            <div key={i} className="mb-2">
                                              <span className="mr-3 inline-block min-w-[6em]">{c.date}</span>
                                              <span>{c.content}</span>
                                            </div>
                                          ))}
                                         </div>
                                      </div>
                                    )}
                                 </div>
                              </div>
                           </div>
                        </div>

                      </div>

                      <div className="border-t border-neutral-100 bg-neutral-50 p-4 text-xs text-neutral-500 flex justify-between">
                        <span>【写真】 {sub.photoType} {sub.photoType === '新規提出' ? `(${sub.photoFileName})` : `(${sub.oldPhotoDepartment} ${sub.oldPhotoPage}頁)`}</span>
                        <span>提出日時: {sub.createdAt?.toDate ? sub.createdAt.toDate().toLocaleString('ja-JP') : new Date().toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-neutral-400">
                  <FileText className="w-16 h-16 mb-4 text-neutral-200" />
                  <p>左のリストから原稿を選択すると、ここにプレビューが表示されます。</p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
