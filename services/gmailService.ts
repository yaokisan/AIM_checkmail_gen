// Ensures gapi is available globally. This is a common pattern for Google API Client.
declare global {
  interface Window {
    gapi: any; // Consider using more specific types if available, e.g., from @types/gapi.client.gmail
    google: any; // For Google Identity Services
    process: { // Add process to window for client-side env vars
      env: {
        [key: string]: string | undefined;
      }
    }
  }
}
interface GapiAuth2Error {
  error?: string;
  details?: string;
  message?: string; 
}

interface BasicProfile {
  getId(): string;
  getName(): string;
  getGivenName(): string;
  getFamilyName(): string;
  getImageUrl(): string;
  getEmail(): string;
}

interface AuthResponse {
  access_token: string;
  id_token: string;
  scope: string;
  expires_in: number;
  first_issued_at: number;
  expires_at: number;
}

interface GoogleUser {
  getBasicProfile(): BasicProfile;
  getAuthResponse(includeAuthorizationData?: boolean): AuthResponse;
  isSignedIn(): boolean;
  hasGrantedScopes(scopes: string): boolean;
  grant(options?: {scope: string}): Promise<any>;
  disconnect(): void;
}

export class GmailService {
  private static instance: GmailService;
  private readonly SCOPES = 'https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.readonly';
  private readonly DISCOVERY_DOCS = [
    "https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest",
    "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"
  ];
  
  private gapiLoaded: boolean = false;
  private gisInitialized: boolean = false;
  private tokenClient: any | null = null; // For GIS token client
  private currentUser: GoogleUser | null = null;
  private accessToken: string | null = null;

  private constructor() {
    // Constructor is kept light. Initialization happens in loadGapiScript and initClient.
    if (typeof window !== 'undefined' && (!window.process || !window.process.env)) {
      console.warn("window.process.env is not defined. Ensure environment variables are set in index.html.");
    }
  }

  public static getInstance(): GmailService {
    if (!GmailService.instance) {
      GmailService.instance = new GmailService();
    }
    return GmailService.instance;
  }

  public loadGapiScript(callback: () => void, onError: (error: Error) => void): void {
    console.log('🚀 Starting loadGapiScript...');
    if (this.gapiLoaded) {
      console.log('✅ GAPI already loaded, calling callback immediately');
      callback();
      return;
    }

    // Load both GAPI and GIS libraries
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;

    let loadedCount = 0;
    const onLoad = () => {
      loadedCount++;
      console.log(`📦 Script loaded ${loadedCount}/2`);
      if (loadedCount === 2) {
        console.log('📦 Both scripts loaded, initializing gapi.client...');
        this.gapiLoaded = true;
        window.gapi.load('client', () => {
          console.log('✅ gapi.client loaded successfully');
          callback();
        });
      }
    };

    const onScriptError = (scriptName: string) => {
      console.error(`❌ Failed to load ${scriptName} script`);
      onError(new Error(`Failed to load ${scriptName} script.`));
    };

    gapiScript.onload = () => {
      console.log('📦 GAPI script loaded');
      onLoad();
    };
    gapiScript.onerror = () => onScriptError('GAPI');
    
    gisScript.onload = () => {
      console.log('📦 GIS script loaded');
      onLoad();
    };
    gisScript.onerror = () => onScriptError('GIS');

    console.log('📦 Adding scripts to document...');
    document.body.appendChild(gapiScript);
    document.body.appendChild(gisScript);
  }

  public initClient(
    updateSigninStatus: (user: GoogleUser | null) => void,
    onError: (error: GapiAuth2Error) => void
  ): void {
    console.log('🔧 Starting initClient...');
    const CLIENT_ID = window.process?.env?.REACT_APP_GOOGLE_CLIENT_ID;

    if (!CLIENT_ID) {
      console.error('❌ CLIENT_ID not found');
      console.error('REACT_APP_GOOGLE_CLIENT_ID is not set in environment variables (window.process.env). GmailService cannot initialize.');
      onError({ error: 'Configuration Error', details: 'Google Client ID is missing. Please check setup instructions.' });
      return;
    }
    console.log('✅ CLIENT_ID found:', CLIENT_ID.substring(0, 20) + '...');

    if (!window.gapi || !window.gapi.client) {
       console.error('❌ GAPI client not available');
       onError({ error: 'GAPI Error', details: 'Google API client library not loaded.' });
       return;
    }
    console.log('✅ GAPI client available');
    
    // Check if Google Identity Services is available
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      console.error('❌ Google Identity Services not available');
      console.log('window.google:', window.google);
      onError({ error: 'GIS Error', details: 'Google Identity Services library not loaded.' });
      return;
    }
    console.log('✅ Google Identity Services available');
    
    // Initialize GAPI client without auth
    console.log('🔧 Initializing GAPI client...');
    window.gapi.client.init({
      discoveryDocs: this.DISCOVERY_DOCS,
    }).then(() => {
      console.log('✅ GAPI client initialized successfully');
      
      // Initialize Google Identity Services token client
      console.log('🔧 Initializing GIS token client...');
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: this.SCOPES,
        callback: (response: any) => {
          console.log('🎯 GIS callback received:', response);
          if (response.error) {
            console.error('❌ GIS Token Error:', response);
            onError({ error: 'Token Error', details: response.error_description || response.error });
            return;
          }
          
          console.log('✅ Access token received:', response.access_token ? 'YES' : 'NO');
          this.accessToken = response.access_token;
          
          // Set the access token for GAPI requests
          console.log('🔧 Setting access token for GAPI client...');
          window.gapi.client.setToken({
            access_token: response.access_token
          });

          // Create a mock user object for compatibility
          console.log('🔧 Creating mock user object...');
          this.currentUser = this.createMockUser(response);
          console.log('✅ User object created:', this.currentUser ? 'SUCCESS' : 'FAILED');
          console.log('🔄 Calling updateSigninStatus with currentUser...');
          updateSigninStatus(this.currentUser);
        },
      });

      this.gisInitialized = true;
      console.log('✅ Google Identity Services initialized successfully');
      
      // 初期化完了を通知（初期状態ではユーザーはサインインしていない）
      console.log('🔄 Calling updateSigninStatus with null (no initial user)');
      updateSigninStatus(null);
      
    }).catch((error: any) => {
      console.error('❌ Error initializing Google API client:', error);
      const errDetails = error.result?.error?.message || error.details || error.message || JSON.stringify(error);
      onError({ error: error.result?.error?.status || 'InitializationFailed', details: `Failed to initialize Google API client: ${errDetails}` });
    });
  }

  private createMockUser(tokenResponse: any): GoogleUser {
    console.log('👤 createMockUser called with tokenResponse:', tokenResponse);
    console.log('👤 Access token present:', !!tokenResponse.access_token);
    console.log('👤 Creating user object...');
    
    const user = {
      getBasicProfile: () => {
        console.log('👤 getBasicProfile() called');
        return {
          getId: () => 'user',
          getName: () => 'User',
          getGivenName: () => 'User',
          getFamilyName: () => '',
          getImageUrl: () => '',
          getEmail: () => 'user@example.com'
        };
      },
      getAuthResponse: () => {
        console.log('👤 getAuthResponse() called');
        return {
          access_token: tokenResponse.access_token,
          id_token: '',
          scope: tokenResponse.scope || this.SCOPES,
          expires_in: tokenResponse.expires_in || 3600,
          first_issued_at: Date.now(),
          expires_at: Date.now() + (tokenResponse.expires_in || 3600) * 1000
        };
      },
      isSignedIn: () => {
        console.log('👤 isSignedIn() called, accessToken:', !!this.accessToken);
        return !!this.accessToken;
      },
      hasGrantedScopes: (scopes: string) => {
        console.log('👤 hasGrantedScopes() called with:', scopes);
        return true;
      },
      grant: async (options?: {scope: string}) => {
        console.log('👤 grant() called with options:', options);
        return Promise.resolve();
      },
      disconnect: () => {
        console.log('👤 disconnect() called');
        this.signOut();
      }
    };
    
    console.log('👤 User object created successfully');
    return user;
  }

  public async signIn(): Promise<GoogleUser> {
    if (!this.tokenClient) {
      throw new Error('Google Identity Services not initialized.');
    }
    
    console.log('🔐 Starting sign-in process...');
    
    return new Promise((resolve, reject) => {
      // Store the original callback and modify it to resolve the promise
      const originalCallback = this.tokenClient.callback;
      console.log('🔐 Temporarily modifying tokenClient callback...');
      
      this.tokenClient.callback = (response: any) => {
        console.log('🔐 Sign-in callback received:', response);
        
        // Restore original callback
        this.tokenClient.callback = originalCallback;
        console.log('🔐 Restored original callback');
        
        if (response.error) {
          console.error('❌ Sign-in response error:', response.error);
          reject(new Error(response.error_description || response.error));
        } else {
          console.log('✅ Sign-in response successful, calling original callback...');
          
          // Call the original callback to set currentUser
          console.log('🔄 Executing original callback to set currentUser...');
          originalCallback(response);
          
          // Wait for currentUser to be set
          setTimeout(() => {
            console.log('🔐 Checking currentUser:', this.currentUser);
            if (this.currentUser) {
              console.log('✅ CurrentUser found, resolving...');
              resolve(this.currentUser);
            } else {
              console.error('❌ CurrentUser not found after timeout');
              reject(new Error('Failed to create user object'));
            }
          }, 100);
        }
      };
      
      // Request access token
      console.log('🔐 Requesting access token...');
      this.tokenClient.requestAccessToken();
    });
  }

  public signOut(): void {
    if (this.accessToken) {
      // Revoke the access token
      window.google.accounts.oauth2.revoke(this.accessToken, () => {
        console.log('Access token revoked');
      });
    }
    
    this.accessToken = null;
    this.currentUser = null;
    
    // Clear GAPI token
    window.gapi.client.setToken(null);
  }

  public async createDraft(to: string[], cc: string[], subject: string, messageBody: string): Promise<any> {
    if (!this.accessToken || !this.currentUser?.isSignedIn()) {
      throw new Error('User not signed in or Gmail API not initialized.');
    }
    
    console.log('📧 Creating draft with:', { to, cc, subject: subject.substring(0, 50) + '...' });
    
    // 日本語タイトルのためのRFC 2047エンコーディング
    const encodeSubject = (text: string): string => {
      // ASCII文字のみの場合はそのまま返す
      if (/^[\x20-\x7E]*$/.test(text)) {
        return text;
      }
      
      // 日本語等の非ASCII文字を含む場合は、RFC 2047形式でエンコード
      try {
        const utf8Bytes = new TextEncoder().encode(text);
        const base64 = btoa(String.fromCharCode(...utf8Bytes));
        return `=?UTF-8?B?${base64}?=`;
      } catch (error) {
        console.error('❌ Subject encoding failed:', error);
        return text; // フォールバック
      }
    };

    // シンプルで確実なメール構造
    const emailLines = [
      `To: ${to.join(',')}`,
      `Cc: ${cc.join(',')}`,
      `Subject: ${encodeSubject(subject)}`,
      'Content-Type: text/plain; charset=UTF-8',
      'MIME-Version: 1.0',
      '',
      messageBody
    ];
    const email = emailLines.join('\r\n');
    
    console.log('📧 Email structure (first 300 chars):', email.substring(0, 300) + '...');
    console.log('📧 Encoded subject:', encodeSubject(subject));
    
    // シンプルで確実なBase64エンコーディング
    let base64EncodedEmail: string;
    try {
      // UTF-8文字列をBase64に変換
      base64EncodedEmail = btoa(
        Array.from(new TextEncoder().encode(email))
          .map(byte => String.fromCharCode(byte))
          .join('')
      ).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      
      console.log('📧 Base64 encoded successfully');
    } catch (error) {
      console.error('❌ Base64 encoding failed, using simple fallback:', error);
      // 最もシンプルなフォールバック
      base64EncodedEmail = btoa(email)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }

    try {
      console.log('📧 Sending to Gmail API...');
      const response = await window.gapi.client.gmail.users.drafts.create({
        'userId': 'me',
        'resource': {
          'message': {
            'raw': base64EncodedEmail
          }
        }
      });
      console.log('📧 Gmail API response:', response);
      return response.result;
    } catch (error: any) {
      console.error('Error creating Gmail draft:', error);
      throw new Error(`Failed to create draft: ${error.result?.error?.message || error.message || 'Unknown error'}`);
    }
  }
}
