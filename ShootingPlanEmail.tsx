import React, { useState, useEffect, useCallback } from 'react';
import { ShootingPlanFormData, ShootingPlan, ShootingEmailData, User } from './types';
import { GmailService } from './services/gmailService';

// 数字を丸囲み文字に変換する関数
const getCircledNumber = (num: number): string => {
  const circledNumbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
  return circledNumbers[num - 1] || `⑪+${num - 10}`;
};

// 曜日を日本語で取得する関数
const getJapaneseDayOfWeek = (date: Date): string => {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[date.getDay()];
};

// 10分刻みの時間オプションを生成する関数
const generateTimeOptions = (): string[] => {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 10) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      options.push(timeString);
    }
  }
  return options;
};

const ShootingPlanEmail: React.FC = () => {
  const [formData, setFormData] = useState<ShootingPlanFormData>({
    date: '',
    time: '',
    projects: '',
  });
  const [user, setUser] = useState<User | null>(null);
  const [isGapiReady, setIsGapiReady] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [draftUrl, setDraftUrl] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ShootingEmailData | null>(null);

  const gmailService = GmailService.getInstance();

  // Gmail API初期化
  useEffect(() => {
    console.log('🎯 ShootingPlanEmail: Starting Gmail service initialization...');
    gmailService.loadGapiScript(() => {
      console.log('📞 ShootingPlanEmail: loadGapiScript callback called, calling initClient...');
      gmailService.initClient((gapiUser) => {
        console.log('📞 ShootingPlanEmail: initClient callback called with user:', gapiUser);
        setIsGapiReady(true);
        if (gapiUser && gapiUser.isSignedIn()) {
          const profile = gapiUser.getBasicProfile();
          setUser({ name: profile.getName(), email: profile.getEmail(), imageUrl: profile.getImageUrl() });
          console.log('✅ ShootingPlanEmail: User set from existing sign-in');
        } else {
          console.log('ℹ️ ShootingPlanEmail: No existing signed-in user');
        }
      }, (err) => {
        console.error('❌ ShootingPlanEmail: initClient error callback called:', err);
        setError(`Google API Client Error: ${err.message || err.details || 'Unknown error during init'}`);
        setIsGapiReady(false);
      });
    }, (scriptLoadErr: Error) => {
        console.error('❌ ShootingPlanEmail: loadGapiScript error callback called:', scriptLoadErr);
        setError(`Google API Script Load Error: ${scriptLoadErr.message || 'Failed to load Google API script.'}`);
        setIsGapiReady(false);
    });
  }, [gmailService]);

  // フォーム入力変更ハンドラー
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
    setDraftUrl(null);
    setSuccessMessage(null);
  };

  // プレビューデータの生成
  const generatePreviewData = useCallback((): ShootingEmailData | null => {
    if (!formData.date || !formData.time || !formData.projects.trim()) {
      return null;
    }

    try {
      const dateObj = new Date(formData.date + 'T' + formData.time);
      const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      const day = dateObj.getDate().toString().padStart(2, '0');
      const dayOfWeek = getJapaneseDayOfWeek(dateObj);
      const hour = dateObj.getHours().toString().padStart(2, '0');
      const minute = dateObj.getMinutes().toString().padStart(2, '0');
      
      const formattedDateTime = `${month}/${day}（${dayOfWeek}）${hour}:${minute}`;

      const projectLines = formData.projects.trim().split('\n').filter(line => line.trim());
      const plans: ShootingPlan[] = projectLines.map((line, index) => ({
        number: getCircledNumber(index + 1),
        title: line.trim()
      }));

      return {
        dateTime: formData.date + ' ' + formData.time,
        formattedDateTime,
        plans
      };
    } catch (error) {
      console.error('Error generating preview data:', error);
      return null;
    }
  }, [formData]);

  // プレビューデータの更新
  useEffect(() => {
    const preview = generatePreviewData();
    setPreviewData(preview);
  }, [generatePreviewData]);

  // バリデーション
  const validateInputs = useCallback(() => {
    if (!formData.date || !formData.time || !formData.projects.trim()) {
      setError('全てのフィールドを入力してください。');
      return false;
    }

    const projectLines = formData.projects.trim().split('\n').filter(line => line.trim());
    if (projectLines.length === 0) {
      setError('企画を最低1つ入力してください。');
      return false;
    }

    return true;
  }, [formData]);

  // メール下書き作成
  const createEmailDraft = useCallback(async () => {
    if (!validateInputs()) return;
    if (!user) {
      setError('Googleアカウントでサインインしてください。');
      return;
    }
    if (!previewData) {
      setError('プレビューデータの生成に失敗しました。');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setDraftUrl(null);
    setSuccessMessage(null);

    try {
      // メール本文の生成
      const plansList = previewData.plans.map(plan => 
        `${plan.number}${plan.title}\n→`
      ).join('\n\n');

      const emailBody = `xxさん、xxさん

お世話になっております。

次回撮影分の企画の詳細についてご共有いたします。

◆${previewData.formattedDateTime}〜 xxさん・xxさん

${plansList}

お忙しいところ大変恐縮ですが、よろしくお願いいたします。

小林`;

      const subject = '次回撮影企画の詳細について';

      // TO/CC受信者（既存のものを使用）
      const TO_RECIPIENTS = ['y-kasai@avergence.co.jp', 'onishi.senshin.c@gmail.com', 's-hirokawa@avergence.co.jp'];
      const CC_RECIPIENTS = ['otaco3321@gmail.com', 'masaya.senarita@temper.co.jp'];

      const createdDraft = await gmailService.createDraft(
        TO_RECIPIENTS,
        CC_RECIPIENTS,
        subject,
        emailBody
      );

      if (createdDraft && createdDraft.id) {
        const newDraftUrl = `https://mail.google.com/mail/u/0/#drafts?draft=${createdDraft.id}`;
        setDraftUrl(newDraftUrl);
        setSuccessMessage('Gmailの下書きが作成されました。');
      } else {
        setError('下書きの作成に失敗しました。Gmail APIからの応答が予期せぬ形式でした。');
      }
    } catch (err: any) {
      console.error('Error creating draft:', err);
      setError(`下書き作成エラー: ${err.message || '不明なエラーが発生しました。'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [formData, user, gmailService, validateInputs, previewData]);

  // サインイン
  const handleSignIn = async () => {
    setError(null);
    try {
      const gapiUser = await gmailService.signIn();
      if (gapiUser && gapiUser.isSignedIn()) {
        const profile = gapiUser.getBasicProfile();
        setUser({ name: profile.getName(), email: profile.getEmail(), imageUrl: profile.getImageUrl() });
      }
    } catch (err: any) {
      setError(`サインインエラー: ${err.message || err.details || '不明なエラーが発生しました。'}`);
    }
  };

  // サインアウト
  const handleSignOut = () => {
    gmailService.signOut();
    setUser(null);
    setError(null);
    setDraftUrl(null);
    setSuccessMessage(null);
  };

  // ローディング画面
  if (!isGapiReady && !error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" role="status" aria-label="Loading"></div>
          <p className="text-lg font-medium text-gray-700">Google APIを初期化しています...</p>
        </div>
      </div>
    );
  }

  // エラー画面
  if (error && !isGapiReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center p-6 max-w-md bg-white shadow-md rounded-lg">
          <h2 className="text-xl font-semibold text-red-700 mb-3">初期化エラー</h2>
          <p className="text-sm text-red-600" role="alert">{error}</p>
          <p className="mt-4 text-xs text-gray-500">ページをリロードするか、しばらくしてからもう一度お試しください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 text-white p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-2xl bg-slate-800 shadow-2xl rounded-lg p-6 sm:p-8">
        <header className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-500">
            撮影企画詳細メール作成ツール
          </h1>
          <p className="text-slate-300 mt-2">撮影企画の詳細メールの下書きを簡単に作成します。</p>
        </header>

        {!user ? (
          <div className="text-center">
            <p className="mb-4 text-slate-300">Gmail APIを利用するために、Googleアカウントでサインインしてください。</p>
            <button
              onClick={handleSignIn}
              disabled={!isGapiReady}
              className="w-full flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              aria-label="Sign in with Google"
            >
              <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48px" height="48px" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
              Googleでサインイン
            </button>
          </div>
        ) : (
          <div className="mb-6 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <div>
                <p>サインイン中: {user.email}</p>
                {user.name && <p>{user.name}</p>}
                {user.imageUrl && <img src={user.imageUrl} alt="User avatar" className="w-8 h-8 rounded-full inline-block ml-2"/>}
              </div>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 border border-slate-600 rounded-md text-xs text-slate-300 hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500"
                aria-label="Sign out"
              >
                サインアウト
              </button>
            </div>
          </div>
        )}

        {user && isGapiReady && (
          <form onSubmit={(e) => { e.preventDefault(); createEmailDraft(); }} className="space-y-6">
            {/* STEP1: 撮影日時選択 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-200">STEP 1: 撮影日時を選択</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-300 mb-1">撮影日</label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="time" className="block text-sm font-medium text-gray-300 mb-1">撮影時間</label>
                  <select
                    id="time"
                    name="time"
                    value={formData.time}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white"
                    required
                  >
                    <option value="">時間を選択してください</option>
                    {generateTimeOptions().map((time, index) => (
                      <option key={index} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              {previewData && (
                <div className="mt-2 p-3 bg-slate-700 rounded-md">
                  <p className="text-sm text-slate-300">📅 {previewData.formattedDateTime}〜</p>
                </div>
              )}
            </div>

            {/* STEP2: 企画リスト入力 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-200">STEP 2: 企画リストを入力</h3>
              
              <div>
                <label htmlFor="projects" className="block text-sm font-medium text-gray-300 mb-1">
                  企画リスト（1行につき1企画）
                </label>
                <textarea
                  id="projects"
                  name="projects"
                  value={formData.projects}
                  onChange={handleInputChange}
                  placeholder="例：&#10;アイドル撮影&#10;インタビュー撮影&#10;商品紹介動画&#10;イベント撮影"
                  rows={6}
                  className="mt-1 block w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-white resize-vertical"
                  required
                />
              </div>

              {previewData && previewData.plans.length > 0 && (
                <div className="mt-2 p-3 bg-slate-700 rounded-md">
                  <p className="text-sm text-slate-300 mb-2">📋 企画リスト（{previewData.plans.length}件）:</p>
                  <div className="space-y-1">
                    {previewData.plans.map((plan, index) => (
                      <p key={index} className="text-sm text-slate-200">
                        {plan.number}{plan.title}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* エラー表示 */}
            {error && (
              <div className="p-4 bg-red-900 bg-opacity-30 border border-red-700 rounded-md">
                <p className="text-red-300 text-sm" role="alert">{error}</p>
              </div>
            )}

            {/* 成功メッセージ表示 */}
            {successMessage && (
              <div className="p-4 bg-green-900 bg-opacity-30 border border-green-700 rounded-md">
                <p className="text-green-300 text-sm">{successMessage}</p>
              </div>
            )}

            {/* 下書きリンク表示 */}
            {draftUrl && (
              <div className="p-4 bg-blue-900 bg-opacity-30 border border-blue-700 rounded-md">
                <p className="text-blue-300 text-sm mb-2">✅ Gmail下書きが作成されました</p>
                <a
                  href={draftUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors duration-200"
                >
                  📧 Gmailで下書きを開く
                  <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            )}

            {/* 送信ボタン */}
            <button
              type="submit"
              disabled={isProcessing || !user || !isGapiReady || !previewData}
              className="w-full flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors duration-150"
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  下書き作成中...
                </>
              ) : (
                <>
                  📧 Gmail下書きを作成
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ShootingPlanEmail; 