import nodemailer from 'nodemailer';
import { EMAIL_USER, EMAIL_APP_PASSWORD, OTP_EXPIRY_MINUTES, validateEmailConfig } from '@/config/email';
import { buildVerificationEmailHtml } from './email-templates/verification';

// Create transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const config = validateEmailConfig();
    if (!config.valid) {
      throw new Error(`Email configuration missing: ${config.missing.join(', ')}`);
    }
    
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

/**
 * Send verification email with OTP
 * @param name - User's display name for personalised greeting (optional)
 */
export async function sendVerificationEmail(email: string, otp: string, name?: string): Promise<void> {
  try {
    // Calculate dynamic expiry time (WIB/Asia/Bangkok)
    const expiryDate = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    const expiryTime = expiryDate.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Bangkok',
      hourCycle: 'h23',
    });

    const mailOptions = {
      from: `"MI-Labs" <${EMAIL_USER}>`,
      to: email,
      subject: 'Kode Verifikasi Email MI-Labs',
      html: buildVerificationEmailHtml(otp, expiryTime, name),
    };

    await getTransporter().sendMail(mailOptions);
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw new Error('Gagal mengirim email verifikasi');
  }
}

/**
 * Reset transporter (useful for testing)
 */
export function resetTransporter(): void {
  transporter = null;
}