import Header from "@/components/Header";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050818] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-indigo-700/25 blur-[140px]" />
        <div className="absolute -right-32 top-24 h-[500px] w-[500px] rounded-full bg-cyan-600/15 blur-[140px]" />
      </div>
      <div className="relative mx-auto max-w-3xl px-5 py-8 md:px-10">
        <Header />
        <div className="mt-12 mb-16">
          <h1 className="text-4xl font-black text-white">Privacy Policy</h1>
          <p className="mt-2 text-sm text-white/40">Last updated: May 2026</p>

          <div className="mt-10 space-y-10 text-sm leading-7 text-white/60">

            <section>
              <h2 className="mb-3 text-lg font-black text-white">1. Overview</h2>
              <p>StudyPack.ai ("we", "our", "us") is committed to protecting your privacy. This policy explains what information we collect, how we use it, and your rights regarding that information.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-black text-white">2. Information we collect</h2>
              <p className="mb-3">We collect the following types of information:</p>
              <ul className="space-y-2 pl-4">
                <li><span className="text-white/80 font-semibold">Account information</span> — your name and email address, collected via Clerk authentication when you sign up.</li>
                <li><span className="text-white/80 font-semibold">Uploaded files</span> — lecture transcripts, slides, and documents you upload for generation. These are processed and deleted after your pack is created.</li>
                <li><span className="text-white/80 font-semibold">Usage data</span> — credits used, packs generated, and subjects created. Stored in our database to power your dashboard.</li>
                <li><span className="text-white/80 font-semibold">Payment information</span> — handled entirely by Stripe. We never store your card details.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-black text-white">3. How we use your information</h2>
              <ul className="space-y-2 pl-4">
                <li>To generate and deliver your study packs</li>
                <li>To manage your account, credits, and dashboard</li>
                <li>To process payments via Stripe</li>
                <li>To respond to support requests</li>
                <li>To improve our service (aggregate, anonymised usage data only)</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-black text-white">4. Your uploaded content</h2>
              <p>Your uploaded lecture files are used solely to generate your study pack. We do not share this content with third parties, use it to train AI models, or store it beyond the time needed to complete generation. Generated PDFs are stored securely on our servers and accessible only to you.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-black text-white">5. Data sharing</h2>
              <p>We do not sell your personal data. We share data only with the following service providers who help us operate the platform:</p>
              <ul className="mt-3 space-y-2 pl-4">
                <li><span className="text-white/80 font-semibold">Clerk</span> — authentication and user management</li>
                <li><span className="text-white/80 font-semibold">Supabase</span> — database storage (hosted in Sydney, Australia)</li>
                <li><span className="text-white/80 font-semibold">Stripe</span> — payment processing</li>
                <li><span className="text-white/80 font-semibold">Vercel</span> — frontend hosting</li>
                <li><span className="text-white/80 font-semibold">Google Cloud</span> — translation services (text content only, no personal data)</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-black text-white">6. Data retention</h2>
              <p>We retain your account information and generated packs for as long as your account is active. You may request deletion of your account and associated data at any time by contacting us. Uploaded source files are deleted immediately after generation completes.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-black text-white">7. Security</h2>
              <p>We use industry-standard security measures including HTTPS encryption, secure database storage, and access controls. No method of transmission over the internet is 100% secure, but we take reasonable steps to protect your information.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-black text-white">8. Your rights</h2>
              <p>You have the right to access, correct, or delete your personal data. You may also request a copy of the data we hold about you. To exercise these rights, contact us at <a href="mailto:support@studypack.ai" className="text-indigo-400 hover:underline">support@studypack.ai</a>.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-black text-white">9. Cookies</h2>
              <p>We use essential cookies for authentication (via Clerk) and session management. We do not use advertising or tracking cookies. You can control cookies through your browser settings.</p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-black text-white">10. Contact</h2>
              <p>For privacy-related questions or requests, contact us at <a href="mailto:support@studypack.ai" className="text-indigo-400 hover:underline">support@studypack.ai</a> or via our <Link href="/contact" className="text-indigo-400 hover:underline">contact page</Link>.</p>
            </section>

          </div>
        </div>
      </div>
    </main>
  );
}
