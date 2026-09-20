import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';
import { TERMS_VERSION } from '../utils/legal.js';

export const configurePassport = () => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('[Passport] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing — Google OAuth disabled');
    return;
  }
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          'http://localhost:5000/api/users/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ googleId: profile.id });

          if (!user) {
            user = await User.findOne({ email: profile.emails[0].value });
            if (user) {
              user.googleId = profile.id;
              user.isEmailVerified = true;
              if (!user.profile_pic_url && profile.photos?.[0]?.value) {
                user.profile_pic_url = profile.photos[0].value;
              }
              await user.save();
            } else {
              const baseUsername = profile.displayName
                .replace(/\s+/g, '_')
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, '');
              const suffix = Math.random().toString(36).slice(2, 6);
              // Signing in with Google is itself the agreement: the button
              // carries the same "by continuing you agree" line the register
              // screen shows (mobile/app/(auth)).
              user = await User.create({
                googleId: profile.id,
                username: `${baseUsername}_${suffix}`,
                email: profile.emails[0].value,
                profile_pic_url: profile.photos?.[0]?.value || '',
                isEmailVerified: true,
                termsAcceptedAt: new Date(),
                termsVersion: TERMS_VERSION,
              });
              return done(null, user, { isNewOAuthUser: true });
            }
          }

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
};
