import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

export const configurePassport = () => {
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
              user = await User.create({
                googleId: profile.id,
                username: `${baseUsername}_${suffix}`,
                email: profile.emails[0].value,
                profile_pic_url: profile.photos?.[0]?.value || '',
                isEmailVerified: true,
              });
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
