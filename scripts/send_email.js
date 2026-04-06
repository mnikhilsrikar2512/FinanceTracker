const nodemailer = require('nodemailer');

function readPayload() {
  return new Promise((resolve, reject) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(input || '{}'));
      } catch (error) {
        reject(new Error(`Invalid mail payload: ${error.message}`));
      }
    });
    process.stdin.on('error', reject);
  });
}

function normalizePassword(password) {
  return String(password || '').replace(/\s+/g, '');
}

async function main() {
  const payload = await readPayload();
  const host = String(payload.host || 'smtp.gmail.com').trim();
  const port = Number(payload.port || 587);
  const user = String(payload.user || '').trim();
  const password = normalizePassword(payload.password);
  const fromEmail = String(payload.fromEmail || user).trim();
  const fromName = String(payload.fromName || 'Finly Support').trim();
  const toEmail = String(payload.toEmail || '').trim();
  const subject = String(payload.subject || '').trim();
  const html = String(payload.html || '').trim();
  const text = String(payload.text || '').trim();

  if (!user || !password || !toEmail || !subject) {
    throw new Error('Missing required SMTP or message fields');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: {
      user,
      pass: password,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: toEmail,
    subject,
    text: text || undefined,
    html: html || undefined,
  });

  process.stdout.write(JSON.stringify({ ok: true }));
}

main().catch((error) => {
  process.stderr.write(error.message || String(error));
  process.exit(1);
});
