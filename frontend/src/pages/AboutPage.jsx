import cinephixLogo from "../assets/cinephix_logo.svg";

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="flex items-center gap-3 mb-8">
        <img src={cinephixLogo} alt="Cinephix" className="w-10 h-10" />
        <h1 className="text-3xl font-bold text-primary">About Cinephix</h1>
      </div>

      <div className="prose prose-sm max-w-none space-y-6 text-base-content/80">
        <section>
          <h2 className="text-xl font-semibold text-base-content mb-2">What is Cinephix?</h2>
          <p>
            Cinephix is a social platform built for film and series enthusiasts. Whether you're a
            casual viewer or a dedicated cinephile, Cinephix gives you the tools to discover new
            content, track what you've watched, share your opinions, and connect with people who
            share your taste.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-base-content mb-2">Our Mission</h2>
          <p>
            We believe great stories bring people together. Our mission is to create a space where
            movie and series lovers can express themselves, find their next favorite watch, and
            build meaningful connections around shared cinematic experiences.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-base-content mb-2">Features</h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li>Discover trending movies and series from across the globe</li>
            <li>Rate, review, and build your personal watchlist</li>
            <li>Follow friends and see what they're watching</li>
            <li>Use CineMatch to find users with similar taste</li>
            <li>Join community groups and chat in real time</li>
            <li>Send direct messages to fellow film lovers</li>
            <li>Get notified about activity from the people you follow</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-base-content mb-2">The Team</h2>
          <p>
            Cinephix was created by a small and passionate team of developers who are themselves
            avid film fans. We built this platform because we wanted it to exist — and we're
            committed to keeping it growing.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-base-content mb-2">Get in Touch</h2>
          <p>
            Have feedback, suggestions, or just want to say hello? Reach us at{" "}
            <a
              href="mailto:cinephix3@gmail.com"
              className="text-primary hover:underline"
            >
              cinephix3@gmail.com
            </a>{" "}
            or follow us on{" "}
            <a
              href="https://www.instagram.com/cinephixofficial/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Instagram
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
