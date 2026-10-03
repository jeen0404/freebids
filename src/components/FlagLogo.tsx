import React, { useState } from 'react';

interface FlagLogoProps {
  name: string;
  color: string;
  logoUrl: string | null;
  /** Pixel size of the square tile. */
  size?: number;
  className?: string;
}

/**
 * Rounded square logo; falls back to the first letter on the flag's color when there is no logo or it fails to load.
 * Google's favicon service answers unknown sites with a 16px placeholder, which counts as no logo.
 */
export const FlagLogo: React.FC<FlagLogoProps> = ({ name, color, logoUrl, size = 56, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const showImage = logoUrl && !failed;
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line font-semibold text-white ${className}`}
      style={{ width: size, height: size, background: showImage ? 'var(--color-surface)' : color, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          onLoad={(e) => e.currentTarget.naturalWidth < 32 && setFailed(true)}
          className="h-[70%] w-[70%] object-contain"
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
};
