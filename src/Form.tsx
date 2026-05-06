import React, { useState, useEffect } from 'react';
import { Camera, ChevronRight, FileText, Info, AlertCircle, UploadCloud, CheckCircle2, Trash2, Sparkles, Search, LogIn, LogOut } from 'lucide-react';
import { auth, db, handleFirestoreError } from './firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { predictKana } from './lib/gemini';
import AuthScreen from './AuthScreen';

const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県", "その他"
];

const YEARS = Array.from({ length: 64 }, (_, i) => i + 1);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

type CareerEntry = {
  id: string;
  date: string;
  content: string;
};

export default function Form() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [formData, setFormData] = useState({
    department: '',
    email: '',
    lastName: '',
    firstName: '',
    lastNameKana: '',
    firstNameKana: '',
    jobTitle: '',
    mergedLastName: '',
    birthEra: '昭和',
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    birthPlace: '',
    careerType: '',
    careerNew: [{ id: Date.now().toString() + '1', date: '', content: '' }],
    oldCareerDepartment: '',
    oldCareerPage: '',
    careerAdd: [{ id: Date.now().toString() + '2', date: '', content: '' }],
    photoType: '',
    photoFile: null as File | null,
    oldPhotoDepartment: '',
    oldPhotoPage: '',
    trainingTerm: '',
    agreeTerms: false,
    needsGarbledTextCheck: false
  });

  const [isFetchingPastData, setIsFetchingPastData] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
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

  useEffect(() => {
    if (formData.careerType === '令和３年版の経歴を流用・追加' && formData.photoType === '令和３年版の写真を流用') {
      setFormData(prev => ({
        ...prev,
        oldPhotoDepartment: prev.oldCareerDepartment,
        oldPhotoPage: prev.oldCareerPage
      }));
    }
  }, [formData.careerType, formData.photoType, formData.oldCareerDepartment, formData.oldCareerPage]);

  const handleFetchPastData = async () => {
    if (!formData.lastName || !formData.firstName) {
      alert("氏名（姓・名）を両方入力してください。");
      return;
    }
    setIsFetchingPastData(true);
    try {
      // First try to fetch user's own submissions
      let q = query(
        collection(db, 'submissions'),
        where('userId', '==', user?.uid),
        where('lastName', '==', formData.lastName),
        where('firstName', '==', formData.firstName),
        limit(1)
      );
      let querySnapshot = await getDocs(q);
      
      // If not found, try to fetch from imported past data
      if (querySnapshot.empty) {
        q = query(
          collection(db, 'submissions'),
          where('isImportedPastData', '==', true),
          where('lastName', '==', formData.lastName),
          where('firstName', '==', formData.firstName),
          limit(1)
        );
        querySnapshot = await getDocs(q);
      }

      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        const gaijiRegex = /[^\u0000-\u007F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
        const needsGarbledTextCheck = gaijiRegex.test(data.lastName || "") || gaijiRegex.test(data.firstName || "");
        
        setFormData(prev => ({
          ...prev,
          department: data.department || prev.department,
          lastNameKana: data.lastNameKana || prev.lastNameKana,
          firstNameKana: data.firstNameKana || prev.firstNameKana,
          jobTitle: data.jobTitle || prev.jobTitle,
          mergedLastName: data.mergedLastName || prev.mergedLastName,
          birthEra: data.birthEra || prev.birthEra,
          birthYear: data.birthYear || prev.birthYear,
          birthMonth: data.birthMonth || prev.birthMonth,
          birthDay: data.birthDay || prev.birthDay,
          birthPlace: data.birthPlace || prev.birthPlace,
          careerType: data.careerType || prev.careerType,
          careerNew: data.careerNew && data.careerNew.length > 0 ? data.careerNew : prev.careerNew,
          oldCareerDepartment: data.oldCareerDepartment || prev.oldCareerDepartment,
          oldCareerPage: data.oldCareerPage || prev.oldCareerPage,
          careerAdd: data.careerAdd && data.careerAdd.length > 0 ? data.careerAdd : prev.careerAdd,
          photoType: data.photoType || prev.photoType,
          oldPhotoDepartment: data.oldPhotoDepartment || prev.oldPhotoDepartment,
          oldPhotoPage: data.oldPhotoPage || prev.oldPhotoPage,
          trainingTerm: data.trainingTerm || prev.trainingTerm,
          needsGarbledTextCheck: needsGarbledTextCheck
        }));
        alert("前回の情報を読み込みました。内容をご確認ください。");
        setErrors({});
      } else {
        alert("一致する前回データは見つかりませんでした。");
      }
    } catch (error) {
      console.error("データの取得に失敗", error);
      alert("データの検索中にエラーが発生しました。");
    } finally {
      setIsFetchingPastData(false);
    }
  };

  const handleNameBlur = async (field: 'lastName' | 'firstName') => {
    const kanji = formData[field];
    const kanaField = field === 'lastName' ? 'lastNameKana' : 'firstNameKana';
    
    if (kanji && !formData[kanaField]) {
      const kana = await predictKana(kanji);
      if (kana) {
        setFormData(prev => ({ ...prev, [kanaField]: kana }));
        setErrors(prev => { const e = {...prev}; delete e[kanaField]; return e; });
      }
    }
  };

  const handleCareerChange = (type: 'careerNew' | 'careerAdd', index: number, field: keyof CareerEntry, value: string) => {
    setFormData(prev => {
      const newList = [...(prev[type] as unknown as CareerEntry[])];
      newList[index] = { ...newList[index], [field]: value };
      
      if (index === newList.length - 1 && (field === 'date' || field === 'content') && value !== '') {
        newList.push({ id: Date.now().toString() + Math.random(), date: '', content: '' });
      }
      return { ...prev, [type]: newList };
    });
    if (errors[type]) {
      setErrors(prev => { const newErrors = { ...prev }; delete newErrors[type]; return newErrors; });
    }
  };

  const removeCareerRow = (type: 'careerNew' | 'careerAdd', index: number) => {
    setFormData(prev => {
      const newList = [...(prev[type] as unknown as CareerEntry[])];
      if (newList.length === 1) {
        newList[0] = { ...newList[0], date: '', content: '' };
      } else {
        newList.splice(index, 1);
      }
      return { ...prev, [type]: newList };
    });
  };

  const handlePaste = (e: React.ClipboardEvent, index: number, type: 'careerNew' | 'careerAdd') => {
    const pasteData = e.clipboardData.getData('text');
    if (pasteData.includes('\n')) {
      e.preventDefault();
      const lines = pasteData.split(/\r?\n/).map(l => l.trim()).filter(l => l);
      
      const newRows = lines.map((line, i) => {
        const match = line.match(/^((?:昭和|平成|令和)?(?:元|[0-9０-９]{1,2})年[0-9０-９]{1,2}月(?:末日)?)\s*(.*)$/);
        if (match) {
          return { id: Date.now().toString() + '-' + i, date: match[1], content: match[2].trim() };
        }
        return { id: Date.now().toString() + '-' + i, date: '', content: line };
      });

      setFormData(prev => {
        const targetArray = [...(prev[type] as unknown as CareerEntry[])];
        targetArray.splice(index, 1, ...newRows); 
        return { ...prev, [type]: targetArray };
      });
      
      if (errors[type]) {
        setErrors(prev => { const newErrors = { ...prev }; delete newErrors[type]; return newErrors; });
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 3 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, photoFile: 'ファイルサイズは3MB以下にしてください。' }));
        return;
      }
      setFormData(prev => ({ ...prev, photoFile: file }));
      if (errors.photoFile) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.photoFile;
          return newErrors;
        });
      }
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.department) newErrors.department = '掲載する部をご選択ください';
    if (!formData.email) newErrors.email = '控えを受け取るメールアドレスを入力してください';
    else if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(formData.email)) newErrors.email = '有効なメールアドレスを入力してください';
    if (!formData.lastName) newErrors.lastName = '入力必須です';
    if (!formData.firstName) newErrors.firstName = '入力必須です';
    if (!formData.lastNameKana) newErrors.lastNameKana = '入力必須です';
    if (!formData.firstNameKana) newErrors.firstNameKana = '入力必須です';
    if (!formData.jobTitle) newErrors.jobTitle = '入力必須です';
    
    if (!formData.careerType) newErrors.careerType = '選択必須です';
    if (formData.careerType === '新規入力') {
      const hasContent = (formData.careerNew as CareerEntry[]).some(c => c.content.trim() !== '' || c.date.trim() !== '');
      if (!hasContent) newErrors.careerNew = '経歴を1つ以上入力してください。';
    }

    if (!formData.photoType) newErrors.photoType = '選択必須です';
    if (formData.photoType === '新規提出' && !formData.photoFile) {
      newErrors.photoFile = '写真ファイルをアップロードしてください';
    }

    if (!formData.agreeTerms) newErrors.agreeTerms = '利用規約と個人情報保護方針への同意が必要です';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setIsSubmitting(true);
      try {
        const payload = {
          userId: user?.uid || "",
          userEmail: user?.email || "",
          department: formData.department,
          email: formData.email,
          lastName: formData.lastName,
          firstName: formData.firstName,
          lastNameKana: formData.lastNameKana,
          firstNameKana: formData.firstNameKana,
          jobTitle: formData.jobTitle,
          mergedLastName: formData.mergedLastName || "",
          birthEra: formData.birthEra || "",
          birthYear: formData.birthYear || "",
          birthMonth: formData.birthMonth || "",
          birthDay: formData.birthDay || "",
          birthPlace: formData.birthPlace || "",
          careerType: formData.careerType,
          careerNew: formData.careerNew.filter(c => c.content || c.date),
          oldCareerDepartment: formData.oldCareerDepartment || "",
          oldCareerPage: formData.oldCareerPage || "",
          careerAdd: formData.careerAdd.filter(c => c.content || c.date),
          photoType: formData.photoType,
          oldPhotoDepartment: formData.oldPhotoDepartment || "",
          oldPhotoPage: formData.oldPhotoPage || "",
          trainingTerm: formData.trainingTerm || "",
          agreeTerms: formData.agreeTerms,
          photoFileName: formData.photoFile?.name || "",
          createdAt: serverTimestamp(),
          needsGarbledTextCheck: formData.needsGarbledTextCheck
        };

        await addDoc(collection(db, 'submissions'), payload);
        
        // Email sending logic via Gmail API endpoint
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: `${formData.email}, taikan@hosokai.or.jp`,
              subject: `【司法大観】${formData.lastName}${formData.firstName}様 原稿送信控え`,
              html: `<p>${formData.lastName}${formData.firstName}様</p>
                     <p>以下の内容で原稿を受領いたしました。</p>
                     <p>■ 掲載情報: ${formData.department}</p>
                     <p>■ 官職名: ${formData.jobTitle}</p>
                     ${formData.needsGarbledTextCheck ? '<p><strong>※外字が含まれている可能性があるため、事務局にて確認いたします。</strong></p>' : ''}
                     <p>このメールはシステムからの自動送信です。</p>`
            })
          });
        } catch (err) {
          console.error('Failed to send email notification', err);
        }

        setIsSubmitted(true);
        window.scrollTo(0, 0);
      } catch (err) {
        console.error(err);
        alert('送信に失敗しました。');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const firstErrorElement = document.querySelector('.error-text');
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6 font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6 font-sans">
        <div className="bg-white rounded-xl shadow-md p-10 max-w-2xl w-full border-t-8 border-blue-600">
          <h2 className="text-2xl font-bold mb-6 flex items-center text-neutral-800">
            <CheckCircle2 className="w-8 h-8 text-green-500 mr-2" />
            原稿のご提出ありがとうございました
          </h2>
          <div className="bg-neutral-50 p-6 rounded-lg text-sm text-neutral-700 leading-relaxed space-y-4 border border-neutral-200">
             <p className="font-medium text-lg">{formData.lastName} {formData.firstName} 様</p>
             <p>以下の内容で原稿を受領いたしました。<br/>このメールは、システムより自動で送信しております（レスポンダー）。</p>
             <hr className="border-neutral-200" />
             <p>■ 掲載情報: {formData.department}<br/>
                ■ 官職名: {formData.jobTitle}</p>
             <p>ご提出いただいたデータは、法曹会編集課にて確認いたします。<br/>文字化け等の修正内容の確認やレイアウトの調整が必要な場合は、担当よりご連絡させていただく場合がございます。</p>
             {formData.needsGarbledTextCheck && (
               <div className="bg-amber-50 p-3 rounded border border-amber-200 text-amber-800 text-xs">
                 <strong className="block mb-1">【外字・旧字体に関するお知らせ】</strong>
                 AI判定により、お名前に外字や環境依存文字が含まれる可能性があると検知いたしました。
                 編集部にて正確な文字（正しい字体）を手動確認し、補完処理を行って印刷手配いたします。
               </div>
             )}
             <hr className="border-neutral-200" />
             <p className="text-xs text-neutral-500">法曹会 編集課<br/>Email: taikan@hosokai.or.jp<br/>TEL: 03-3581-3953</p>
          </div>
          <div className="mt-8 text-center">
            <button 
              onClick={() => window.location.reload()}
              className="bg-neutral-900 text-white px-8 py-3 rounded-full font-medium hover:bg-neutral-800 transition-colors shadow-sm"
            >
              続けて新しく入力する
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="flex justify-end pt-4">
          <div className="flex items-center text-sm text-neutral-600 bg-white px-4 py-2 rounded-full border border-neutral-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
            {user.email} でログイン中
            <button onClick={handleLogout} className="ml-4 flex items-center text-red-500 hover:text-red-700 transition-colors">
              <LogOut className="w-4 h-4 mr-1" />
              ログアウト
            </button>
          </div>
        </div>

        <div className="text-center space-y-2 mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">司法大観 AI オンライン入稿システム</h1>
          <p className="text-neutral-500">法曹会 掲載情報等のご登録をお願いいたします。</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden mb-8">
            <div className="border-b border-neutral-100 bg-neutral-50/50 px-8 py-5">
              <h2 className="text-lg font-semibold text-neutral-800">
                0. ご連絡先
              </h2>
            </div>
            <div className="p-8">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-900">
                  控えを受け取るメールアドレス <span className="text-red-500 ml-1">必須</span>
                </label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="example@hosokai.or.jp"
                  className={`block w-full max-w-md rounded-lg border px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none ${errors.email ? 'border-red-300 bg-red-50' : 'border-neutral-300'}`} />
                {errors.email && <p className="error-text text-sm text-red-500 mt-1 flex items-center"><AlertCircle className="w-4 h-4 mr-1"/>{errors.email}</p>}
              </div>
            </div>
          </div>

          {/* 過去データの検索 */}
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden mb-8">
            <div className="border-b border-neutral-100 bg-blue-50/50 px-8 py-5 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-blue-900 flex items-center">
                <Search className="w-5 h-5 mr-2 text-blue-600" />
                前回のデータを参照
              </h2>
            </div>
            <div className="p-8">
              <p className="text-sm text-neutral-600 mb-4">
                過去の掲載実績がある方は、お名前を入力して「前回のデータを参照する」ボタンを押すと、過去の登録内容を自動入力します。
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">姓 (例: 法曹)</label>
                  <input type="text" value={formData.lastName} onChange={e => setFormData(prev => ({...prev, lastName: e.target.value}))} onBlur={() => handleNameBlur('lastName')} className="block w-full sm:w-48 rounded-lg border border-neutral-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">名 (例: 太郎)</label>
                  <input type="text" value={formData.firstName} onChange={e => setFormData(prev => ({...prev, firstName: e.target.value}))} onBlur={() => handleNameBlur('firstName')} className="block w-full sm:w-48 rounded-lg border border-neutral-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <button 
                  type="button" 
                  onClick={handleFetchPastData}
                  disabled={isFetchingPastData || !formData.lastName || !formData.firstName}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm h-[42px] flex items-center justify-center min-w-[200px]"
                >
                  {isFetchingPastData ? '検索中...' : '前回のデータを参照する'}
                </button>
              </div>
            </div>
          </div>

          {/* 1. 掲載情報等 */}
          <section className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="border-b border-neutral-100 bg-neutral-50/50 px-8 py-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-800 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                1. 掲載情報等
              </h2>
              {formData.needsGarbledTextCheck && (
                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded inline-flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" /> 外字・旧字補完モード作動中
                </span>
              )}
            </div>
            <div className="p-8 space-y-8">
              <div className="space-y-4 pt-2">
                <p className="text-sm text-neutral-600 block">控えを受け取るメールアドレス <span className="text-red-500 ml-1">必須</span></p>
                <div className="max-w-md">
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="example@hosokai.or.jp"
                    className={`block w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none ${errors.email ? 'border-red-300 bg-red-50' : 'border-neutral-300'}`} />
                  {errors.email && <p className="error-text text-sm text-red-500 mt-1 flex items-center"><AlertCircle className="w-4 h-4 mr-1"/>{errors.email}</p>}
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-8 space-y-2">
                <label className="block text-sm font-medium text-neutral-900">
                  掲載する部をご選択ください <span className="text-red-500 ml-1">必須</span>
                </label>
                <select 
                  name="department" 
                  value={formData.department} 
                  onChange={handleChange}
                  className={`block w-full max-w-sm rounded-lg border px-4 py-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-shadow ${errors.department ? 'border-red-300 bg-red-50' : 'border-neutral-300'}`}
                >
                  <option value="">選択してください</option>
                  <option value="裁判所の部">裁判所の部</option>
                  <option value="法務省の部">法務省の部</option>
                </select>
                {errors.department && <p className="error-text text-sm text-red-500 mt-1 flex items-center"><AlertCircle className="w-4 h-4 mr-1"/>{errors.department}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 姓名 漢字 */}
                <div className="space-y-4">
                  <span className="block text-sm font-medium text-neutral-900">姓名（漢字） <span className="text-red-500 ml-1">必須</span></span>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">姓 (例: 渡邊)</label>
                      <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} onBlur={() => handleNameBlur('lastName')} placeholder="法曹"
                        className={`block w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none ${errors.lastName ? 'border-red-300 bg-red-50' : 'border-neutral-300'}`} />
                      {errors.lastName && <p className="error-text text-xs text-red-500 mt-1">{errors.lastName}</p>}
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">名 (例: 太郎)</label>
                      <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} onBlur={() => handleNameBlur('firstName')} placeholder="太郎"
                        className={`block w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none ${errors.firstName ? 'border-red-300 bg-red-50' : 'border-neutral-300'}`} />
                      {errors.firstName && <p className="error-text text-xs text-red-500 mt-1">{errors.firstName}</p>}
                    </div>
                  </div>
                </div>

                {/* 姓名 ふりがな */}
                <div className="space-y-4 relative">
                  <span className="block text-sm font-medium text-neutral-900">ふりがな（ひらがな） <span className="text-red-500 ml-1">必須</span></span>
                  <span className="absolute top-0 right-0 text-[10px] text-blue-500 bg-blue-50 px-2 pl-1 rounded-bl-lg">✨ AI予測入力対応</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">せい (例: わたなべ)</label>
                      <input type="text" name="lastNameKana" value={formData.lastNameKana} onChange={handleChange} placeholder="ほうそう"
                        className={`block w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none ${errors.lastNameKana ? 'border-red-300 bg-red-50' : 'border-neutral-300'}`} />
                      {errors.lastNameKana && <p className="error-text text-xs text-red-500 mt-1">{errors.lastNameKana}</p>}
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">めい (例: たろう)</label>
                      <input type="text" name="firstNameKana" value={formData.firstNameKana} onChange={handleChange} placeholder="たろう"
                        className={`block w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none ${errors.firstNameKana ? 'border-red-300 bg-red-50' : 'border-neutral-300'}`} />
                      {errors.firstNameKana && <p className="error-text text-xs text-red-500 mt-1">{errors.firstNameKana}</p>}
                    </div>
                  </div>
                </div>
              </div>

              {/* 外字についてのお願い */}
              <div className="bg-neutral-50 rounded-lg p-5 text-sm text-neutral-600 border border-neutral-200">
                <div className="font-semibold text-neutral-800 mb-2 flex items-center">
                  <Info className="w-4 h-4 mr-1.5 text-blue-500" />
                  姓名の外字使用についてのお願い
                </div>
                <p className="mb-2 text-xs leading-relaxed">一部の特殊な外字（環境依存文字）は、ブラウザでの入力ができない場合がありますが、AIアシストが文脈から補完を試みます。<br/>以下の場合は、本フォーム送信後、法曹会編集課(taikan@hosokai.or.jpまたは03-3581-3953)までご連絡をいただけますようお願いいたします。</p>
                <ol className="list-decimal pl-5 space-y-1 text-xs">
                  <li>常用漢字を入力できない外字に変更を希望される場合（送信プレビューに表示されない特殊字等）</li>
                  <li>原稿入力フォーム送信後に届く控えメールで、姓名の漢字に文字化け・フォントの崩れなどがあった場合</li>
                </ol>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-900">
                    官職名（令和８年６月１日現在） <span className="text-red-500 ml-1">必須</span>
                  </label>
                  <label className="block text-xs text-neutral-500">例: 最高検検事</label>
                  <input type="text" name="jobTitle" value={formData.jobTitle} onChange={handleChange} placeholder="最高検検事"
                    className={`block w-full rounded-lg border px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none ${errors.jobTitle ? 'border-red-300 bg-red-50' : 'border-neutral-300'}`} />
                  {errors.jobTitle && <p className="error-text text-sm text-red-500 mt-1">{errors.jobTitle}</p>}
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-neutral-900">併記する姓 <span className="text-neutral-400 ml-1 text-xs">任意</span></label>
                  <label className="block text-xs text-neutral-500">例: 司法</label>
                  <input type="text" name="mergedLastName" value={formData.mergedLastName} onChange={handleChange} placeholder="司法"
                    className="block w-full rounded-lg border border-neutral-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-900">生年月日 <span className="text-neutral-400 ml-1 text-xs">任意</span></label>
                <div className="flex flex-wrap gap-3 items-center">
                  <select name="birthEra" value={formData.birthEra} onChange={handleChange} className="rounded-lg border border-neutral-300 px-4 py-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">元号</option>
                    <option value="昭和">昭和</option>
                    <option value="平成">平成</option>
                  </select>
                  
                  <div className="flex items-center gap-1">
                    <select name="birthYear" value={formData.birthYear} onChange={handleChange} className="rounded-lg border border-neutral-300 px-4 py-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none w-20">
                      <option value="">--</option>
                      {YEARS.map(y => <option key={y} value={y}>{y === 1 ? '元' : y}</option>)}
                    </select>
                    <span className="text-neutral-600">年</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <select name="birthMonth" value={formData.birthMonth} onChange={handleChange} className="rounded-lg border border-neutral-300 px-4 py-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none w-20">
                      <option value="">--</option>
                      {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <span className="text-neutral-600">月</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <select name="birthDay" value={formData.birthDay} onChange={handleChange} className="rounded-lg border border-neutral-300 px-4 py-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none w-20">
                      <option value="">--</option>
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <span className="text-neutral-600">日</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 tracking-wide">
                <label className="block text-sm font-medium text-neutral-900">出身地 <span className="text-neutral-400 ml-1 text-xs">任意</span></label>
                <select name="birthPlace" value={formData.birthPlace} onChange={handleChange} className="block w-full max-w-sm rounded-lg border border-neutral-300 px-4 py-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">選択してください</option>
                  {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

            </div>
          </section>

          {/* 2. 経歴について */}
          <section className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="border-b border-neutral-100 bg-neutral-50/50 px-8 py-5 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-neutral-800 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                2. 経歴について
              </h2>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-neutral-900">
                  経歴の入力方法をご選択ください <span className="text-red-500 ml-1">必須</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <label className={`relative flex items-center p-4 border rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors ${formData.careerType === '新規入力' ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' : 'border-neutral-200'} ${errors.careerType ? 'border-red-300 bg-red-50' : ''}`}>
                    <input type="radio" name="careerType" value="新規入力" checked={formData.careerType === '新規入力'} onChange={handleChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300" />
                    <span className="ml-3 font-medium text-neutral-900">新規入力</span>
                  </label>
                  <label className={`relative flex items-center p-4 border rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors ${formData.careerType === '令和３年版の経歴を流用・追加' ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' : 'border-neutral-200'} ${errors.careerType ? 'border-red-300 bg-red-50' : ''}`}>
                    <input type="radio" name="careerType" value="令和３年版の経歴を流用・追加" checked={formData.careerType === '令和３年版の経歴を流用・追加'} onChange={handleChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300" />
                    <span className="ml-3 font-medium text-neutral-900">令和３年版の経歴を流用・追加</span>
                  </label>
                </div>
                {errors.careerType && <p className="error-text text-sm text-red-500 mt-1">{errors.careerType}</p>}
              </div>

              {/* 新規入力エリア */}
              {formData.careerType === '新規入力' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300 bg-blue-50/30 p-6 rounded-xl border border-blue-100">
                  <div className="flex flex-col gap-8">
                    <div className="flex-1 space-y-2">
                       <label className="block text-sm font-medium text-neutral-900 flex justify-between items-end">
                        <span>経歴（新規入力） <span className="text-red-500 ml-1">必須</span></span>
                      </label>
                      <div className={`space-y-3 p-4 rounded-xl border ${errors.careerNew ? 'border-red-300 bg-red-50' : 'border-neutral-200 bg-white'}`}>
                        <p className="text-[11px] text-blue-600 mb-2 font-medium bg-blue-50 px-2 py-1 rounded">💡 各行の入力欄にコピーした文章を直接貼り付けると、自動で日付と内容に分割されます！</p>
                        <div className="hidden sm:grid grid-cols-[140px_1fr_40px] gap-3 px-2 text-xs font-medium text-neutral-500">
                          <div>年月</div>
                          <div>経歴事項</div>
                          <div></div>
                        </div>
                        {(formData.careerNew as unknown as CareerEntry[]).map((entry, index) => (
                          <div key={entry.id} className="grid grid-cols-[1fr_40px] sm:grid-cols-[140px_1fr_40px] gap-2 sm:gap-3 items-start sm:items-center relative group pb-3 sm:pb-0 border-b sm:border-b-0 border-neutral-100 last:border-0">
                            <input
                              type="text"
                              value={entry.date}
                              placeholder="例: 平成元年11月"
                              onPaste={(e) => handlePaste(e, index, 'careerNew')}
                              onChange={(e) => handleCareerChange('careerNew', index, 'date', e.target.value)}
                              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-shadow"
                            />
                            <input
                              type="text"
                              value={entry.content}
                              placeholder="例: 司法試験終了"
                              onPaste={(e) => handlePaste(e, index, 'careerNew')}
                              onChange={(e) => handleCareerChange('careerNew', index, 'content', e.target.value)}
                              className="col-span-2 sm:col-span-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-shadow"
                            />
                            <button
                              type="button"
                              onClick={() => removeCareerRow('careerNew', index)}
                              disabled={(formData.careerNew as unknown as CareerEntry[]).length === 1 && !entry.date && !entry.content}
                              className="row-start-1 col-start-2 sm:row-auto sm:col-auto justify-self-center p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      {errors.careerNew && <p className="error-text text-sm text-red-500">{errors.careerNew}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* 流用・追加エリア */}
              {formData.careerType === '令和３年版の経歴を流用・追加' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300 bg-blue-50/30 p-6 rounded-xl border border-blue-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="block text-sm font-medium text-neutral-900">令和３年版の掲載の部 <span className="text-neutral-400 ml-1 text-xs">任意</span></label>
                       <select name="oldCareerDepartment" value={formData.oldCareerDepartment} onChange={handleChange} className="block w-full rounded-lg border border-neutral-300 px-4 py-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                         <option value="">選択してください</option>
                         <option value="裁判所の部">裁判所の部</option>
                         <option value="法務省の部">法務省の部</option>
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="block text-sm font-medium text-neutral-900">掲載頁 <span className="text-neutral-400 ml-1 text-xs">任意</span></label>
                       <div className="flex items-center gap-2">
                         <input type="number" name="oldCareerPage" value={formData.oldCareerPage} onChange={handleChange} placeholder="例: 107"
                          className="block w-32 rounded-lg border border-neutral-300 px-4 py-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-right" />
                         <span className="text-neutral-600 font-medium">頁</span>
                       </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-4 border-t border-blue-100">
                    <label className="block text-sm font-medium text-neutral-900">
                      経歴（追加） <span className="text-neutral-400 ml-1 text-xs">任意</span>
                    </label>
                    <p className="text-xs text-neutral-500 mb-2">令和3年8月2日以降の追加する経歴をご入力ください</p>
                    <div className="space-y-3 p-4 rounded-xl border border-neutral-200 bg-white">
                      {(formData.careerAdd as unknown as CareerEntry[]).map((entry, index) => (
                        <div key={entry.id} className="grid grid-cols-[1fr_40px] sm:grid-cols-[140px_1fr_40px] gap-2 sm:gap-3 items-start sm:items-center relative group pb-3 sm:pb-0 border-b sm:border-b-0 border-neutral-100 last:border-0">
                          <input
                            type="text"
                            value={entry.date}
                            placeholder="例: 令和4年9月"
                            onPaste={(e) => handlePaste(e, index, 'careerAdd')}
                            onChange={(e) => handleCareerChange('careerAdd', index, 'date', e.target.value)}
                            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-shadow"
                          />
                          <input
                            type="text"
                            value={entry.content}
                            placeholder="例: 東京高検検事"
                            onPaste={(e) => handlePaste(e, index, 'careerAdd')}
                            onChange={(e) => handleCareerChange('careerAdd', index, 'content', e.target.value)}
                            className="col-span-2 sm:col-span-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-shadow"
                          />
                          <button
                            type="button"
                            onClick={() => removeCareerRow('careerAdd', index)}
                            disabled={(formData.careerAdd as unknown as CareerEntry[]).length === 1 && !entry.date && !entry.content}
                            className="row-start-1 col-start-2 sm:row-auto sm:col-auto justify-self-center p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 3. 写真について */}
          <section className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="border-b border-neutral-100 bg-neutral-50/50 px-8 py-5">
              <h2 className="text-lg font-semibold text-neutral-800 flex items-center">
                <Camera className="w-5 h-5 mr-2 text-blue-600" />
                3. 写真について
              </h2>
            </div>
            
            <div className="p-8 space-y-8">
               <div className="space-y-3">
                <label className="block text-sm font-medium text-neutral-900">
                  写真の提出方法をご選択ください <span className="text-red-500 ml-1">必須</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <label className={`relative flex items-center p-4 border rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors ${formData.photoType === '新規提出' ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' : 'border-neutral-200'} ${errors.photoType ? 'border-red-300 bg-red-50' : ''}`}>
                    <input type="radio" name="photoType" value="新規提出" checked={formData.photoType === '新規提出'} onChange={handleChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300" />
                    <span className="ml-3 font-medium text-neutral-900">新規提出</span>
                  </label>
                  <label className={`relative flex items-center p-4 border rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors ${formData.photoType === '令和３年版の写真を流用' ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' : 'border-neutral-200'} ${errors.photoType ? 'border-red-300 bg-red-50' : ''}`}>
                    <input type="radio" name="photoType" value="令和３年版の写真を流用" checked={formData.photoType === '令和３年版の写真を流用'} onChange={handleChange} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-neutral-300" />
                    <span className="ml-3 font-medium text-neutral-900">令和３年版の写真を流用</span>
                  </label>
                </div>
                {errors.photoType && <p className="error-text text-sm text-red-500 mt-1">{errors.photoType}</p>}
                
                {formData.careerType === '令和３年版の経歴を流用・追加' && formData.photoType === '令和３年版の写真を流用' && (
                  <p className="text-xs text-blue-600 mt-2 bg-blue-50 inline-block px-3 py-1.5 rounded-md font-medium border border-blue-100">
                    ※経歴の流用情報に基づき、掲載部と頁を自動反映しました。
                  </p>
                )}
              </div>

              {formData.photoType === '新規提出' && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className={`mt-1 flex justify-center px-6 pt-8 pb-10 border-2 border-dashed rounded-xl transition-colors ${errors.photoFile ? 'border-red-300 bg-red-50' : formData.photoFile ? 'border-blue-300 bg-blue-50' : 'border-neutral-300 hover:border-blue-400 bg-neutral-50'}`}>
                    <div className="space-y-2 text-center flex flex-col items-center">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${formData.photoFile ? 'bg-blue-100 text-blue-600' : 'bg-white shadow-sm border border-neutral-200 text-neutral-400'}`}>
                        {formData.photoFile ? <CheckCircle2 className="w-7 h-7" /> : <UploadCloud className="w-7 h-7" />}
                      </div>
                      
                      <div className="flex text-sm text-neutral-600 justify-center">
                        <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 px-3 py-1 shadow-sm border border-neutral-200">
                          <span>ファイルを選択</span>
                          <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
                        </label>
                        <p className="pl-2 pt-1">またはドラッグ＆ドロップ</p>
                      </div>
                      <p className="text-xs text-neutral-500 mt-2">
                        JPG, PNG (上限3MB)
                      </p>
                      {formData.photoFile && (
                        <div className="mt-4 flex flex-col items-center">
                          <p className="text-sm font-medium text-neutral-800 bg-white px-4 py-2 rounded-lg border border-neutral-200 shadow-sm inline-block mb-4">
                            選択済: {formData.photoFile.name}
                          </p>
                          <div className="w-[110px] h-[150px] border border-neutral-400 bg-neutral-100 overflow-hidden relative shadow-sm group">
                            <img 
                              src={URL.createObjectURL(formData.photoFile)} 
                              alt="プレビュー" 
                              className="w-full h-full object-cover grayscale brightness-110 contrast-125" 
                            />
                            <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm shadow-sm pointer-events-none">
                              白黒補正プレビュー
                            </div>
                          </div>
                          <p className="text-[10px] text-neutral-500 mt-2 max-w-xs text-center leading-relaxed">
                            実際の白黒印刷を想定した自動補正（モノクロ・コントラスト強調）をプレビュー表示しています。
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {errors.photoFile && <p className="error-text text-sm text-red-500 mt-2">{errors.photoFile}</p>}
                </div>
              )}

              {formData.photoType === '令和３年版の写真を流用' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300 bg-blue-50/30 p-6 rounded-xl border border-blue-100">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-900">令和３年版の掲載の部 <span className="text-neutral-400 ml-1 text-xs">任意</span></label>
                    <select 
                      name="oldPhotoDepartment" 
                      value={formData.oldPhotoDepartment} 
                      onChange={handleChange} 
                      disabled={formData.careerType === '令和３年版の経歴を流用・追加'} /* Disable if auto-synced */
                      className={`block w-full rounded-lg border px-4 py-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none ${formData.careerType === '令和３年版の経歴を流用・追加' ? 'opacity-70 bg-neutral-100 cursor-not-allowed border-neutral-200' : 'border-neutral-300'}`}
                    >
                      <option value="">選択してください</option>
                      <option value="裁判所の部">裁判所の部</option>
                      <option value="法務省の部">法務省の部</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                     <label className="block text-sm font-medium text-neutral-900">掲載頁 <span className="text-neutral-400 ml-1 text-xs">任意</span></label>
                     <div className="flex items-center gap-2">
                       <input 
                         type="number" 
                         name="oldPhotoPage" 
                         value={formData.oldPhotoPage} 
                         onChange={handleChange} 
                         disabled={formData.careerType === '令和３年版の経歴を流用・追加'} /* Disable if auto-synced */
                         placeholder="例: 107"
                         className={`block w-32 rounded-lg border px-4 py-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-right ${formData.careerType === '令和３年版の経歴を流用・追加' ? 'opacity-70 bg-neutral-100 cursor-not-allowed border-neutral-200' : 'border-neutral-300'}`} 
                       />
                       <span className="text-neutral-600 font-medium">頁</span>
                     </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 4. その他 */}
          <section className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="border-b border-neutral-100 bg-neutral-50/50 px-8 py-5">
              <h2 className="text-lg font-semibold text-neutral-800 flex items-center">
                <Info className="w-5 h-5 mr-2 text-blue-600" />
                4. その他・確認事項
              </h2>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="space-y-2">
                 <label className="block text-sm font-medium text-neutral-900">質問事項：修習終了期 <span className="text-neutral-400 ml-1 text-xs">任意</span></label>
                 <p className="text-xs text-neutral-500 mb-2">※修習期は掲載いたしません。掲載順の参考にいたします。</p>
                 <div className="flex items-center gap-2">
                   <input type="number" name="trainingTerm" value={formData.trainingTerm} onChange={handleChange} placeholder="例: 45"
                    className="block w-32 rounded-lg border border-neutral-300 px-4 py-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-right" />
                   <span className="text-neutral-600 font-medium">期</span>
                 </div>
              </div>

              <div className="pt-6 border-t border-neutral-200">
                <div className="bg-neutral-50 rounded-xl p-6 border border-neutral-200 mb-6 max-h-40 overflow-y-auto text-xs text-neutral-600 leading-relaxed shadow-inner">
                  <h4 className="font-bold text-neutral-800 mb-2 text-sm">利用規約と個人情報保護方針</h4>
                  <p className="mb-2">当会は、本フォームにてご提供いただく個人情報を、名簿の発行およびこれに付随する業務の目的のみに使用いたします。ご本人の同意がある場合または法令に基づく場合を除き、第三者に提供することはございません。</p>
                  <p>記載内容に誤りや修正がある場合は、速やかに当会までご連絡ください。いただいた情報は厳重に管理し、利用目的達成後は適切に廃棄いたします。</p>
                </div>

                <label className={`flex items-start p-4 border rounded-xl cursor-pointer hover:bg-neutral-50 transition-colors ${errors.agreeTerms ? 'border-red-300 bg-red-50' : 'border-neutral-200'}`}>
                  <div className="flex items-center h-5 mt-1">
                    <input 
                      type="checkbox" 
                      name="agreeTerms" 
                      checked={formData.agreeTerms} 
                      onChange={handleChange} 
                      className="w-5 h-5 text-blue-600 bg-white border-neutral-300 rounded focus:ring-blue-500" 
                    />
                  </div>
                  <div className="ml-3 text-sm">
                     <span className="font-medium text-neutral-900 block">利用規約と個人情報保護方針に同意する <span className="text-red-500 ml-1 text-xs font-normal">必須</span></span>
                     <p className="text-neutral-500 mt-1">送信プレビューを確認するには同意が必要です。</p>
                  </div>
                </label>
                {errors.agreeTerms && <p className="error-text text-sm text-red-500 mt-2 font-medium">{errors.agreeTerms}</p>}
              </div>

            </div>
          </section>

          {/* Submit Button */}
          <div className="flex justify-center pt-8 pb-16">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-700 text-white px-12 py-4 rounded-full font-bold text-lg hover:bg-blue-800 transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center group w-full md:w-auto justify-center disabled:bg-blue-400 disabled:scale-100"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              {isSubmitting ? '送信中...' : '確定して送信する'}
            </button>
          </div>

        </form>
        <footer className="mt-16 pb-8 text-center text-xs text-neutral-400">
          <p>© {new Date().getFullYear()} 法曹会 All Rights Reserved.</p>
          <a href="/admin" className="text-neutral-300 hover:text-neutral-500 transition-colors mt-2 inline-block">管理画面ログイン</a>
        </footer>
      </div>
    </div>
  );
}
