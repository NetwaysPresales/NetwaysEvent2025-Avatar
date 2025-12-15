/**
 * Entity Visualization Component
 * 
 * Dynamically renders entity information based on entity structure.
 * Supports all field types and layouts defined in the entity system.
 */

'use client';

import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import type { EntityVisualizationData, EntityFieldValue, EntityLayout } from '@/types/entity-visualization';
import ReactMarkdown from 'react-markdown';

interface EntityVisualizationProps {
  data: EntityVisualizationData;
  isVisible: boolean;
}

/**
 * Format field value for display based on field type
 */
function formatFieldValue(field: EntityFieldValue): string {
  const { value, type, display } = field;
  
  if (value === null || value === undefined) {
    return '';
  }

  switch (type) {
    case 'currency':
      if (display?.format === 'currency') {
        const prefix = display.prefix || '$';
        return `${prefix}${Number(value).toLocaleString()}`;
      }
      return String(value);
    
    case 'number':
      const suffix = display?.suffix || '';
      return `${value}${suffix}`;
    
    case 'date':
      try {
        return new Date(value as string).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } catch {
        return String(value);
      }
    
    case 'boolean':
      return value ? 'Yes' : 'No';
    
    case 'json':
      return JSON.stringify(value, null, 2);
    
    default:
      return String(value);
  }
}

/**
 * Component for rendering entity media with authenticated URLs
 */
const EntityMediaItem: React.FC<{
  blobUrl: string;
  type: 'image' | 'video';
  altText: string | null;
  caption: string | null;
  fieldLabel: string;
  theme: 'light' | 'dark';
  borderColor: string;
  bgColor: string;
  textColor: string;
}> = ({ blobUrl, type, altText, caption, fieldLabel, borderColor, bgColor, textColor }) => {
  const authenticatedUrl = useMediaUrl(blobUrl);

  if (type === 'image') {
    return (
      <div className={`rounded-lg overflow-hidden border ${borderColor} ${bgColor}`}>
        <div className="relative aspect-video">
          {authenticatedUrl ? (
            <Image
              src={authenticatedUrl}
              alt={altText || fieldLabel}
              fill
              className="object-cover"
              onError={() => {
                console.error(`[EntityVisualization] Failed to load image: ${authenticatedUrl}`);
              }}
            />
          ) : (
            <div className={`flex items-center justify-center h-full ${textColor} text-xs`}>
              Loading...
            </div>
          )}
        </div>
        {caption && (
          <p className={`${textColor} text-xs p-2`}>{caption}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden border ${borderColor} ${bgColor}`}>
      {authenticatedUrl ? (
        <video
          src={authenticatedUrl}
          controls
          className="w-full"
          onError={() => {
            console.error(`[EntityVisualization] Failed to load video: ${authenticatedUrl}`);
          }}
        />
      ) : (
        <div className={`flex items-center justify-center h-32 ${textColor} text-xs`}>
          Loading...
        </div>
      )}
      {caption && (
        <p className={`${textColor} text-xs p-2`}>{caption}</p>
      )}
    </div>
  );
};

/**
 * Render a single field based on its type
 */
function renderField(field: EntityFieldValue, theme: 'light' | 'dark') {
  // Validate field
  if (!field || !field.id || !field.label) {
    return null;
  }

  const textColor = theme === 'light' ? 'text-zinc-900' : 'text-zinc-100';
  const labelColor = theme === 'light' ? 'text-zinc-600 font-medium' : 'text-zinc-400 font-medium';
  const borderColor = theme === 'light' ? 'border-zinc-200' : 'border-zinc-700';
  const bgColor = theme === 'light' ? 'bg-zinc-50/50' : 'bg-zinc-800/30';

  if (field.type === 'image' && field.mediaFiles && field.mediaFiles.length > 0) {
    return (
      <div key={field.id} className="space-y-2">
        <h4 className={`${labelColor} text-sm`}>
          {field.label}
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {field.mediaFiles.map((media, idx) => (
            <EntityMediaItem
              key={media.id || `media-${idx}`}
              blobUrl={media.url}
              type="image"
              altText={media.altText}
              caption={media.caption}
              fieldLabel={field.label}
              theme={theme}
              borderColor={borderColor}
              bgColor={bgColor}
              textColor={textColor}
            />
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'video' && field.mediaFiles && field.mediaFiles.length > 0) {
    return (
      <div key={field.id} className="space-y-2">
        <h4 className={`${labelColor} text-sm`}>
          {field.label}
        </h4>
        <div className="space-y-2">
          {field.mediaFiles.map((media, idx) => (
            <EntityMediaItem
              key={media.id || `video-${idx}`}
              blobUrl={media.url}
              type="video"
              altText={media.altText}
              caption={media.caption}
              fieldLabel={field.label}
              theme={theme}
              borderColor={borderColor}
              bgColor={bgColor}
              textColor={textColor}
            />
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'rich_text') {
    const value = field.value ? String(field.value) : '';
    return (
      <div key={field.id} className="space-y-2">
        <h4 className={`${labelColor} text-sm`}>
          {field.label}
        </h4>
        <div className={`prose prose-sm max-w-none ${theme === 'dark' ? 'prose-invert' : ''}`}>
          <ReactMarkdown>{value}</ReactMarkdown>
        </div>
      </div>
    );
  }

  if (field.type === 'url') {
    const url = String(field.value || '');
    return (
      <div key={field.id} className="space-y-2">
        <h4 className={`${labelColor} text-sm`}>
          {field.label}
        </h4>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${textColor} text-sm underline hover:opacity-80`}
        >
          {url}
        </a>
      </div>
    );
  }

  if (field.type === 'email' || field.type === 'phone') {
    const value = String(field.value || '');
    const href = field.type === 'email' ? `mailto:${value}` : `tel:${value}`;
    return (
      <div key={field.id} className="space-y-2">
        <h4 className={`${labelColor} text-sm`}>
          {field.label}
        </h4>
        <a
          href={href}
          className={`${textColor} text-sm underline hover:opacity-80`}
        >
          {value}
        </a>
      </div>
    );
  }

  // Default: text, number, currency, date, boolean, json
  const formattedValue = formatFieldValue(field);
  if (!formattedValue) {
    return null; // Don't render empty fields
  }

  return (
      <div key={field.id} className="space-y-1.5">
        <h4 className={`${labelColor} text-sm`}>
          {field.label}
        </h4>
        <p className={`${textColor} text-base`}>{formattedValue}</p>
      </div>
  );
}

/**
 * Get layout-specific container classes
 */
function getLayoutClasses(layout: EntityLayout, isPortrait: boolean): string {
  const baseClasses = 'absolute flex flex-col pointer-events-auto z-60';
  
  switch (layout) {
    case 'sidebar':
      return isPortrait
        ? `${baseClasses} gap-2 w-80 right-4 bottom-40`
        : `${baseClasses} gap-4 w-full max-w-md lg:max-w-lg xl:max-w-xl right-12 top-32`;
    
    case 'card':
      return isPortrait
        ? `${baseClasses} gap-2 w-80 right-4 bottom-40`
        : `${baseClasses} gap-4 w-full max-w-sm right-12 top-32`;
    
    case 'modal':
      return `${baseClasses} gap-4 w-full max-w-2xl left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`;
    
    case 'fullscreen':
      return `${baseClasses} gap-4 w-full h-full left-0 top-0`;
    
    default:
      return getLayoutClasses('sidebar', isPortrait);
  }
}

export const EntityVisualization: React.FC<EntityVisualizationProps> = ({
  data,
  isVisible,
}) => {
  const theme = useTheme();
  const [isPortrait, setIsPortrait] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  // Validate data structure
  React.useEffect(() => {
    if (!data || !data.entityId || !data.entityName || !data.fields || !Array.isArray(data.fields)) {
      console.error('[EntityVisualization] Invalid data structure:', data);
      setHasError(true);
    } else {
      setHasError(false);
    }
  }, [data]);

  // Detect orientation
  React.useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.matchMedia('(orientation: portrait)').matches);
    };

    checkOrientation();
    const portraitQuery = window.matchMedia('(orientation: portrait)');
    portraitQuery.addEventListener('change', checkOrientation);
    window.addEventListener('resize', checkOrientation);

    return () => {
      portraitQuery.removeEventListener('change', checkOrientation);
      window.removeEventListener('resize', checkOrientation);
    };
  }, []);

  const cardBg = theme === 'light' 
    ? 'bg-white/95 backdrop-blur-xl border-zinc-300/80 shadow-2xl' 
    : 'bg-zinc-900/95 backdrop-blur-xl border-zinc-600/80 shadow-2xl';
  const layoutClasses = getLayoutClasses(data.layout, isPortrait);

  // Handle error state
  if (hasError || !data || !data.fields) {
    return null; // Don't render if data is invalid
  }

  // Sort fields by order (fields are already in order from structure, but ensure consistency)
  const sortedFields = [...data.fields].filter(field => field && field.id && field.label);

  if (sortedFields.length === 0) {
    return null; // Don't render if no valid fields
  }

  return (
    <motion.div
      className={layoutClasses}
      initial={{ opacity: 0, x: 0, y: 100 }}
      animate={isVisible ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: 0, y: 100 }}
      exit={{ opacity: 0, x: 0, y: 100 }}
      transition={{
        type: 'spring',
        stiffness: 80,
        damping: 20,
        mass: 0.8,
      }}
    >
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key={data.entityId}
            className={`w-full border rounded-2xl ${cardBg} ${
              isPortrait ? 'p-4' : 'p-8'
            }`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{
              type: 'spring',
              stiffness: 100,
              damping: 15,
            }}
          >
            {/* Entity Header */}
            <div className={`mb-6 pb-6 border-b ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-700'}`}>
              <h3 className={`text-2xl font-bold ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'}`}>
                {data.entityName}
              </h3>
            </div>

            {/* Entity Fields */}
            <div className="space-y-6">
              {sortedFields.map((field) => renderField(field, theme))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

