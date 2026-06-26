export const metadata = {
  title: "Privacy policy",
  description: "How Haystackk collects, uses, and protects your information.",
};

const UPDATED = "21 June 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-text-muted">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 py-2">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-text">Privacy policy</h1>
        <p className="text-sm text-text-muted">Last updated: {UPDATED}</p>
      </header>

      <Section title="Overview">
        <p>
          Haystackk is a movie and TV discovery service. This policy explains what information we
          collect, how we use it, and the choices you have. By using Haystackk you agree to the
          practices described here.
        </p>
      </Section>

      <Section title="Information we collect">
        <p>
          <span className="font-medium text-text">Account information.</span> When you sign in, our
          authentication provider (Clerk) handles your sign-in and stores the details you provide,
          such as your name and email address. We do not see or store your password.
        </p>
        <p>
          <span className="font-medium text-text">Activity you create.</span> Features you use
          generate data tied to your account, such as ratings, watchlist and favourites, lists,
          diary entries, taste preferences, and saved TV-guide channels. This is used to power your
          personalised recommendations and the features you opt into.
        </p>
        <p>
          <span className="font-medium text-text">Technical and usage data.</span> Like most
          websites, we and our infrastructure providers automatically receive standard information
          such as your IP address, device and browser type, and pages viewed, used to operate,
          secure, and improve the service.
        </p>
      </Section>

      <Section title="How we use your information">
        <ul className="list-disc space-y-1 pl-5">
          <li>To provide and personalise the service, including recommendations and your saved data.</li>
          <li>To operate, maintain, secure, and improve Haystackk.</li>
          <li>To respond to your questions and feedback.</li>
          <li>To comply with legal obligations and prevent abuse.</li>
        </ul>
      </Section>

      <Section title="Cookies and similar technologies">
        <p>
          We use cookies and similar technologies that are necessary for the site to work, including
          keeping you signed in. You can control cookies through your browser settings, though some
          features may not work without them.
        </p>
        <p>
          We also use <span className="font-medium text-text">Google Analytics</span> to understand
          how the site is used (for example, which pages and features are popular, and where things
          are slow) so we can improve it. These analytics cookies are optional: they are off by
          default, and we only set them after you accept the consent banner. Until you accept, Google
          Analytics runs in a cookieless mode that stores nothing on your device, and if you decline
          it stays that way. The data collected is aggregate and anonymous, such as the pages you
          visit, your approximate region, and your device type; we do not use it to identify you or
          sell it. You can change your choice anytime by clearing this site&apos;s data in your
          browser, which brings the banner back.
        </p>
      </Section>

      <Section title="Third-party services">
        <p>We rely on trusted third parties to run Haystackk. Each handles data under its own policy:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-text">Clerk</span> for sign-in and account management.
          </li>
          <li>
            <span className="font-medium text-text">The Movie Database (TMDB)</span> for catalogue
            data. This product uses the TMDB API but is not endorsed or certified by TMDB.
          </li>
          <li>
            <span className="font-medium text-text">JustWatch</span> for streaming availability data.
          </li>
          <li>
            <span className="font-medium text-text">Google Analytics</span> for anonymous,
            consent-based usage measurement (see Cookies and similar technologies above).
          </li>
          <li>
            <span className="font-medium text-text">Hosting and infrastructure providers</span> that
            run the application and database.
          </li>
        </ul>
        <p>
          We may also display advertising and use affiliate links (for example, links to where a
          title can be streamed, rented, or seen in cinemas). Advertising and affiliate partners may
          use cookies to measure performance. We may earn a commission from qualifying purchases made
          through these links, at no extra cost to you.
        </p>
      </Section>

      <Section title="Data retention">
        <p>
          We keep account and activity data for as long as your account is active. If you delete your
          account, the associated data is removed, except where we need to retain limited information
          to meet legal or security obligations.
        </p>
      </Section>

      <Section title="Your choices and rights">
        <p>
          You can view and manage the data you create within the app, and you can delete your
          account at any time. Depending on where you live, you may have additional rights to access,
          correct, or delete your personal information. To make a request, contact us using the
          details below.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Haystackk is not directed to children under 13, and we do not knowingly collect personal
          information from them. If you believe a child has provided us information, please contact us
          and we will remove it.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this policy from time to time. When we do, we will revise the date at the top
          of this page. Significant changes will be made clear within the service.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about this policy or your data? Email{" "}
          <a href="mailto:hello@haystackk.com" className="underline hover:text-text">
            hello@haystackk.com
          </a>
          .
        </p>
      </Section>
    </div>
  );
}
