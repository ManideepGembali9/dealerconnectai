export type DealerMenuItem = {
  id: string;
  number: string;
  title: string;
  shortDesc: string;
  iconName: string;
  order: number;
  translations: Record<string, string>;
};

// Streamlined, high-utility menu configuration for dealers
// Redundant fragmented tabs (pricing, stock, inventory) are unified into "My Products & Inventory"
export const DEALER_MENU_ITEMS: DealerMenuItem[] = [
  {
    id: '01-dashboard',
    number: '01',
    title: 'Dashboard',
    shortDesc: 'Shop summary, stock health & activity',
    iconName: 'LayoutDashboard',
    order: 1,
    translations: {
      en: 'Dashboard',
      te: 'డ్యాష్‌బోర్డ్',
      hi: 'डैशबोर्ड',
      ta: 'முகப்பலகை',
    },
  },
  {
    id: '03-products',
    number: '02',
    title: 'My Products & Inventory',
    shortDesc: 'Catalogue, custom submissions, pricing & stock',
    iconName: 'Package',
    order: 2,
    translations: {
      en: 'My Products & Inventory',
      te: 'నా ఉత్పత్తులు & ఇన్వెంటరీ',
      hi: 'मेरे उत्पाद और इन्वेंटरी',
      ta: 'எனது தயாரிப்புகள்',
    },
  },
  {
    id: '08-enquiries',
    number: '03',
    title: 'Customer Enquiries',
    shortDesc: 'Incoming customer leads, WhatsApp & direct calls',
    iconName: 'MessageSquareText',
    order: 3,
    translations: {
      en: 'Customer Enquiries',
      te: 'కస్టమర్ విచారణలు',
      hi: 'ग्राहक पूछताछ',
      ta: 'வாடிக்கையாளர் விசாரணைகள்',
    },
  },
  {
    id: '02-profile',
    number: '04',
    title: 'Shop Profile & Settings',
    shortDesc: 'Address, hours, logo, banner, delivery radius',
    iconName: 'Store',
    order: 4,
    translations: {
      en: 'Shop Profile & Settings',
      te: 'షాప్ ప్రొఫైల్ & సెట్టింగ్‌లు',
      hi: 'दुकान प्रोफ़ाइल और सेटिंग्स',
      ta: 'கடை சுயவிவரம்',
    },
  },
  {
    id: '09-reviews',
    number: '05',
    title: 'Reviews & Ratings',
    shortDesc: 'Customer feedback & reputation scores',
    iconName: 'Star',
    order: 5,
    translations: {
      en: 'Reviews & Ratings',
      te: 'సమీక్షలు & రేటింగ్‌లు',
      hi: 'समीक्षाएं और रेटिंग',
      ta: 'மதிப்புரைகள்',
    },
  },
  {
    id: '11-analytics',
    number: '06',
    title: 'Shop Analytics',
    shortDesc: 'Product views, customer interest & trends',
    iconName: 'BarChart3',
    order: 6,
    translations: {
      en: 'Shop Analytics',
      te: 'షాప్ విశ్లేషణలు',
      hi: 'दुकान विश्लेषण',
      ta: 'பகுப்பாய்வு',
    },
  },
  {
    id: '10-notifications',
    number: '07',
    title: 'Notifications',
    shortDesc: 'Platform announcements & lead alerts',
    iconName: 'Bell',
    order: 7,
    translations: {
      en: 'Notifications',
      te: 'నోటిఫికేషన్‌లు',
      hi: 'सूचनाएं',
      ta: 'அறிவிப்புகள்',
    },
  },
  {
    id: '13-support',
    number: '08',
    title: 'Enquiry & Lead Management',
    shortDesc: 'Contact Admin support, escalations & catalog tickets',
    iconName: 'HelpCircle',
    order: 8,
    translations: {
      en: 'Enquiry & Lead Management',
      te: 'అడ్మిన్ మద్దతు & లీడ్ నిర్వహణ',
      hi: 'एडमिन पूछताछ और सहायता',
      ta: 'நிர்வாக விசாரணை & ஆதரவு',
    },
  },
  {
    id: '15-logout',
    number: '09',
    title: 'Logout',
    shortDesc: 'Sign out of merchant console',
    iconName: 'LogOut',
    order: 9,
    translations: {
      en: 'Logout',
      te: 'లాగౌట్',
      hi: 'लॉग आउट',
      ta: 'வெளியேறு',
    },
  },
];
