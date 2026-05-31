export const dynamic = 'force-dynamic';
import twilio from 'twilio';

export async function POST(request) {
  try {
    const CALLER_ID = process.env.TWILIO_PHONE_NUMBER || '+17373398878';
    const body = await request.text();
    const params = new URLSearchParams(body);
    const to = params.get('To');

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    if (to) {
      const dial = twiml.dial({ callerId: CALLER_ID, timeout: 30 });
      // Normalize to E.164
      const digits = to.replace(/\D/g, '');
      const e164 = digits.length === 10 ? `+1${digits}`
                 : digits.length === 11 && digits[0] === '1' ? `+${digits}`
                 : `+${digits}`;
      dial.number(e164);
    } else {
      twiml.say('No number provided.');
    }

    return new Response(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('Twilio voice error:', error);
    return new Response('<Response><Say>Error</Say></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
