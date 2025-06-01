import React, { useState, useEffect, useCallback } from 'react';
import { EmailFormData, User } from './types';
import { GmailService } from './services/gmailService';
// import { GeminiService } from './services/geminiService'; // Gemini service can be integrated later if needed

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+(\S+)?$/;
const GOOGLE_DOCS_REGEX = /^(https?:\/\/)?(docs\.google\.com\/document\/d\/)[\w-]+(\S+)?$/;

const TO_RECIPIENTS = ['y-kasai@avergence.co.jp', 'onishi.senshin.c@gmail.com', 's-hirokawa@avergence.co.jp'];
const CC_RECIPIENTS = ['otaco3321@gmail.com', 'masaya.senarita@temper.co.jp'];

// InputFieldコンポーネントをコンポーネント外に移動
const InputField: React.FC<{
  label: string; 
  name: string; 
  value: string; 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; 
  placeholder?: string; 
  type?: string;
  disabled?: boolean;
}> = ({ label, name, value, onChange, placeholder, type = "text", disabled = false }) => (
  <div className="mb-4">
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      type={type}
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 disabled:bg-gray-100 disabled:cursor-not-allowed"
      aria-label={label}
    />
  </div>
);

const App: React.FC = () => {
  const [formData, setFormData] = useState<EmailFormData>({
    videoUrl: '',
    instructionUrl: '',
    documentName: '',
  });
  const [title, setTitle] = useState<string>('');
  const [deadline, setDeadline] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [isGapiReady, setIsGapiReady] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isFetchingTitle, setIsFetchingTitle] = useState<boolean>(false);
  const [manualTitleMode, setManualTitleMode] = useState<boolean>(false);
  const [driveApiError, setDriveApiError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftUrl, setDraftUrl] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const gmailService = GmailService.getInstance();
  // const geminiService = GeminiService.getInstance(); // Initialize if Gemini features are added

  // GoogleドキュメントのタイトルとIDを抽出する関数
  const extractGoogleDocId = (url: string): string | null => {
    const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  // Googleドキュメントのタイトルを取得する関数
  const fetchGoogleDocTitle = useCallback(async (docId: string): Promise<string | null> => {
    try {
      console.log('📄 Fetching Google Doc title for ID:', docId);
      console.log('📄 Access token available:', !!window.gapi?.client?.getToken());
      
      // Google Drive APIを使用してドキュメント情報を取得
      if (!window.gapi?.client?.drive) {
        console.error('❌ Google Drive API client not available');
        setDriveApiError('Google Drive APIクライアントが利用できません');
        setManualTitleMode(true);
        return null;
      }

      const response = await window.gapi.client.drive.files.get({
        fileId: docId,
        fields: 'name'
      });
      
      console.log('📄 Google Drive API response:', response);
      // 成功したらエラーをクリア
      setDriveApiError(null);
      return response.result.name || null;
    } catch (error: any) {
      console.error('❌ Error fetching Google Doc title:', error);
      console.log('❌ Error details:', error.result || error);
      
      // Google Drive API関連のエラーを判定
      const isApiDisabled = error.result?.error?.message?.includes('Google Drive API has not been used') ||
                           error.result?.error?.message?.includes('disabled') ||
                           error.status === 403;
      
      if (isApiDisabled) {
        setDriveApiError('Google Drive APIが有効になっていません。手動でタイトルを入力してください。');
        setManualTitleMode(true);
        console.log('📄 Switching to manual title mode due to API restriction');
        return null;
      }
      
      // フォールバック：直接HTTPリクエスト
      try {
        console.log('📄 Trying fallback method...');
        const token = window.gapi.client.getToken();
        if (!token?.access_token) {
          console.error('❌ No access token available for fallback');
          setDriveApiError('アクセストークンが利用できません');
          setManualTitleMode(true);
          return null;
        }

        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${docId}?fields=name`, {
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log('📄 Fallback response:', data);
          setDriveApiError(null);
          return data.name || null;
        } else {
          console.error('❌ Fallback request failed:', response.status, response.statusText);
          if (response.status === 403) {
            setDriveApiError('Google Drive APIへのアクセス権限がありません。手動でタイトルを入力してください。');
            setManualTitleMode(true);
          }
          return null;
        }
      } catch (fallbackError) {
        console.error('❌ Fallback method also failed:', fallbackError);
        setDriveApiError('タイトルの自動取得に失敗しました。手動で入力してください。');
        setManualTitleMode(true);
        return null;
      }
    }
  }, []);

  // 指示書URLが変更されたときに自動でタイトルを取得
  useEffect(() => {
    console.log('🔍 useEffect triggered:', {
      instructionUrl: formData.instructionUrl,
      isGoogleDocsUrl: GOOGLE_DOCS_REGEX.test(formData.instructionUrl || ''),
      user: !!user,
      isGapiReady
    });

    if (formData.instructionUrl && GOOGLE_DOCS_REGEX.test(formData.instructionUrl)) {
      const docId = extractGoogleDocId(formData.instructionUrl);
      console.log('📄 Extracted doc ID:', docId);
      
      if (docId && user && isGapiReady) {
        console.log('📄 All conditions met, fetching title...');
        setIsFetchingTitle(true);
        fetchGoogleDocTitle(docId)
          .then(title => {
            if (title) {
              console.log('📄 Fetched title:', title);
              setFormData(prev => ({ ...prev, documentName: title }));
            } else {
              console.log('📄 No title returned');
            }
          })
          .catch(error => {
            console.error('❌ Error in title fetch:', error);
          })
          .finally(() => {
            setIsFetchingTitle(false);
          });
      } else {
        console.log('📄 Conditions not met:', {
          hasDocId: !!docId,
          hasUser: !!user,
          gapiReady: isGapiReady
        });
      }
    } else {
      console.log('📄 URL is empty or not a Google Docs URL');
    }
  }, [formData.instructionUrl, user, isGapiReady, fetchGoogleDocTitle]);

  useEffect(() => {
    console.log('🎯 App.tsx: Starting Gmail service initialization...');
    gmailService.loadGapiScript(() => {
      console.log('📞 App.tsx: loadGapiScript callback called, calling initClient...');
      gmailService.initClient((gapiUser) => {
        console.log('📞 App.tsx: initClient callback called with user:', gapiUser);
        setIsGapiReady(true);
        console.log('✅ App.tsx: setIsGapiReady(true) called');
        if (gapiUser && gapiUser.isSignedIn()) {
          const profile = gapiUser.getBasicProfile();
          setUser({ name: profile.getName(), email: profile.getEmail(), imageUrl: profile.getImageUrl() });
          console.log('✅ App.tsx: User set from existing sign-in');
        } else {
          console.log('ℹ️ App.tsx: No existing signed-in user');
        }
      }, (err) => {
        console.error('❌ App.tsx: initClient error callback called:', err);
        setError(`Google API Client Error: ${err.message || err.details || 'Unknown error during init'}`);
        setIsGapiReady(false);
      });
    }, (scriptLoadErr: Error) => { // Explicitly type scriptLoadErr as Error
        console.error('❌ App.tsx: loadGapiScript error callback called:', scriptLoadErr);
        setError(`Google API Script Load Error: ${scriptLoadErr.message || 'Failed to load Google API script.'}`);
        setIsGapiReady(false);
    });
  }, [gmailService]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    console.log('📝 Input changed:', name, '=', value);
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null); // Clear error on input change
    setDraftUrl(null);
    setSuccessMessage(null);
  };

  const validateInputs = useCallback(() => {
    let videoUrl = formData.videoUrl.trim();
    let instructionUrl = formData.instructionUrl.trim();

    if (!videoUrl || !instructionUrl || !formData.documentName.trim()) {
      setError('全てのフィールドを入力してください。 (Please fill in all fields.)');
      return false;
    }
    
    let isYoutubeLink = YOUTUBE_REGEX.test(videoUrl);
    let isGoogleDocsLink = GOOGLE_DOCS_REGEX.test(instructionUrl);

    // Check if roles are swapped and correct them
    if (YOUTUBE_REGEX.test(instructionUrl) && GOOGLE_DOCS_REGEX.test(videoUrl)) {
        // URLs are swapped
        [videoUrl, instructionUrl] = [instructionUrl, videoUrl];
        setFormData(prev => ({...prev, videoUrl: videoUrl, instructionUrl: instructionUrl})); // Update state with corrected URLs
        isYoutubeLink = true;
        isGoogleDocsLink = true;
    }


    if (!isYoutubeLink) {
      setError('有効なYouTube動画URLを入力してください。 (Please enter a valid YouTube video URL.)');
      return false;
    }
    if (!isGoogleDocsLink) {
      setError('有効なGoogleドキュメントURLを入力してください。 (Please enter a valid Google Docs URL.)');
      return false;
    }
    return true;
  }, [formData]);

  const processDataAndCreateDraft = useCallback(async () => {
    if (!validateInputs()) return;
    if (!user) {
      setError('Googleアカウントでサインインしてください。 (Please sign in with your Google account.)');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setDraftUrl(null);
    setSuccessMessage(null);

    try {
      // STEP 2: Define title and deadline
      const docName = formData.documentName.trim();
      const derivedTitle = docName.replace(/【指示書】/g, '').trim();
      setTitle(derivedTitle);

      const today = new Date();
      const deadlineDate = new Date(today);
      deadlineDate.setDate(today.getDate() + 2);
      
      const month = (deadlineDate.getMonth() + 1).toString().padStart(2, '0');
      const day = deadlineDate.getDate().toString().padStart(2, '0');
      const dayOfWeek = deadlineDate.toLocaleDateString('ja-JP', { weekday: 'short' });
      const formattedDeadline = `${month}/${day} (${dayOfWeek})`;
      setDeadline(formattedDeadline);

      // STEP 3: Create email content
      const emailBody = `
皆さま

いつもお世話になっております。

ーーー
${derivedTitle}
ーーー

動画チェックお願いいたします！

ーーー
▼${derivedTitle}
◆動画：${formData.videoUrl.trim()}
◆編集指示書：${formData.instructionUrl.trim()}
◆補足：
ーーー

お忙しいところ恐縮ですが、${formattedDeadline}中までにご確認いただけますと幸いです。よろしくお願いいたします。
      `.trim();

      const subject = `動画チェック依頼: ${derivedTitle}`;

      const createdDraft = await gmailService.createDraft(
        TO_RECIPIENTS,
        CC_RECIPIENTS,
        subject,
        emailBody
      );

      if (createdDraft && createdDraft.id) {
        const newDraftUrl = `https://mail.google.com/mail/u/0/#drafts?draft=${createdDraft.id}`;
        setDraftUrl(newDraftUrl);
        setSuccessMessage('Gmailの下書きが作成されました。補足がある場合は付け足してください。');
      } else {
        setError('下書きの作成に失敗しました。Gmail APIからの応答が予期せぬ形式でした。 (Failed to create draft. Unexpected response from Gmail API.)');
      }
    } catch (err: any) {
      console.error('Error creating draft:', err);
      setError(`下書き作成エラー: ${err.message || '不明なエラーが発生しました。'} (Draft creation error: ${err.message || 'An unknown error occurred.'})`);
    } finally {
      setIsProcessing(false);
    }
  }, [formData, user, gmailService, validateInputs]);

  const handleSignIn = async () => {
    setError(null);
    try {
      const gapiUser = await gmailService.signIn();
      if (gapiUser && gapiUser.isSignedIn()) {
        const profile = gapiUser.getBasicProfile();
        setUser({ name: profile.getName(), email: profile.getEmail(), imageUrl: profile.getImageUrl() });
      }
    } catch (err: any) {
      setError(`サインインエラー: ${err.message || err.details || '不明なエラーが発生しました。'} (Sign-in error: ${err.message || 'An unknown error occurred.'})`);
    }
  };

  const handleSignOut = () => {
    gmailService.signOut();
    setUser(null);
    setError(null);
    setDraftUrl(null);
    setSuccessMessage(null);
  };
  
  if (!isGapiReady && !error) { // Show loading only if no error has occurred yet
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" role="status" aria-label="Loading"></div>
          <p className="text-lg font-medium text-gray-700">Google APIを初期化しています... (Initializing Google API...)</p>
        </div>
      </div>
    );
  }

  if (error && !isGapiReady) { // Show persistent error if GAPI failed to initialize
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
            Gmail下書き自動作成ツール
          </h1>
          <p className="text-slate-300 mt-2">動画チェック依頼メールの下書きを簡単に作成します。</p>
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
          <form onSubmit={(e) => { e.preventDefault(); processDataAndCreateDraft(); }} className="space-y-6" aria-labelledby="form-title">
            <h2 id="form-title" className="sr-only">Email Draft Details Form</h2>
            <InputField
              label="動画URL (YouTube)"
              name="videoUrl"
              value={formData.videoUrl}
              onChange={handleInputChange}
              placeholder="例: https://www.youtube.com/watch?v=xxxxxxxxx"
              type="url"
            />
            <InputField
              label="指示書URL (Googleドキュメント)"
              name="instructionUrl"
              value={formData.instructionUrl}
              onChange={handleInputChange}
              placeholder="例: https://docs.google.com/document/d/yyyyyyyyy/edit"
              type="url"
            />
            <InputField
              label="ドキュメント名 (指示書から)"
              name="documentName"
              value={formData.documentName}
              onChange={handleInputChange}
              placeholder={isFetchingTitle ? "Googleドキュメントのタイトルを取得中..." : "例: 【指示書】プロジェクトABC動画編集"}
              disabled={isFetchingTitle}
            />
            
            {driveApiError && (
              <div className="mb-4 p-3 bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-md text-yellow-300">
                <p className="text-sm font-medium">⚠️ タイトル自動取得について</p>
                <p className="text-xs mt-1">{driveApiError}</p>
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer hover:text-yellow-200">解決方法を表示</summary>
                  <div className="mt-2 text-xs text-yellow-200 border-l-2 border-yellow-500 pl-2">
                    <p className="font-medium">Google Drive APIを有効にする手順：</p>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li><a href="https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=150924495355" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">Google Cloud Console</a> にアクセス</li>
                      <li>「有効にする」ボタンをクリック</li>
                      <li>数分待ってからページをリロード</li>
                    </ol>
                    <p className="mt-2 text-yellow-300">それまでは手動でドキュメント名を入力してください。</p>
                    {manualTitleMode && formData.instructionUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const docId = extractGoogleDocId(formData.instructionUrl);
                          if (docId) {
                            setManualTitleMode(false);
                            setDriveApiError(null);
                            setIsFetchingTitle(true);
                            fetchGoogleDocTitle(docId)
                              .then(title => {
                                if (title) {
                                  setFormData(prev => ({ ...prev, documentName: title }));
                                }
                              })
                              .finally(() => {
                                setIsFetchingTitle(false);
                              });
                          }
                        }}
                        className="mt-2 px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white text-xs rounded-md transition-colors"
                      >
                        🔄 タイトル自動取得を再試行
                      </button>
                    )}
                  </div>
                </details>
              </div>
            )}

            <button
              type="submit"
              disabled={isProcessing || !user || !isGapiReady}
              className="w-full flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors duration-150"
              aria-disabled={isProcessing || !user || !isGapiReady}
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  処理中...
                </>
              ) : (
                '下書きを作成'
              )}
            </button>
          </form>
        )}

        {error && ( // General error display, distinct from the full-page init error
          <div role="alert" className="mt-6 p-4 bg-red-900 bg-opacity-30 border border-red-700 rounded-md text-red-300">
            <p className="font-medium">エラー:</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {successMessage && draftUrl && (
          <div role="alert" className="mt-6 p-4 bg-green-900 bg-opacity-30 border border-green-700 rounded-md text-green-300">
            <p className="font-medium">成功！</p>
            <p className="text-sm">{successMessage}</p>
            <a
              href={draftUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-indigo-400 hover:text-indigo-300 underline font-medium"
            >
              作成された下書きを開く
            </a>
          </div>
        )}
         {successMessage && !draftUrl && (
          <div role="alert" className="mt-6 p-4 bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-md text-yellow-300">
            <p className="font-medium">情報</p>
            <p className="text-sm">{successMessage}</p>
            <p className="text-xs mt-1">下書きURLが取得できませんでしたが、作成はされている可能性があります。Gmailをご確認ください。</p>
          </div>
        )}
      </div>
      <footer className="mt-12 text-center text-slate-400 text-sm">
        <p>&copy; {new Date().getFullYear()} Gmail Draft Automation. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default App;
