#!/usr/bin/env python3
"""
Mueve emails de FormSubmit del Spam al Inbox automáticamente.
Corre cada hora via LaunchAgent.
"""
import imaplib, ssl, logging, os

logging.basicConfig(
    filename=os.path.expanduser('~/Library/Logs/tigre-fix-spam.log'),
    level=logging.INFO,
    format='%(asctime)s %(message)s'
)

IMAP_HOST = 'imap.secureserver.net'
IMAP_PORT = 993
USER = 'hola@tigrestudio.mx'
PASS = 'Oroazul21'
SENDERS = [b'formsubmit', b'submissions@formsubmit.co']

try:
    ctx = ssl.create_default_context()
    with imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT, ssl_context=ctx) as mail:
        mail.login(USER, PASS)
        mail.select('Spam')
        _, data = mail.search(None, 'ALL')
        ids = data[0].split()
        moved = 0
        for uid in ids:
            _, msg_data = mail.fetch(uid, '(BODY[HEADER.FIELDS (FROM)])')
            from_header = msg_data[0][1].lower()
            if any(s in from_header for s in SENDERS):
                mail.copy(uid, 'INBOX')
                mail.store(uid, '+FLAGS', '\\Deleted')
                moved += 1
        mail.expunge()
        if moved:
            logging.info(f"Moved {moved} FormSubmit email(s) from Spam → Inbox")
except Exception as e:
    logging.error(f"Error: {e}")
