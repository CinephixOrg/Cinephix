// Every profile in the app is public: there is no private mode and no follow
// request, and nothing on the server checks either any more.
//
// These flags are still sent on every profile-facing response because app
// builds from before private accounts were removed read them — and treat a
// missing `isAuthorized` as "this profile is private", which walled off every
// profile once the flags stopped arriving. Sending them hardcoded keeps those
// builds working; the current apps simply ignore them.

/** For the profile itself (GET /users/profile/:id, GET /users/me). */
export const PUBLIC_PROFILE = Object.freeze({ visibility: "public", isAuthorized: true, isRequested: false });

/** For the data shown on a profile: favorites, CineGraph, lists, genre detail. */
export const PUBLIC_ACCESS = Object.freeze({ isAuthorized: true });
