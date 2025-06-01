// env-config.production.js - 本番環境用

// このファイルは本番環境でのみ使用されます
// Vercelの環境変数は、ビルド時にこのファイルに注入されます

window.process = window.process || {};
window.process.env = window.process.env || {};

// 本番環境では、ビルド時にVercelの環境変数が置換されます
// __VITE_GOOGLE_CLIENT_ID__ と __VITE_API_KEY__ は、
// ビルドプロセスで実際の値に置換されるプレースホルダーです
window.process.env.REACT_APP_GOOGLE_CLIENT_ID = '__VITE_GOOGLE_CLIENT_ID__';
window.process.env.API_KEY = '__VITE_API_KEY__';

console.log('env-config.production.js loaded.');
console.log('REACT_APP_GOOGLE_CLIENT_ID:', window.process.env.REACT_APP_GOOGLE_CLIENT_ID ? 'Set' : 'Not Set');
console.log('API_KEY:', window.process.env.API_KEY ? 'Set' : 'Not Set'); 