/**
 * Entity Info Cards Component
 * 
 * Dynamically composable entity information display.
 * TODO: Make sections configurable per profile (entity visualization system)
 */

'use client';

import { type FC, useState } from 'react';
import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import type { Entity } from '@/types/avatar';

interface EntityInfoCardsProps {
  entity: Entity;
  isVisible: boolean;
  // TODO: Add sections configuration per profile
  // sections?: EntitySection[];
}

// TODO: Define section types for entity visualization system
// type EntitySection = 'location' | 'header' | 'metrics' | 'details' | 'image';

export const EntityInfoCards: FC<EntityInfoCardsProps> = ({ entity, isVisible }) => {
  const theme = useTheme();
  const [imageError, setImageError] = useState(false);
  const [showCompanyInfo, setShowCompanyInfo] = useState(false);

  // Orientation detection for true portrait mode
  const [isPortrait, setIsPortrait] = useState(false);

  React.useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.matchMedia('(orientation: portrait)').matches;
      setIsPortrait(portrait);
    };

    checkOrientation();

    const portraitQuery = window.matchMedia('(orientation: portrait)');
    const handleOrientationChange = () => checkOrientation();

    portraitQuery.addEventListener('change', handleOrientationChange);
    window.addEventListener('resize', checkOrientation);

    return () => {
      portraitQuery.removeEventListener('change', handleOrientationChange);
      window.removeEventListener('resize', checkOrientation);
    };
  }, []);

  // After location shows, transition to company info after 5 seconds
  // If no coordinates, show company info immediately
  React.useEffect(() => {
    if (isVisible) {
      if (entity.coordinates) {
        // Has location: show map first, then transition to info
        const timer = setTimeout(() => {
          setShowCompanyInfo(true);
        }, 5000);
        return () => clearTimeout(timer);
      } else {
        // No location: show company info immediately
        setShowCompanyInfo(true);
      }
    } else {
      setShowCompanyInfo(false);
    }
  }, [isVisible, entity.coordinates]);

  // Format metrics for display
  const getMetricPills = () => {
    if (!entity.metrics) return [];

    const pills: { label: string; value: string }[] = [];
    const m = entity.metrics;

    if (m.aumAEDBn) pills.push({ label: 'AUM', value: `AED ${m.aumAEDBn}B` });
    if (m.clients) pills.push({ label: 'Clients', value: m.clients.toLocaleString() });
    if (m.annualVolumeAEDBn)
      pills.push({ label: 'Annual Volume', value: `AED ${m.annualVolumeAEDBn}B` });
    if (m.marketCapAEDBn) pills.push({ label: 'Market Cap', value: `AED ${m.marketCapAEDBn}B` });
    if (m.dividendYieldPct) pills.push({ label: 'Dividend Yield', value: `${m.dividendYieldPct}%` });
    if (m.userGrowthPct) pills.push({ label: 'User Growth', value: `${m.userGrowthPct}%` });
    if (m.audience) pills.push({ label: 'Audience', value: m.audience.toLocaleString() });
    if (m.recommendationSuccessPct)
      pills.push({ label: 'Success Rate', value: `${m.recommendationSuccessPct}%` });
    if (m.complianceScore) pills.push({ label: 'Compliance', value: `${m.complianceScore}/100` });

    return pills;
  };

  const metricPills = getMetricPills();

  // Helper styles based on theme
  const cardBg = theme === 'light' ? 'bg-white/80 border-zinc-200/60' : 'bg-zinc-950/80 border-zinc-700/60';
  const headingColor = theme === 'light' ? 'text-zinc-900' : 'text-zinc-100';
  const subTextColor = theme === 'light' ? 'text-zinc-600' : 'text-zinc-400';
  const textColor = theme === 'light' ? 'text-zinc-800' : 'text-zinc-200';
  const pillBg = theme === 'light' ? 'bg-zinc-100/80 border-zinc-200' : 'bg-zinc-800/60 border-zinc-700/40';
  const pillText = theme === 'light' ? 'text-zinc-700' : 'text-zinc-300';
  const labelColor = theme === 'light' ? 'text-zinc-500' : 'text-zinc-400';

  return (
    <motion.div
      className={`absolute flex flex-col pointer-events-auto z-60 ${
        isPortrait
          ? 'gap-2 w-80 right-4' +
            (!showCompanyInfo && entity.coordinates ? ' top-1/2 -translate-y-1/2' : ' bottom-40')
          : 'gap-4 w-full max-w-md lg:max-w-lg xl:max-w-xl right-12' +
            (!showCompanyInfo && entity.coordinates ? ' top-1/2 -translate-y-1/2' : ' top-32')
      }`}
      initial={{ opacity: 0, x: 0, y: 100 }}
      animate={isVisible ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: 0, y: 100 }}
      transition={{
        type: 'spring',
        stiffness: 80,
        damping: 20,
        mass: 0.8,
      }}
    >
      <AnimatePresence mode="wait">
        {isVisible && (
          <>
            {/* PHASE 1: Location Card Only - Shows first */}
            {!showCompanyInfo && entity.coordinates && (
              <motion.div
                key="location-only"
                className={`w-full border backdrop-blur-xl shadow-lg rounded-lg overflow-hidden ${cardBg} ${
                  isPortrait ? 'p-2' : 'p-4'
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{
                  type: 'spring',
                  stiffness: 100,
                  damping: 15,
                  delay: 0.1,
                }}
              >
                <h4 className={`${labelColor} text-xs font-light uppercase tracking-wider mb-1.5`}>
                  Location
                </h4>
                <div className={`w-full rounded-lg overflow-hidden relative ${isPortrait ? 'h-32' : 'h-40'}`}>
                  {/* Google Maps iframe */}
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${entity.coordinates.lat},${entity.coordinates.lng}&zoom=14&maptype=roadmap`}
                  />
                </div>
                <p className={`${textColor} text-xs font-light mt-1.5`}>
                  {entity.emirate || 'Dubai'}, UAE
                </p>
              </motion.div>
            )}

            {/* PHASE 2: Company Info Cards - Shows after transition */}
            {showCompanyInfo && (
              <>
                {/* Company Header Card */}
                <motion.div
                  key="company-header"
                  className={`w-full border backdrop-blur-xl shadow-lg rounded-lg ${cardBg} ${
                    isPortrait ? 'p-2' : 'p-4'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{
                    type: 'spring',
                    stiffness: 100,
                    damping: 15,
                    delay: 0.1,
                  }}
                >
                  <h3
                    className={`${headingColor} font-light tracking-tight ${
                      isPortrait ? 'text-sm mb-0.5' : 'text-lg mb-1'
                    }`}
                  >
                    {entity.name}
                  </h3>
                  <p
                    className={`${subTextColor} font-light ${isPortrait ? 'text-xs mb-1.5' : 'text-sm mb-2'}`}
                  >
                    {entity.type}
                  </p>
                  <div className={`flex text-xs ${isPortrait ? 'gap-1.5' : 'gap-2'}`}>
                    <span className={`${pillBg} rounded ${pillText} font-light ${isPortrait ? 'px-1.5 py-0.5' : 'px-2 py-1'}`}>
                      {entity.license}
                    </span>
                    <span
                      className={`rounded font-light ${isPortrait ? 'px-1.5 py-0.5' : 'px-2 py-1'} ${
                        entity.status === 'Active'
                          ? 'bg-[var(--accent-primary-light)] border border-[var(--accent-primary)]/40 text-[var(--accent-primary)]'
                          : `${pillBg} ${pillText}`
                      }`}
                    >
                      {entity.status}
                    </span>
                  </div>
                </motion.div>

                {/* Metrics Pills */}
                {metricPills.length > 0 && (
                  <motion.div
                    key="metrics"
                    className={`w-full flex flex-wrap border backdrop-blur-xl shadow-lg rounded-lg ${cardBg} ${
                      isPortrait ? 'gap-1.5 p-2' : 'gap-2 p-4'
                    }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{
                      type: 'spring',
                      stiffness: 100,
                      damping: 15,
                      delay: 0.2,
                    }}
                  >
                    {metricPills.map((pill) => (
                      <div
                        key={pill.label}
                        className={`${theme === 'light' ? 'bg-zinc-100/70' : 'bg-zinc-900/70'} border ${
                          theme === 'light' ? 'border-zinc-200/60' : 'border-zinc-700/40'
                        } rounded-lg flex items-center ${isPortrait ? 'px-2 py-1 gap-1.5' : 'px-3 py-1.5 gap-2'}`}
                      >
                        <span className={`${labelColor} text-xs font-light`}>{pill.label}</span>
                        <span className={`${textColor} text-xs font-normal`}>{pill.value}</span>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* Details Card */}
                <motion.div
                  key="details"
                  className={`w-full border backdrop-blur-xl shadow-lg rounded-lg ${cardBg} ${
                    isPortrait ? 'p-2' : 'p-4'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{
                    type: 'spring',
                    stiffness: 100,
                    damping: 15,
                    delay: 0.3,
                  }}
                >
                  {entity.emirate && (
                    <div className={isPortrait ? 'mb-2' : 'mb-3'}>
                      <h4
                        className={`${labelColor} text-xs font-light uppercase tracking-wider ${
                          isPortrait ? 'mb-0.5' : 'mb-1'
                        }`}
                      >
                        Headquarters
                      </h4>
                      <p className={`${textColor} text-sm font-light`}>{entity.emirate}</p>
                    </div>
                  )}

                  {entity.issueDate && (
                    <div className={isPortrait ? 'mb-2' : 'mb-3'}>
                      <h4
                        className={`${labelColor} text-xs font-light uppercase tracking-wider ${
                          isPortrait ? 'mb-0.5' : 'mb-1'
                        }`}
                      >
                        Licensed Since
                      </h4>
                      <p className={`${textColor} font-light ${isPortrait ? 'text-xs' : 'text-sm'}`}>
                        {new Date(entity.issueDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  )}

                  {entity.narration && (
                    <div>
                      <h4
                        className={`${labelColor} text-xs font-light uppercase tracking-wider ${
                          isPortrait ? 'mb-0.5' : 'mb-1'
                        }`}
                      >
                        Overview
                      </h4>
                      <p
                        className={`${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'} font-light leading-relaxed ${
                          isPortrait ? 'text-xs' : 'text-sm'
                        }`}
                      >
                        {entity.narration}
                      </p>
                    </div>
                  )}
                </motion.div>

                {/* Company Image Card */}
                <motion.div
                  key="company-image"
                  className={`w-full border backdrop-blur-xl shadow-lg rounded-lg overflow-hidden ${cardBg} ${
                    isPortrait ? 'p-2' : 'p-4'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{
                    type: 'spring',
                    stiffness: 100,
                    damping: 15,
                    delay: 0.4,
                  }}
                >
                  <h4 className={`${labelColor} text-xs font-light uppercase tracking-wider mb-1.5`}>
                    Company
                  </h4>
                  <div
                    className={`w-full rounded-lg overflow-hidden relative ${
                      theme === 'light' ? 'bg-zinc-100/50' : 'bg-zinc-900/50'
                    } flex items-center justify-center ${isPortrait ? 'h-32' : 'h-40'}`}
                  >
                    {/* Company image */}
                    {!imageError ? (
                      <Image
                        src={`/companies/${entity.type.toLowerCase().includes('finfluencer') ? 'sca' : entity.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')}.jpg`}
                        alt={`${entity.name} company image`}
                        fill
                        className="object-cover"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className="text-zinc-500 text-sm font-light flex items-center justify-center w-full h-full">
                        No image available
                      </div>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

