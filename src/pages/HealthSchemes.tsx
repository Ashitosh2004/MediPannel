import React, { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, Heart, Shield, Baby, Leaf, Apple } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
interface Scheme {
  id: string;
  icon: React.ReactNode;
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  bgColor: string;
  accentColor: string;   // top accent bar — explicit, no split() needed
  url: string;
  beneficiaries: string[];
  howToApply: string[];
  keyFeature: string;
}

const SCHEMES: Scheme[] = [
  {
    id: 'pmjay',
    icon: <Shield size={22} />,
    emoji: '🛡️',
    title: 'Ayushman Bharat (PM-JAY)',
    subtitle: 'Healthcare coverage ₹5 lakh/family/year',
    description: 'Provides cashless treatment at empanelled hospitals for poor and vulnerable families across India.',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 border-emerald-200',
    accentColor: 'bg-emerald-400',
    url: 'https://pmjay.gov.in',
    beneficiaries: [
      'Poor and vulnerable families (as per SECC database)',
      'Rural and urban low-income households',
      'Families needing hospitalization coverage up to ₹5 lakh per year',
    ],
    howToApply: [
      'Check eligibility on official PM-JAY website or Common Service Centre (CSC)',
      'Visit empanelled hospitals with Aadhaar or ration card',
      'No separate registration needed if eligible',
    ],
    keyFeature: 'Cashless treatment at 25,000+ empanelled hospitals',
  },
  {
    id: 'jsy',
    icon: <Baby size={22} />,
    emoji: '🤰',
    title: 'Janani Suraksha Yojana (JSY)',
    subtitle: 'Safe motherhood & delivery support',
    description: 'Financial assistance for pregnant women from low-income families to promote safe institutional delivery.',
    color: 'text-pink-700',
    bgColor: 'bg-pink-50 border-pink-200',
    accentColor: 'bg-pink-400',
    url: 'https://nhm.gov.in/index1.php?lang=1&level=3&sublinkid=841&lid=309',
    beneficiaries: [
      'Pregnant women from low-income families',
      'Women in rural and backward areas',
      'Mothers opting for institutional delivery',
    ],
    howToApply: [
      'Register pregnancy at nearest government health center',
      'Contact ASHA worker in your area',
      'Submit required documents (ID, bank details)',
    ],
    keyFeature: 'Financial support of ₹1400 (rural) / ₹1000 (urban) for safe delivery',
  },
  {
    id: 'nrhm',
    icon: <Heart size={22} />,
    emoji: '🏥',
    title: 'National Rural Health Mission',
    subtitle: 'Rural healthcare infrastructure',
    description: 'Strengthening healthcare infrastructure in rural India — free medicines, diagnostics and more.',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
    accentColor: 'bg-blue-400',
    url: 'https://nhm.gov.in',
    beneficiaries: [
      'Rural population across India',
      'Women and children in remote areas',
      'People in underserved and tribal communities',
    ],
    howToApply: [
      'No direct application required',
      'Access services through government hospitals, PHCs, and CHCs',
      'Contact nearest Anganwadi or health sub-center',
    ],
    keyFeature: 'Free healthcare services at government health centers',
  },
  {
    id: 'ayush',
    icon: <Leaf size={22} />,
    emoji: '🌿',
    title: 'AYUSH Bharat',
    subtitle: 'Traditional & holistic medicine',
    description: 'Promotes Ayurveda, Yoga, Unani, Siddha and Homeopathy for holistic health and wellness.',
    color: 'text-teal-700',
    bgColor: 'bg-teal-50 border-teal-200',
    accentColor: 'bg-teal-400',
    url: 'https://ayush.gov.in',
    beneficiaries: [
      'People interested in traditional medicine',
      'Patients using Ayurveda, Yoga, Unani, Siddha, Homeopathy',
      'Individuals seeking alternative healthcare',
    ],
    howToApply: [
      'Visit AYUSH hospitals or wellness centers',
      'Consult certified AYUSH practitioners',
      'Check ayush.gov.in for nearby centers',
    ],
    keyFeature: 'Natural healing integrated with modern healthcare',
  },
  {
    id: 'poshan',
    icon: <Apple size={22} />,
    emoji: '🍎',
    title: 'POSHAN Abhiyaan',
    subtitle: 'Nutrition for mothers & children',
    description: 'National Nutrition Mission focusing on reducing malnutrition for children under 6, pregnant and lactating women.',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 border-orange-200',
    accentColor: 'bg-orange-400',
    url: 'https://poshanabhiyaan.gov.in',
    beneficiaries: [
      'Pregnant women and lactating mothers',
      'Children aged 0–6 years',
      'Adolescent girls (10–19 years)',
    ],
    howToApply: [
      'Register at nearest Anganwadi center',
      'Contact ASHA or Anganwadi worker',
      'Participate in nutrition and health programs',
    ],
    keyFeature: 'Reduces stunting, wasting and anemia in children',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
function SchemeCard({ scheme }: { scheme: Scheme }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 ${expanded ? 'shadow-md' : ''}`}>
      {/* Top accent bar */}
      <div className={`h-1.5 w-full ${scheme.accentColor}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${scheme.bgColor} ${scheme.color}`}>
            {scheme.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-foreground text-sm leading-tight">{scheme.emoji} {scheme.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{scheme.subtitle}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{scheme.description}</p>

        {/* Key feature badge */}
        <div className={`text-xs font-semibold px-3 py-1.5 rounded-full w-fit border ${scheme.bgColor} ${scheme.color} mb-4`}>
          ✨ {scheme.keyFeature}
        </div>

        {/* Expandable details */}
        {expanded && (
          <div className="space-y-3 mb-4 animate-in fade-in duration-200">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-wider mb-1.5 ${scheme.color}`}>Who Benefits</p>
              <ul className="space-y-1">
                {scheme.beneficiaries.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="text-green-500 shrink-0 mt-0.5">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className={`text-[10px] font-black uppercase tracking-wider mb-1.5 ${scheme.color}`}>How to Apply</p>
              <ul className="space-y-1">
                {scheme.howToApply.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="font-bold text-primary shrink-0">{i + 1}.</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <a
            href={scheme.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all hover:opacity-80 ${scheme.bgColor} ${scheme.color}`}
          >
            <ExternalLink size={12} />
            Visit Website
          </a>
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all border border-border"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Less Info' : 'More Info'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export function HealthSchemes() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
          🏛️ Health Schemes
        </h1>
        <p className="text-muted-foreground font-medium mt-1">
          Government health programmes and benefits available to you as a registered patient.
        </p>
      </div>

      {/* Hero banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-blue-600 p-8 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-8 w-32 h-32 rounded-full bg-white" />
          <div className="absolute bottom-2 left-16 w-20 h-20 rounded-full bg-white" />
          <div className="absolute top-12 left-4 w-10 h-10 rounded-full bg-white" />
        </div>
        <div className="relative">
          <div className="text-4xl mb-3">🇮🇳</div>
          <h2 className="text-2xl font-black mb-2">Your Right to Healthcare</h2>
          <p className="text-white/80 text-sm max-w-md leading-relaxed">
            The Government of India provides multiple health welfare schemes. 
            As a MedPanel Pro patient, these benefits are available to you.
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm font-semibold">
            <span className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">5 Active Schemes</span>
            <span className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">Free to Apply</span>
          </div>
        </div>
      </div>

      {/* Scheme cards grid */}
      <div>
        <h2 className="text-lg font-black text-foreground mb-4">Explore Health Schemes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {SCHEMES.map(s => <SchemeCard key={s.id} scheme={s} />)}
        </div>
      </div>

      {/* Footer note */}
      <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 flex items-start gap-3">
        <Shield size={16} className="text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          <span className="font-bold text-foreground">Need help applying? </span>
          Contact your nearest{' '}
          <span className="font-semibold text-foreground">Common Service Centre (CSC)</span> or{' '}
          <span className="font-semibold text-foreground">ASHA worker</span> for in-person assistance with any scheme.
        </p>
      </div>
    </div>
  );
}
