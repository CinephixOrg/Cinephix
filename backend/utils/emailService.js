import nodemailer from 'nodemailer';

const baseStyle = `
  font-family: Arial, sans-serif;
  max-width: 480px;
  margin: 0 auto;
  background: #1a1a2e;
  color: #e0e0e0;
  border-radius: 12px;
  padding: 32px;
`;

const getTransporter = () =>
  nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

export const sendVerificationEmail = async (email, code) => {
  await getTransporter().sendMail({
    from: `"Cinephix" <${process.env.EMAIL_USER}>`,
    replyTo: process.env.EMAIL_USER,
    to: email,
    subject: 'Cinephix - Your Email Verification Code',
    headers: {
      'X-Mailer': 'Cinephix Mailer',
      'X-Priority': '3',
    },
    html: `
      <div style="${baseStyle}">
        <h2 style="color:#6ee7b7;margin-bottom:8px;">Cinephix</h2>
        <p>Enter the 6-digit code below to verify your account:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#6ee7b7;text-align:center;padding:20px 0;">
          ${code}
        </div>
        <p style="font-size:12px;color:#9ca3af;">This code is valid for 15 minutes. If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  });
};

export const sendPasswordResetEmail = async (email, code) => {
  await getTransporter().sendMail({
    from: `"Cinephix" <${process.env.EMAIL_USER}>`,
    replyTo: process.env.EMAIL_USER,
    to: email,
    subject: 'Cinephix - Your Password Reset Code',
    headers: {
      'X-Mailer': 'Cinephix Mailer',
      'X-Priority': '3',
    },
    html: `
      <div style="${baseStyle}">
        <h2 style="color:#6ee7b7;margin-bottom:8px;">Cinephix</h2>
        <p>Enter the 6-digit code below to reset your password:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#6ee7b7;text-align:center;padding:20px 0;">
          ${code}
        </div>
        <p style="font-size:12px;color:#9ca3af;">This code is valid for 15 minutes. If you did not request a password reset, your account is safe and you can ignore this email.</p>
      </div>
    `,
  });
};
