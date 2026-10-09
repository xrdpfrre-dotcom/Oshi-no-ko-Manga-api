import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { MangaApiResponse, MangaChapter } from './types/manga';
import { MangaPageImage } from './components/MangaPageImage';

const API_ENDPOINT = '/api/manga';

const FALLBACK_CHAPTER: MangaChapter = {
  chapter: '1',
  url: 'https://readoshino.com/manga/oshi-no-ko-chapter-1/',
  imageCount: 10,
  imageUrls: [
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhcvDChsbts0CKsZJhSopgdL0x-pxY7yuQQSr75wngIYgFodSEbb3oeZhP0GqFglmsxZG2OECBHGy9rN-lLBy2VtmPF_g-F8-peWvrqCp8JTXfzMmuEBzWqOhMBA-q3Y_LPOzKJpO6Fmvi1hFl1nnqT0AUkHWFuvHfig3jkKNHANBbtfzLsGNknJ6qGsak/s1600/01.jpg',
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjEphMa1PlcLjizF1E2Oo7F2g46AAG5pvAAKUcVLfX9diFntfO1DlS6PttUPPySCxLUnc5KAwRerMcQ74oYLe4b52mkk1yb8N7VILs3jZAKqS7Bkv9smnX9diVHWFP4Q7lTF8CKSm6_rC6ir5TL9-__yMFP-AVSnwdUQa-QEqOdxJt1LLnlWH51zVJETVg/s1600/02.jpg',
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjnLrVpA4J8p7h9W3h6T6gGY0zTGU-jE2dS1ZJbVrVNorMUglpxS8h4wuGdAs0cj8u5rrIb6htT-suvPdfmdfdbJxjv4u6_S7d1zQfFPOFod7eDqV4cz6CQrFO9XwV2cXj1GDD7ocUFacR6Oa3APVKCau3Q7OeLTKvPKGTyLzRnfTio8rIxIOGQc6-_DB0/s1600/03.jpg',
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjkH1pwM-cNarXe51gS0khR802Qv46A1CVLz5rxmf_ZlQdQVAl98aRAFA68PSQW5ITfJEn1IbL6UfCMf0nlF64VMrIAtuh9MpYITpC3cOjN0DTVWHqFtZ1jgGu9hPx08s7x4-uQv1tN37vLQXZg69GSBfyg6OPNGuLVGsuQu8Zc-XiloP61mSb4dMMteFU/s1600/04.jpg',
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhz1ZUdpZGV2EDmuwgPFO4644c0D9rK0IhjgJjg8RUFerRddSzwxohnztyVVkTVJJ-usd_pEtIVWvGXj_p8PwpXaHp_6V0d1_Mq4WP6qezpZEVmwQKyeKha0Tz_HRLGuw1YJ2-m2f6036IObUfOETUkK0LDNDMdgNDMjaAW7a2qimoIJuWi4i59g-8Nq18/s1600/05.jpg',
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEi3U_vJGbOsFJnZDBdh6mt1NupSIx2HjAH5heynsqA27wqEKsguvC3aKidm46nqNTL7ii8qwNm7faKJ0hqseoK9pTBcmnTKQUWwm80NH7c0_ebJIlL0gpdJ3nv5JYak2zf4TghkmZ4iqnnV7y78NxO3TZQfrNBow5ajk-jNDgoqX3rCejkz3MTVIKrZK6U/s1600/06.jpg',
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjKbEL7ac1Nbw8GfYTvLbPiCnRQZTPv09oDhz1c3b2oglIfr3VnejhlAthFOFe8ZyGvxnvw2KuaKD1fIJuS0EejOLRwjsn3JD0PnXlNekmhXbE4n2aEXhuDSnGMEGbOeBPYiwSPUwEUZuIbZfzaaLWNa34gZt88wN3Y7upmKnm0ZrYmdAWiheTXCZUSawY/s1600/07.jpg',
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgAf2z11tVBWrgMpFTsRCHSRe__LPjjL4Ne2HzY-PKEbFxBMrGB92Hezhe9gNPvKy3GPf9ZClhDCZ7JNPgiyLlQuPOfFqkXA7WfYAzCkK0XG8Aqj8H93mr9PZNnmP3cZaw5RCeBFPXWjFV0OWADDeSWaOOpkS4XrA7vzhv8OzaPxAOe-1MUELRQAVPxPjk/s1600/08.jpg',
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjKP7Sbf2ZCTowFbQRS2aseqBt1NseLVzqbRUPElwhAPVB1PoL8hpudwXaUA2W8YySGmxUw6nhJzye6nIexqaXd2iPNe_5tkRuPgSWV8jdVLEDKrR_ghlsX9DewjmV3ucsPdYNfo4AflDdScThW1SYLYY6qDLWhjro9Ba4Minn7hVYN2szUAg_LZWe6sxs/s1600/09.jpg',
    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEidhQFEsGp3iDBH-K-ElVOwfM_DUvOcgd3R9kpr7DYzJ9Rc2ci47R9vFMLiRFNiGaFq7V95qV1QdkF9k9YrkGzRSK6QSoUcBncB23mxjxHBZf0iA_-k5hjTTHSaVpfsq921rxeetPMeNtvsBWSRdsviS_QcECqvl_RpiS-EeXOtau8a2817Z8uageJEdkM/s1600/10.jpg',
  ],
};

interface GlobalPhotoItem {
  globalIndex: number;
  chapterNumber: string;
  pageInChapter: number;
  totalInChapter: number;
  url: string;
}

export default function App() {
  const [mangaData, setMangaData] = useState<MangaApiResponse | null>(null);
  const [currentGlobalIdx, setCurrentGlobalIdx] = useState<number>(0);

  const touchStartXRef = useRef<number | null>(null);
  const wheelLockRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    fetch(API_ENDPOINT)
      .then((res) => res.json())
      .then((data: MangaApiResponse) => {
        if (isMounted && data && Array.isArray(data.chapters) && data.chapters.length > 0) {
          const sortedChapters = [...data.chapters].sort((a, b) => {
            const numA = parseFloat(a.chapter) || 0;
            const numB = parseFloat(b.chapter) || 0;
            return numA - numB;
          });
          setMangaData({
            ...data,
            chapters: sortedChapters,
          });
        }
      })
      .catch(() => {
        // Fallback chapter stays active if offline
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const chapters = useMemo(
    () => (mangaData?.chapters?.length ? mangaData.chapters : [FALLBACK_CHAPTER]),
    [mangaData]
  );

  // Combine every single photo from all 169 chapters into one continuous book sequence
  const allPhotos = useMemo<GlobalPhotoItem[]>(() => {
    const list: GlobalPhotoItem[] = [];
    let gIdx = 0;
    chapters.forEach((ch) => {
      const urls = ch.imageUrls || [];
      urls.forEach((url, pIdx) => {
        list.push({
          globalIndex: gIdx++,
          chapterNumber: ch.chapter,
          pageInChapter: pIdx + 1,
          totalInChapter: urls.length,
          url,
        });
      });
    });
    return list;
  }, [chapters]);

  const totalGlobalPhotos = allPhotos.length;
  const activePhoto = allPhotos[currentGlobalIdx] || allPhotos[0];

  // Preload next 3 photos in background so turning pages is instant
  useEffect(() => {
    for (let offset = 1; offset <= 3; offset++) {
      const nextUrl = allPhotos[currentGlobalIdx + offset]?.url;
      if (nextUrl) {
        const img = new Image();
        img.referrerPolicy = 'no-referrer';
        img.src = nextUrl;
      }
    }
  }, [currentGlobalIdx, allPhotos]);

  const handleNextPhoto = useCallback(() => {
    setCurrentGlobalIdx((prev) => Math.min(totalGlobalPhotos - 1, prev + 1));
  }, [totalGlobalPhotos]);

  const handlePrevPhoto = useCallback(() => {
    setCurrentGlobalIdx((prev) => Math.max(0, prev - 1));
  }, []);

  // Keyboard navigation (ArrowRight / Space = Next, ArrowLeft = Prev)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextPhoto();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevPhoto();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNextPhoto, handlePrevPhoto]);

  return (
    <div
      onTouchStart={(e) => {
        touchStartXRef.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartXRef.current === null) return;
        const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
        const diff = endX - touchStartXRef.current;
        if (diff < -40) {
          handleNextPhoto();
        } else if (diff > 40) {
          handlePrevPhoto();
        }
        touchStartXRef.current = null;
      }}
      onWheel={(e) => {
        if (wheelLockRef.current) return;
        if (Math.abs(e.deltaY) > 25 || Math.abs(e.deltaX) > 25) {
          wheelLockRef.current = true;
          if (e.deltaY > 0 || e.deltaX > 0) {
            handleNextPhoto();
          } else {
            handlePrevPhoto();
          }
          setTimeout(() => {
            wheelLockRef.current = false;
          }, 220);
        }
      }}
      className="relative w-screen h-screen bg-[#090A0D] overflow-hidden select-none"
    >
      {/* Left Half of Screen: Tap/Click to go to Previous Page */}
      <div
        onClick={handlePrevPhoto}
        className="absolute inset-y-0 left-0 w-1/2 z-20 cursor-pointer"
      />

      {/* Right Half of Screen: Tap/Click to go to Next Page */}
      <div
        onClick={handleNextPhoto}
        className="absolute inset-y-0 right-0 w-1/2 z-20 cursor-pointer"
      />

      {/* 100% Full-Screen Single Book Page Photo */}
      {activePhoto && (
        <MangaPageImage
          src={activePhoto.url}
          alt={`Chapter ${activePhoto.chapterNumber} Page ${activePhoto.pageInChapter}`}
        />
      )}
    </div>
  );
}
