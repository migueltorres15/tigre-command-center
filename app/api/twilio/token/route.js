export const dynamic = 'force-dynamic';
import twilio from 'twilio';

export async function GET() {
  try {
    const ACCOUNT_SID    = process.env.TWILIO_ACCOUNT_SID;
    const API_KEY_SID    = process.env.TWILIO_API_KEY_SID;
    const API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET;
    const TWIML_APP_SID  = process.env.TWILIO_TWIML_APP_SID;

    if (!ACCOUNT_SID || !API_KEY_SID || !API_KEY_SECRET || !TWIML_APP_SID) {
      return Response.json({ error: 'Twilio env vars not configured' }, { status: 500 });
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant  = AccessToken.VoiceGrant;

    const token = new AccessToken(ACCOUNT_SID, API_KEY_SID, API_KEY_SECRET, {
      identity: 'tigre-agent',
      ttl: 3600,
    });

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWIML_APP_SID,
      incomingAllow: false,
    });

    token.addGrant(voiceGrant);

    return Response.json({ token: token.toJwt() });
  } catch (error) {
    console.error('Twilio token error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
