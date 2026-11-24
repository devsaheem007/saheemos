import 'dotenv/config';

const need = (k) => {
  if (!process.env[k]) throw new Error(`Missing required environment variable: ${k}`);
  return process.env[k];
};

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = need('JWT_SECRET');
if (nodeEnv === 'production' && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

export const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  port: Number(process.env.PORT || 5000),
  mongoUri: need('MONGODB_URI'),
  jwtSecret,
  jwtExpires: process.env.JWT_EXPIRES || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  libraryFinePerDay: Number(process.env.LIBRARY_FINE_PER_DAY || 10),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'SaheemOS <no-reply@localhost>',
  },
  sms: {
    provider: (process.env.SMS_PROVIDER || '').toLowerCase(), // 'twilio' | 'http' | '' (off)
    countryCode: process.env.SMS_COUNTRY_CODE || '92',
    twilio: { sid: process.env.SMS_TWILIO_SID || '', token: process.env.SMS_TWILIO_TOKEN || '', from: process.env.SMS_TWILIO_FROM || '' },
    http: { url: process.env.SMS_HTTP_URL || '', method: process.env.SMS_HTTP_METHOD || 'GET', body: process.env.SMS_HTTP_BODY || '', headers: process.env.SMS_HTTP_HEADERS || '' },
  },
  gatewayWebhookSecret: process.env.GATEWAY_WEBHOOK_SECRET || '',
  seed: {
    name: process.env.SEED_OWNER_NAME || 'School Owner',
    email: process.env.SEED_OWNER_EMAIL || '',
    password: process.env.SEED_OWNER_PASSWORD || '',
  },
};
