import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Club Rugby Tipping",
  description: "How Club Rugby Tipping collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  const section = "mb-8";
  const heading = "font-display text-lg sm:text-xl uppercase tracking-wide text-white mb-3";
  const paragraph = "text-sm sm:text-[15px] leading-relaxed text-[#C0C5CF] mb-3";
  const list = "text-sm sm:text-[15px] leading-relaxed text-[#C0C5CF] list-disc pl-5 mb-3 space-y-1";

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="block w-[26px] h-[3px] rounded-full shrink-0" style={{ background: "var(--accent)" }} />
          <span className="text-xs font-bold uppercase tracking-widest text-[#8C93A0]">Legal</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl uppercase text-white leading-none mb-3">
          Privacy Policy<span style={{ color: "var(--accent)" }}>.</span>
        </h1>
        <p className="text-sm text-[#8C93A0]">Last updated: 22 July 2025</p>
      </div>

      <div className={section}>
        <h2 className={heading}>What we collect</h2>
        <p className={paragraph}>
          When you create an account and use Club Rugby Tipping, we collect the following information:
        </p>
        <ul className={list}>
          <li>Email address (used for sign-in and account identification)</li>
          <li>Display name (shown on the leaderboard and to other users)</li>
          <li>Your tipping picks and margin predictions each round</li>
          <li>Supported team (if you choose to set one)</li>
          <li>Push notification device token (if you opt in to notifications)</li>
        </ul>
      </div>

      <div className={section}>
        <h2 className={heading}>How you sign in</h2>
        <p className={paragraph}>
          We use magic link email authentication powered by Supabase Auth. When you sign in, we send a one-time link to
          your email address. We do not store passwords.
        </p>
      </div>

      <div className={section}>
        <h2 className={heading}>How we use your data</h2>
        <p className={paragraph}>
          Your data is used to run the tipping competition: recording your picks, calculating scores, displaying the
          leaderboard, and sending you notifications about upcoming rounds or results (if you opt in).
        </p>
        <p className={paragraph}>
          We do not sell your data or share it with third parties for marketing purposes.
        </p>
      </div>

      <div className={section}>
        <h2 className={heading}>Analytics</h2>
        <p className={paragraph}>
          We use Meta Pixel (Facebook) to measure the performance of our advertising campaigns and understand how users
          find our site. Meta Pixel collects anonymised usage data such as page views and may use cookies. No personal
          tipping data is shared with Meta.
        </p>
      </div>

      <div className={section}>
        <h2 className={heading}>Push notifications</h2>
        <p className={paragraph}>
          Push notifications are entirely optional. If you enable them in the app, we store your device token so we can
          send you reminders when tips are due or when results come in. You can disable notifications at any time through
          the app or your device settings. We automatically remove tokens for devices that are no longer registered.
        </p>
      </div>

      <div className={section}>
        <h2 className={heading}>Where your data is stored</h2>
        <p className={paragraph}>
          Your data is stored securely using Supabase, with servers located in New Zealand and the United States.
          All data is transmitted over encrypted connections (HTTPS/TLS).
        </p>
      </div>

      <div className={section}>
        <h2 className={heading}>Deleting your account</h2>
        <p className={paragraph}>
          You can request deletion of your account and all associated data by contacting us. We will remove your data
          within a reasonable timeframe.
        </p>
      </div>

      <div className={section}>
        <h2 className={heading}>Contact us</h2>
        <p className={paragraph}>
          If you have questions about this privacy policy or want to request account deletion, get in touch:
        </p>
        <ul className={list}>
          <li><a href="mailto:support@clubrugbytipping.com" className="underline" style={{ color: "var(--accent)" }}>support@clubrugbytipping.com</a></li>
          <li><a href="mailto:john.dazley@gmail.com" className="underline" style={{ color: "var(--accent)" }}>john.dazley@gmail.com</a></li>
        </ul>
      </div>
    </div>
  );
}
