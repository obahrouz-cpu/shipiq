import type { Metadata } from 'next'
import LegalLayout, { type LegalSection } from '@/components/LegalLayout'

export const metadata: Metadata = {
  title: 'Terms of Service · شروط الخدمة | ShipIQ',
  description: 'The terms governing your use of ShipIQ personal shopping and international shipping service.',
  robots: { index: true, follow: true },
}

const sections: LegalSection[] = [
  {
    id: 'about',
    title: 'About ShipIQ',
    blocks: [{
      type: 'p',
      text: 'ShipIQ is a personal shopping and international shipping forwarding service based in Erbil and Baghdad, Iraq. We purchase items on behalf of customers from international stores and deliver them to Iraq.',
    }],
  },
  {
    id: 'how-it-works',
    title: 'How The Service Works',
    blocks: [{
      type: 'list',
      items: [
        'Customer submits a product link and pays the full cost upfront (item price + shipping + service fee + delivery fee)',
        'ShipIQ purchases the item through our country agents',
        'Item is shipped to Iraq and delivered to customer',
        'Shipping estimates are approximate — final price confirmed by ShipIQ',
      ],
    }],
  },
  {
    id: 'account-balance',
    title: 'Account Balance',
    blocks: [{
      type: 'list',
      items: [
        'Customers must maintain sufficient balance to cover full order cost',
        'Balance is topped up in USD equivalent via Iraqi payment methods (FIB, Qi Card, ZainCash, Asia Pay)',
        'Balance is non-refundable except in cases of ShipIQ error',
        'ShipIQ reserves the right to adjust balance for corrections',
      ],
    }],
  },
  {
    id: 'refund-policy',
    title: 'Refund Policy',
    blocks: [{
      type: 'list',
      items: [
        'NO REFUNDS under any circumstances except in cases of clear error by ShipIQ',
        'If ShipIQ makes an error (wrong item purchased, item not delivered due to our fault) — full refund credited to account balance',
        'Shipping fees are non-refundable once the item has been shipped',
        "Item costs are non-refundable once purchased on customer's behalf",
      ],
    }],
  },
  {
    id: 'damaged-lost',
    title: 'Damaged or Lost Packages',
    blocks: [{
      type: 'list',
      items: [
        'Customer MUST examine the item at the time of pickup or in the presence of the delivery driver',
        'Any damage claims MUST be reported immediately at delivery — claims after acceptance are not accepted',
        'Photo evidence is required for all damage claims',
        'ShipIQ photographs all items at warehouse — if warehouse photos show item was intact, claim may be rejected',
        'Compensation for valid claims is credited to account balance — amount determined case by case by ShipIQ',
        'ShipIQ is not responsible for damage caused by manufacturer defects or customer mishandling',
      ],
    }],
  },
  {
    id: 'prohibited-items',
    title: 'Prohibited Items',
    blocks: [
      { type: 'p', text: 'The following items cannot be shipped through ShipIQ:' },
      {
        type: 'list',
        items: [
          'Weapons, firearms, ammunition, and explosives',
          'Illegal drugs and narcotics',
          'Alcohol and tobacco products',
          'Perishable food items',
          'Live animals',
          'Hazardous, flammable, or explosive materials',
          'Counterfeit or pirated goods',
          'Adult content',
          'Any items prohibited by Iraqi law or customs regulations',
        ],
      },
      { type: 'p', text: 'Items requiring special approval: supplements, vitamins, medical devices, high-value electronics (may be subject to Iraqi customs duties).' },
    ],
  },
  {
    id: 'shipping-times',
    title: 'Shipping Times',
    blocks: [{
      type: 'list',
      items: [
        'All delivery timeframes are ESTIMATES only and not guaranteed',
        'Delays may occur due to customs, holidays, or circumstances beyond our control',
        'ShipIQ is not liable for delays caused by customs or third party carriers',
      ],
    }],
  },
  {
    id: 'customs-taxes',
    title: 'Customs and Taxes',
    blocks: [{
      type: 'list',
      items: [
        'Customer is responsible for any customs duties or import taxes',
        'ShipIQ will inform customer if customs fees apply',
        'Refusal to pay customs fees does not entitle customer to a refund',
      ],
    }],
  },
  {
    id: 'account-suspension',
    title: 'Account Suspension',
    blocks: [
      { type: 'p', text: 'ShipIQ reserves the right to suspend or terminate accounts for:' },
      {
        type: 'list',
        items: [
          'Violation of these terms',
          'Fraudulent activity',
          'Attempting to ship prohibited items',
          'Abusive behavior toward staff or agents',
        ],
      },
    ],
  },
  {
    id: 'limitation-liability',
    title: 'Limitation of Liability',
    blocks: [{
      type: 'list',
      items: [
        "ShipIQ's maximum liability is limited to the value of the affected order",
        'ShipIQ is not liable for indirect or consequential damages',
        'ShipIQ is not liable for losses due to customs seizure of prohibited items',
      ],
    }],
  },
  {
    id: 'governing-law',
    title: 'Governing Law',
    blocks: [{
      type: 'list',
      items: [
        'These terms are governed by the laws of Iraq',
        'Any disputes will be resolved under Iraqi jurisdiction',
      ],
    }],
  },
  {
    id: 'changes',
    title: 'Changes to Terms',
    blocks: [{
      type: 'list',
      items: [
        'ShipIQ may update these terms at any time',
        'Continued use of the service constitutes acceptance',
      ],
    }],
  },
  {
    id: 'contact',
    title: 'Contact',
    blocks: [{
      type: 'list',
      items: [
        'Questions about these terms? Contact us on WhatsApp',
        'Based in Erbil & Baghdad, Iraq 🇮🇶',
      ],
    }],
  },
]

export default function TermsPage() {
  return (
    <LegalLayout
      titleEn="ShipIQ Terms of Service"
      titleAr="شروط الخدمة"
      lastUpdated="May 2025"
      sections={sections}
    />
  )
}
