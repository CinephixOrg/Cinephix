import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const baseStyle = `
  font-family: Arial, sans-serif;
  max-width: 480px;
  margin: 0 auto;
  background: #1a1a2e;
  color: #e0e0e0;
  border-radius: 12px;
  padding: 32px;
`;

export const sendVerificationEmail = async (email, code) => {
  await transporter.sendMail({
    from: `"Cinephix" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Cinephix - Email Doğrulama Kodun',
    html: `
      <div style="${baseStyle}">
        <h2 style="color:#6ee7b7;margin-bottom:8px;">Cinephix 🎬</h2>
        <p>Hesabını doğrulamak için aşağıdaki 6 haneli kodu gir:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#6ee7b7;text-align:center;padding:20px 0;">
          ${code}
        </div>
        <p style="font-size:12px;color:#9ca3af;">Bu kod 15 dakika geçerlidir. Eğer bu işlemi sen yapmadıysan bu emaili görmezden gel.</p>
      </div>
    `,
  });
};

export const sendPasswordResetEmail = async (email, code) => {
  await transporter.sendMail({
    from: `"Cinephix" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Cinephix - Şifre Sıfırlama Kodun',
    html: `
      <div style="${baseStyle}">
        <h2 style="color:#6ee7b7;margin-bottom:8px;">Cinephix 🎬</h2>
        <p>Şifreni sıfırlamak için aşağıdaki 6 haneli kodu gir:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#6ee7b7;text-align:center;padding:20px 0;">
          ${code}
        </div>
        <p style="font-size:12px;color:#9ca3af;">Bu kod 15 dakika geçerlidir. Eğer bu işlemi sen yapmadıysan şifren güvende, bu emaili görmezden gelebilirsin.</p>
      </div>
    `,
  });
};
