import React, { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { BUSINESS } from '../utils/business';
import { AD_CLICK_USD, AD_VIEW_USD, RANK_WINDOW_DAYS, VISIT_WINDOW_HOURS } from '../utils/rules';

export type LegalDoc = 'rules' | 'terms' | 'privacy' | 'refunds';

export const LEGAL_PATHS: Record<LegalDoc, string> = {
  rules: '/rules',
  terms: '/terms',
  privacy: '/privacy',
  refunds: '/refunds',
};

const CONTACT_EMAIL = BUSINESS.email;
const LAST_UPDATED = 'October 1, 2026';

interface Section {
  heading: string;
  body: string[];
}

const DOCS: Record<LegalDoc, { title: string; intro: string; sections: Section[] }> = {
  rules: {
    title: 'Rules',
    intro: `FreeBids is a free public board. Anyone can list a website or X profile, and rank is decided by one number: visits each listing's own link brought in the last ${RANK_WINDOW_DAYS} days. Money cannot buy rank.`,
    sections: [
      {
        heading: 'How ranking works',
        body: [
          'Every listing has its own referral link (freebids.lol/f/your-listing). Visitors who open it count toward that listing.',
          `A visitor counts at most once per listing every ${VISIT_WINDOW_HOURS} hours, and so does one internet connection (IP address). Visits only count after an automatic human check.`,
          `Rank is the number of counted visits in the last ${RANK_WINDOW_DAYS} days. Older visits roll off continuously, so a listing has to keep bringing people to hold its spot.`,
          'Equal counts stay in listing order: the listing listed first keeps the higher rank.',
          'Clicks from FreeBids to your site are shown on your listing but do not affect rank.',
        ],
      },
      {
        heading: 'Rank #1',
        body: [
          'The listing with the most visits in the window is #1 and sits at the top of the front page.',
          'It keeps that spot until another listing brings more visits over the same window.',
        ],
      },
      {
        heading: 'Verification',
        body: [
          'Only verified listings are ranked, so nobody can list a business that is not theirs.',
          'Websites verify by adding a meta tag we give you to their homepage, or by linking to their FreeBids link from the listed page.',
          'X profiles verify by adding the code or their FreeBids link to their bio. A moderator checks it, usually within 24 hours.',
        ],
      },
      {
        heading: 'Fair play',
        body: [
          'Bots, scripts, click farms, paid traffic services, incentivised visits ("visit my link for a reward"), and repeatedly opening your own link from many devices or connections are not allowed.',
          'We watch each listing\'s daily visits. A listing with traffic we believe is fake can have those visits discarded, be hidden, or be removed, without notice.',
        ],
      },
      {
        heading: 'Sponsored strip',
        body: [
          `Verified listings can buy prepaid ad credit to appear in the Sponsored box next to the board. Credit is spent at $${(AD_VIEW_USD * 1000).toFixed(2)} per 1,000 viewers and $${AD_CLICK_USD.toFixed(2)} per click through to the listing's site.`,
          'A viewer or click is charged at most once per sponsor per person per day. The ad pauses automatically when the credit runs out.',
          'Sponsored listings are clearly labeled. A sponsorship never changes a listing\'s rank.',
        ],
      },
      {
        heading: 'What you can list',
        body: [
          'A product website, or an X @handle, that you own or are authorised to promote.',
          'Links to App Store, Google Play, GitHub, Chrome Web Store and similar platforms are keyed by their path, so different apps and repos never share a listing.',
          'Chat and invite links are not allowed: Telegram, WhatsApp, Discord invites, Messenger, Signal and similar. The board is for products and profiles, not group chats.',
          'No sexual or adult content, gambling, scams, phishing, malware, or illegal products and services.',
          'Query strings are removed from links, so affiliate and tracking links will not work. Short links are replaced by the page they redirect to.',
          'Listing names and taglines cannot contain links, hate speech, slurs or harassment, and cannot impersonate another person or brand.',
        ],
      },
      {
        heading: 'Moderation',
        body: [
          `We can take down a listing that breaks these rules, including after it goes live. Email ${CONTACT_EMAIL} to correct a mistake in your listing's name, tagline, category or color.`,
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    intro: `These Terms govern your use of FreeBids (freebids.lol), which is owned and operated by ${BUSINESS.name}. "We", "us" and "FreeBids" mean ${BUSINESS.name}. By using the site, adding a listing or buying a sponsorship you agree to these Terms and the Rules. If you do not agree, do not use FreeBids.`,
    sections: [
      {
        heading: 'Who we are',
        body: [
          `${BUSINESS.name} is an enterprise registered in India under the MSME Udyam scheme (Udyam Registration No. ${BUSINESS.udyam}).`,
          `Registered address: ${BUSINESS.address}. Email: ${BUSINESS.email}.`,
        ],
      },
      {
        heading: '1. Free listings',
        body: [
          'Listing is free. Rank is decided only by verified referred visitors, as described in the Rules, and can change at any time.',
          'We make no promise about how many visitors or clicks any rank will bring, and we may change how ranking works, reset counts after abuse, or end the service.',
        ],
      },
      {
        heading: '2. Sponsorships',
        body: [
          'A sponsorship is prepaid credit for a labeled placement in the Sponsored strip, spent per viewer and per click as described in the Rules. It does not buy or change rank.',
          'A sponsorship is advertising. It is not an investment, bet or security, and it has no cash value.',
          'Sponsorships are booked by email: we reply with the price in US dollars and payment details, and the slot starts once payment is received. FreeBids never asks for or stores your full card details by email. See the Refund Policy.',
          'You must be at least 18 (or the age of majority where you live) to buy a sponsorship.',
        ],
      },
      {
        heading: '3. Your content and traffic',
        body: [
          'You confirm you own or have the right to promote the website or profile you list, and that it and your listing text follow the Rules. You grant us a licence to display your name, tagline and logo on FreeBids and in images that share the board.',
          'You will not send fake or automated traffic to any referral link. Logos are fetched automatically from the website or profile you enter.',
        ],
      },
      {
        heading: '4. Liability',
        body: [
          'FreeBids is provided "as is" without warranties of any kind. To the maximum extent permitted by law, our total liability to you is limited to the amount you paid us in the 30 days before the claim.',
        ],
      },
      {
        heading: '5. Governing law',
        body: [
          'These Terms are governed by the laws of India. Courts in Bengaluru, Karnataka have exclusive jurisdiction, except where the law of your country gives you the right to bring a claim locally.',
        ],
      },
      {
        heading: '6. Grievances',
        body: [
          `Complaints about listings or payments go to the Grievance Officer, ${BUSINESS.name}, at ${BUSINESS.email} or the registered address above. We acknowledge complaints within 48 hours and aim to resolve them within 15 days.`,
        ],
      },
      {
        heading: '7. Changes',
        body: ['We may update these Terms. Continued use after an update means you accept the new version.'],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro: `FreeBids is operated by ${BUSINESS.name} (${BUSINESS.city}), which is responsible for the personal data described here. There are no accounts; we collect as little as we need to run the board.`,
    sections: [
      {
        heading: 'What we collect',
        body: [
          'Listings: the website or handle, listing text, and the email you optionally give for updates.',
          'Sponsorships: your booking emails, the amount, and the payment reference from whichever payment method we agree on. We never store your full card number.',
          `Referral visits: an anonymous browser ID, the listing visited, the time of the visit, and a one-way salted hash of your IP address. We never store the raw IP for visits; the hash only lets us count one visit per connection per listing every ${VISIT_WINDOW_HOURS} hours. Visit records are deleted after about 8 days.`,
          'Usage data: pages visited, clicks on listings, and your IP address for rate limiting and abuse prevention.',
          'Visits through referral links pass an invisible Cloudflare Turnstile check, which Cloudflare processes to tell people from bots.',
        ],
      },
      {
        heading: 'What is public',
        body: ['Every listing on the board is public: name, tagline, logo, link, weekly visit count, click count and whether it is sponsored. Your email is never shown.'],
      },
      {
        heading: 'Who we share it with',
        body: [
          'Our payment provider (for sponsorships), Cloudflare (bot checks), Supabase (database), Vercel (hosting and basic analytics) and PostHog (product analytics). Each processes data only to provide its service to us. We do not sell your data.',
        ],
      },
      {
        heading: 'Your choices',
        body: [`Email ${CONTACT_EMAIL} to get a copy of your data or have your email removed from our records.`],
      },
    ],
  },
  refunds: {
    title: 'Refund Policy',
    intro: 'Listing is free. This policy covers paid sponsorships.',
    sections: [
      {
        heading: 'Unused credit',
        body: [
          `Email ${CONTACT_EMAIL} to stop a sponsorship. We may refund credit that has not been spent yet; credit already spent on viewers and clicks is not refundable. A refunded sponsorship ends immediately.`,
        ],
      },
      {
        heading: 'Rank changes',
        body: ['A sponsorship never affected rank, so changes in rank are never a reason for a refund.'],
      },
      {
        heading: 'Listings we take down',
        body: [
          'If we remove a listing for breaking the Rules (including fake traffic), its sponsorship is not refunded, except where required by law.',
        ],
      },
      {
        heading: 'Disputes',
        body: [`Please email ${CONTACT_EMAIL} before filing a card dispute; we respond within 48 hours. A disputed sponsorship ends immediately.`],
      },
    ],
  },
};

interface LegalPageProps {
  doc: LegalDoc;
  onBack: () => void;
  onNavigate: (path: string) => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({ doc, onBack, onNavigate }) => {
  const content = DOCS[doc];

  useEffect(() => {
    document.title = `${content.title} – FreeBids`;
  }, [content.title]);

  return (
    <div className="max-w-3xl mx-auto px-4 pt-8 pb-12">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 label-sm hover:text-accent mb-6 cursor-pointer">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <h1 className="font-display text-2xl sm:text-4xl font-semibold text-ink">{content.title}</h1>
      <p className="text-xs text-dim mt-2">Last updated {LAST_UPDATED}</p>
      <p className="text-base text-muted mt-6 leading-relaxed">{content.intro}</p>

      <div className="mt-10 space-y-4">
        {content.sections.map((section, i) => (
          <section key={section.heading} className="card rounded-2xl p-5 sm:p-6">
            <h2 className="flex items-baseline gap-3 font-display text-base font-semibold text-ink mb-3">
              <span className="text-xs text-accent">{String(i + 1).padStart(2, '0')}</span>
              {section.heading}
            </h2>
            <ul className="space-y-2.5 list-none">
              {section.body.map((para) => (
                <li key={para} className="relative pl-4 text-sm text-muted leading-relaxed before:absolute before:left-0 before:top-[0.6em] before:h-1 before:w-1 before:rounded-full before:bg-accent/70">
                  {para}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-10 pt-6 border-t border-line text-xs text-muted">
        Questions? Email <a className="text-accent underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        <p className="mt-2 text-dim">
          FreeBids is operated by {BUSINESS.name}, Udyam Registration No. {BUSINESS.udyam}. {BUSINESS.address}.
        </p>
        <div className="flex flex-wrap gap-5 mt-4">
          {(Object.keys(LEGAL_PATHS) as LegalDoc[])
            .filter((d) => d !== doc)
            .map((d) => (
              <button key={d} onClick={() => onNavigate(LEGAL_PATHS[d])} className="text-sm font-medium hover:text-accent cursor-pointer">
                {DOCS[d].title}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};
