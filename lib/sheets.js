/**
 * Google Sheets helper — uses GOOGLE_SHEETS_KEY_B64 env var.
 * Compatible with local dev (.env.local) and Railway/Vercel (env vars).
 */
import { google } from 'googleapis';

let _auth = null;

function getAuth() {
  if (_auth) return _auth;

  const b64 = process.env.GOOGLE_SHEETS_KEY_B64;
  if (!b64) throw new Error('GOOGLE_SHEETS_KEY_B64 env var not set');

  const key = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));

  _auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  return _auth;
}

export async function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
}

export const SHEETS_ID = process.env.SHEETS_ID || '1fuHe6FPZdUi0S2HJidEqqPdJ06BSqhO3DTV33Yz4_6c';
export const USA_SHEET  = 'USA Research Tracker';
