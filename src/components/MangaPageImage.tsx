import React, { useState } from 'react';

interface MangaPageImageProps {
  src?: string;
  alt: string;
}

export const MangaPageImage: React.FC<MangaPageImageProps> = ({ src, alt }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  if (!src) {
    return <div className="w-full h-full bg-[#090A0D]" />;
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-[#090A0D] select-none">
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#090A0D] z-10">
          <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/70 animate-spin" />
        </div>
      )}

      {error ? (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setError(false);
            setLoaded(false);
            setRetryKey((k) => k + 1);
          }}
          className="flex items-center justify-center w-full h-full text-white/50 text-xs cursor-pointer"
        >
          Tap to reload page
        </div>
      ) : (
        <img
          key={`${src}-${retryKey}`}
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="eager"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`max-w-full max-h-full w-auto h-auto object-contain transition-opacity duration-150 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          draggable={false}
        />
      )}
    </div>
  );
};
