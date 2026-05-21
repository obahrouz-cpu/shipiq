import type { Metadata } from 'next'
import LegalLayout, { type LegalSection } from '@/components/LegalLayout'

export const metadata: Metadata = {
  title: 'Privacy Policy · سياسة الخصوصية | ShipIQ',
  description: 'How ShipIQ collects, uses, stores, and protects your personal data.',
  robots: { index: true, follow: true },
}

const sections: LegalSection[] = [
  {
    id: 'information-we-collect',
    title: 'Information We Collect',
    blocks: [{
      type: 'list',
      items: [
        'Full name, email address, phone number',
        'Delivery address and GPS location',
        'Order history and product links',
        'Payment transaction records',
        'Device information and browser type',
        'IP address and usage data',
      ],
    }],
  },
  {
    id: 'how-we-use',
    title: 'How We Use Your Information',
    blocks: [{
      type: 'list',
      items: [
        'Processing and fulfilling your orders',
        'Calculating shipping costs and estimates',
        'Sending order status notifications via WhatsApp',
        'Managing your account balance',
        'Improving our services',
        'Communicating promotions (if opted in)',
      ],
    }],
  },
  {
    id: 'information-sharing',
    title: 'Information Sharing',
    blocks: [{
      type: 'list',
      items: [
        'With our country agents (USA, Turkey, UAE, China) — order details only, no personal contact info',
        'With local delivery partners in Iraq — name and delivery address only',
        'With payment processors (FIB, Qi Card, ZainCash, Asia Pay) — transaction amounts only',
        'We never sell your personal data to third parties',
      ],
    }],
  },
  {
    id: 'data-storage',
    title: 'Data Storage',
    blocks: [{
      type: 'list',
      items: [
        'Data stored securely on Supabase servers',
        'Encrypted in transit and at rest',
        'Retained as long as your account is active',
        'Deleted within 30 days of account deletion request',
      ],
    }],
  },
  {
    id: 'your-rights',
    title: 'Your Rights',
    blocks: [{
      type: 'list',
      items: [
        'Request access to your personal data',
        'Request correction of inaccurate data',
        'Request deletion of your account and data',
        'Opt out of promotional notifications',
        'Contact us on WhatsApp to exercise these rights',
      ],
    }],
  },
  {
    id: 'cookies',
    title: 'Cookies',
    blocks: [{
      type: 'list',
      items: [
        'We use essential cookies for authentication only',
        'No advertising or tracking cookies',
        'No third party analytics cookies',
      ],
    }],
  },
  {
    id: 'childrens-privacy',
    title: "Children's Privacy",
    blocks: [{
      type: 'list',
      items: [
        'Our service is not intended for users under 18',
        'We do not knowingly collect data from minors',
      ],
    }],
  },
  {
    id: 'changes',
    title: 'Changes to This Policy',
    blocks: [{
      type: 'list',
      items: [
        'We may update this policy periodically',
        'Continued use of the service means acceptance of changes',
      ],
    }],
  },
  {
    id: 'contact',
    title: 'Contact',
    blocks: [{
      type: 'list',
      items: [
        'For privacy concerns contact us on WhatsApp',
        'Email: [your email]',
        'Based in Erbil & Baghdad, Iraq',
      ],
    }],
  },
]

export default function PrivacyPage() {
  return (
    <LegalLayout
      titleEn="ShipIQ Privacy Policy"
      titleAr="سياسة الخصوصية"
      lastUpdated="May 2025"
      sections={sections}
    />
  )
}
