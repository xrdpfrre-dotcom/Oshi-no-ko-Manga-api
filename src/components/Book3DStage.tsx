import React, { useMemo, useState, useRef } from 'react';
import { BookSheet, MangaChapter } from '../types/manga';
import { MangaPageImage } from './MangaPageImage';

interface Book3DStageProps {
  chapter: MangaChapter;
  allChapters: MangaChapter[];
  selectedChapterIdx: number;
  onSelectChapter: (idx: number) => void;
  currentSheet: number;
  onChangeSheet: (newSheet: number) => void;
  rotX: number;
  rotY: number;
  zoom: number;
  onOrbitChange: (dx: number, dy: number) => void;
  onInspectPage: (src: string, pageNumber?: number) => void;
  isLoadingApi?: boolean;
}

// Synthesize crisp manga paper flip sound via Web Audio API
function playPageFlipSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const duration = 0.18;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const env = Math.sin(t * Math.PI) * Math.pow(1 - t, 1.3);
      data[i] = (Math.random() * 2 - 1) * env * 0.09;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, ctx.currentTime);
    filter.Q.setValueAtTime(1.5, ctx.currentTime);

    noise.connect(filter);
    filter.connect(ctx.destination);
    noise.start();
    noise.onended = () => {
      ctx.close().catch(() => {});
    };
  } catch {
    // Ignore audio errors
  }
}

export const Book3DStage: React.FC<Book3DStageProps> = ({
  chapter,
  allChapters,
  selectedChapterIdx,
  onSelectChapter,
  currentSheet,
  onChangeSheet,
  rotX,
  rotY,
  zoom,
  onOrbitChange,
  onInspectPage,
  isLoadingApi,
}) => {
  const [draggingSheetIdx, setDraggingSheetIdx] = useState<number | null>(null);
  const [dragDirection, setDragDirection] = useState<'forward' | 'backward' | null>(null);
  const [dragProgress, setDragProgress] = useState<number>(0);

  // Obi Belly-Band / Bookmark Chapter Index Modal (part of the physical book!)
  const [indexOpen, setIndexOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const isOrbitingRef = useRef<boolean>(false);
  const lastOrbitPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartXRef = useRef<number>(0);
  const didDragMoveRef = useRef<boolean>(false);
  const bookContainerRef = useRef<HTMLDivElement | null>(null);

  // Build physical sheets from ALL imageUrls of the current chapter
  // Sheet 0: Front = Glossy Tankobon Manga Cover + Obi Band, Back = Page 1 (or Table of Contents)
  const sheets = useMemo<BookSheet[]>(() => {
    const urls = chapter.imageUrls || [];
    const result: BookSheet[] = [];

    result.push({
      sheetIndex: 0,
      frontType: 'cover',
      backType: urls.length > 0 ? 'page' : 'cover-inner',
      backPageNumber: urls.length > 0 ? 1 : undefined,
      backImageUrl: urls[0],
    });

    let imgIdx = 1;
    let sheetCounter = 1;

    while (imgIdx < urls.length) {
      const frontUrl = urls[imgIdx];
      const frontPageNum = imgIdx + 1;
      imgIdx++;

      if (imgIdx < urls.length) {
        const backUrl = urls[imgIdx];
        const backPageNum = imgIdx + 1;
        imgIdx++;

        result.push({
          sheetIndex: sheetCounter++,
          frontType: 'page',
          backType: 'page',
          frontPageNumber: frontPageNum,
          backPageNumber: backPageNum,
          frontImageUrl: frontUrl,
          backImageUrl: backUrl,
        });
      } else {
        result.push({
          sheetIndex: sheetCounter++,
          frontType: 'page',
          backType: 'back-cover',
          frontPageNumber: frontPageNum,
          frontImageUrl: frontUrl,
        });
      }
    }

    if (result[result.length - 1].backType !== 'back-cover') {
      result.push({
        sheetIndex: sheetCounter++,
        frontType: 'end-inner',
        backType: 'back-cover',
      });
    }

    return result;
  }, [chapter]);

  const totalSheets = sheets.length;
  const coverImageUrl = chapter.imageUrls?.[0];
  const backCoverPreviewUrl =
    chapter.imageUrls?.[Math.min(2, (chapter.imageUrls?.length || 1) - 1)] || coverImageUrl;

  const horizontalShiftPercent =
    currentSheet === 0 ? -25 : currentSheet >= totalSheets ? 25 : 0;

  // Authentic thick Tankobon Manga Paperback Spine (42px to 60px)
  const bookThicknessPx = Math.min(60, Math.max(40, Math.round(totalSheets * 1.9)));

  const handleSheetPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    sheetIdx: number,
    isFlipped: boolean
  ) => {
    e.stopPropagation();
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    if (!isFlipped && sheetIdx !== currentSheet) return;
    if (isFlipped && sheetIdx !== currentSheet - 1) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStartXRef.current = e.clientX;
    didDragMoveRef.current = false;
    setDraggingSheetIdx(sheetIdx);
    setDragDirection(isFlipped ? 'backward' : 'forward');
    setDragProgress(0);
  };

  const handleSheetPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingSheetIdx === null || !dragDirection) return;
    e.stopPropagation();

    const deltaX = e.clientX - dragStartXRef.current;
    if (Math.abs(deltaX) > 6) {
      didDragMoveRef.current = true;
    }

    const leafWidth = bookContainerRef.current
      ? bookContainerRef.current.clientWidth * 0.48
      : 350;

    if (dragDirection === 'forward') {
      const raw = Math.max(0, Math.min(1, -deltaX / leafWidth));
      setDragProgress(raw);
    } else {
      const raw = Math.max(0, Math.min(1, deltaX / leafWidth));
      setDragProgress(raw);
    }
  };

  const handleSheetPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingSheetIdx === null || !dragDirection) return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const wasQuickTap = !didDragMoveRef.current;
    const shouldCompleteFlip = wasQuickTap || dragProgress > 0.2;

    if (shouldCompleteFlip) {
      playPageFlipSound();
      if (dragDirection === 'forward') {
        onChangeSheet(Math.min(totalSheets, currentSheet + 1));
      } else {
        onChangeSheet(Math.max(0, currentSheet - 1));
      }
    }

    setDraggingSheetIdx(null);
    setDragDirection(null);
    setDragProgress(0);
  };

  const handleDeskPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (indexOpen) {
      setIndexOpen(false);
      return;
    }
    isOrbitingRef.current = true;
    lastOrbitPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleDeskPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isOrbitingRef.current) return;
    const dx = e.clientX - lastOrbitPosRef.current.x;
    const dy = e.clientY - lastOrbitPosRef.current.y;
    lastOrbitPosRef.current = { x: e.clientX, y: e.clientY };
    onOrbitChange(dx * 0.25, -dy * 0.2);
  };

  const handleDeskPointerUp = () => {
    isOrbitingRef.current = false;
  };

  const leftStackRatio = totalSheets > 0 ? currentSheet / totalSheets : 0;
  const rightStackRatio = totalSheets > 0 ? (totalSheets - currentSheet) / totalSheets : 0;

  const filteredChapters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allChapters.map((ch, idx) => ({ ch, idx }));
    return allChapters
      .map((ch, idx) => ({ ch, idx }))
      .filter(({ ch }) => ch.chapter.toLowerCase().includes(q));
  }, [allChapters, searchQuery]);

  return (
    <div
      onPointerDown={handleDeskPointerDown}
      onPointerMove={handleDeskPointerMove}
      onPointerUp={handleDeskPointerUp}
      onPointerCancel={handleDeskPointerUp}
      className="relative w-full h-full flex items-center justify-center overflow-hidden desk-surface scene-3d cursor-grab active:cursor-grabbing"
    >
      {/* Subtle Studio Spotlight */}
      <div
        className="pointer-events-none absolute w-[920px] h-[920px] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(236, 72, 153, 0.16) 0%, rgba(250, 204, 21, 0.08) 45%, rgba(0, 0, 0, 0) 70%)',
        }}
      />

      {/* 3D TANKOBON MANGA VOLUME RIG */}
      <div
        ref={bookContainerRef}
        className="relative preserve-3d transition-transform duration-300 ease-out"
        style={{
          // Authentic Japanese Tankobon B6 Aspect Ratio (Spread is ~1.42 : 1)
          width: 'min(94vw, 920px)',
          height: 'min(84vh, 660px)',
          transform: `scale(${zoom}) rotateX(${rotX}deg) rotateY(${rotY}deg) translateX(${horizontalShiftPercent}%)`,
        }}
      >
        {/* Realistic Drop Shadow on Desk */}
        <div
          className="pointer-events-none absolute inset-x-[5%] bottom-[-30px] h-[64px] rounded-full blur-2xl opacity-90 transition-all duration-500"
          style={{
            background: 'rgba(0, 0, 0, 0.92)',
            transform: `translateZ(-${bookThicknessPx + 26}px)`,
          }}
        />

        {/* PHYSICAL MANGA SHIORI (BOOKMARK TAB) STICKING OUT TOP OF SPINE — Tap to jump to any of the 169 API Chapters */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIndexOpen((prev) => !prev);
          }}
          title="Tap Manga Bookmark Tab to choose any of the 169 Chapters"
          className="absolute left-1/2 -top-12 z-50 -translate-x-1/2 preserve-3d cursor-pointer group"
          style={{
            transform: `translateZ(${bookThicknessPx * 0.42}px)`,
          }}
        >
          <div className="relative px-3.5 h-14 bg-[#E11D48] text-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col items-center justify-center transition-transform duration-200 group-hover:-translate-y-1.5">
            <span className="text-[8px] font-black tracking-widest uppercase text-yellow-300 leading-none">
              【推しの子】
            </span>
            <span className="font-mono-tabular text-[11px] font-black tracking-tight leading-tight mt-0.5">
              CH.{chapter.chapter} / {allChapters.length}
            </span>
          </div>
        </div>

        {/* 3D JAPANESE TANKOBON SPINE (Hinge at X = 50%) */}
        <div
          className="absolute top-0 bottom-0 left-1/2 preserve-3d pointer-events-none"
          style={{
            width: `${bookThicknessPx}px`,
            marginLeft: `-${bookThicknessPx / 2}px`,
            transform: `translateZ(-${bookThicknessPx / 2}px)`,
          }}
        >
          <div
            className="w-full h-full flex flex-col items-center justify-between py-3 bg-white text-black border-x-2 border-black shadow-2xl overflow-hidden"
            style={{
              transform: `rotateY(180deg) translateZ(${bookThicknessPx / 2}px)`,
            }}
          >
            {/* Top Shueisha Young Jump Style Stamp */}
            <div className="w-full bg-[#E11D48] text-white py-1 text-center font-black text-[9px] tracking-tighter border-b-2 border-black">
              YJ COMICS
            </div>

            {/* Vertical Japanese + English Manga Spine Title */}
            <div
              className="font-black text-xs tracking-[0.2em] uppercase text-black whitespace-nowrap my-auto"
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
              }}
            >
              【推しの子】 OSHI NO KO
            </div>

            {/* Bold Manga Volume/Chapter Number Box on Spine */}
            <div className="w-8 h-8 rounded-full bg-black text-yellow-300 font-mono-tabular font-black text-xs flex items-center justify-center border-2 border-[#E11D48]">
              {chapter.chapter}
            </div>

            {/* Bottom Author Name on Spine */}
            <div className="text-[8px] font-bold tracking-tighter uppercase text-zinc-700">
              AKASAKA
            </div>
          </div>
        </div>

        {/* LEFT MANGA PAPERBACK STACK & FRENCH FLAP (Visible when book is open) */}
        {currentSheet > 0 && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 left-[-4px] w-[calc(50%+4px)] rounded-l-[2px] preserve-3d"
            style={{
              background: '#18181B',
              border: '2px solid #000000',
              transform: `translateZ(-${bookThicknessPx * 0.5}px)`,
              boxShadow: '-10px 20px 34px rgba(0,0,0,0.8)',
            }}
          >
            {/* Thick Manga Newsprint Paper Block Stack on Left */}
            <div
              className="absolute top-[2px] bottom-[2px] left-[2px] manga-paper-stack-left border-l border-zinc-400"
              style={{
                width: `${Math.max(5, Math.round(leftStackRatio * 22))}px`,
              }}
            />
          </div>
        )}

        {/* RIGHT MANGA PAPERBACK STACK & FORE-EDGE (Visible before back cover) */}
        {currentSheet < totalSheets && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 right-[-4px] w-[calc(50%+4px)] rounded-r-[2px] preserve-3d"
            style={{
              background: '#18181B',
              border: '2px solid #000000',
              transform: `translateZ(-${bookThicknessPx * 0.5}px)`,
              boxShadow: '10px 20px 34px rgba(0,0,0,0.8)',
            }}
          >
            {/* Thick Manga Newsprint Paper Block Stack on Right */}
            <div
              className="absolute top-[2px] bottom-[2px] right-[2px] manga-paper-stack-right border-r border-zinc-400"
              style={{
                width: `${Math.max(5, Math.round(rightStackRatio * 22))}px`,
              }}
            />
          </div>
        )}

        {/* ALL PHYSICAL MANGA SHEETS IN 3D SPACE */}
        {sheets.map((sheet, idx) => {
          const isFlipped = idx < currentSheet;
          const isBeingDragged = draggingSheetIdx === idx;

          const progressRatio = totalSheets > 1 ? idx / (totalSheets - 1) : 0;
          const unflippedZ = (0.5 - progressRatio) * bookThicknessPx;
          const flippedZ = (progressRatio - 0.5) * bookThicknessPx;

          let rotationY = isFlipped ? -180 : 0;
          let dynamicLiftZ = isFlipped ? flippedZ : unflippedZ;

          if (isBeingDragged && dragDirection) {
            if (dragDirection === 'forward') {
              rotationY = -dragProgress * 180;
              dynamicLiftZ =
                unflippedZ * (1 - dragProgress) +
                flippedZ * dragProgress +
                Math.sin(dragProgress * Math.PI) * 30;
            } else {
              rotationY = -180 + dragProgress * 180;
              dynamicLiftZ =
                flippedZ * (1 - dragProgress) +
                unflippedZ * dragProgress +
                Math.sin(dragProgress * Math.PI) * 30;
            }
          }

          const turnShadowAlpha = isBeingDragged
            ? Math.sin(dragProgress * Math.PI) * 0.45
            : 0;

          const isNearActiveSpread =
            Math.abs(idx - currentSheet) <= 2 ||
            idx === 0 ||
            idx === totalSheets - 1;

          const isInteractiveSheet =
            idx === currentSheet || idx === currentSheet - 1;

          return (
            <div
              key={sheet.sheetIndex}
              onPointerDown={(e) => handleSheetPointerDown(e, idx, isFlipped)}
              onPointerMove={handleSheetPointerMove}
              onPointerUp={handleSheetPointerUp}
              onPointerCancel={handleSheetPointerUp}
              className={`absolute top-0 bottom-0 left-1/2 w-1/2 preserve-3d ${
                isInteractiveSheet
                  ? 'cursor-pointer pointer-events-auto'
                  : 'pointer-events-none'
              }`}
              style={{
                transformOrigin: 'left center',
                transform: `translateZ(${dynamicLiftZ.toFixed(2)}px) rotateY(${rotationY.toFixed(2)}deg)`,
                transition: isBeingDragged
                  ? 'none'
                  : 'transform 640ms cubic-bezier(0.22, 1, 0.36, 1)',
                zIndex: isBeingDragged
                  ? totalSheets + 20
                  : isFlipped
                  ? idx + 1
                  : totalSheets - idx + 1,
              }}
            >
              {/* FRONT FACE OF SHEET (Right side before flipping) */}
              <div
                className="absolute inset-0 backface-hidden overflow-hidden rounded-r-[2px]"
                style={{
                  borderRight:
                    sheet.frontType === 'cover'
                      ? '2px solid #18181B'
                      : '2px solid #D4D0C8',
                  borderBottom: '2px solid #C4BFB6',
                  boxShadow: isBeingDragged
                    ? `-18px 20px 42px rgba(0,0,0,${(0.35 + turnShadowAlpha).toFixed(2)})`
                    : '0 10px 28px rgba(0,0,0,0.48)',
                }}
              >
                {isBeingDragged && (
                  <div
                    className="pointer-events-none absolute inset-0 z-40"
                    style={{
                      background: `linear-gradient(to left, rgba(0,0,0,${turnShadowAlpha.toFixed(
                        2
                      )}) 0%, transparent 65%)`,
                    }}
                  />
                )}

                {sheet.frontType === 'cover' ? (
                  /* AUTHENTIC JAPANESE TANKOBON FULL-BLEED GLOSSY MANGA COVER + OBI BELLY-BAND */
                  <div className="relative w-full h-full bg-zinc-950 overflow-hidden select-none">
                    {/* Full-Bleed Chapter Artwork from API */}
                    {coverImageUrl && (
                      <img
                        src={coverImageUrl}
                        alt={`Oshi no Ko Chapter ${chapter.chapter} Manga Cover`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-top"
                        draggable={false}
                      />
                    )}

                    {/* Glossy Laminated Cover Specular Reflection Sheen */}
                    <div
                      className="pointer-events-none absolute inset-0 z-10"
                      style={{
                        background:
                          'linear-gradient(115deg, rgba(255,255,255,0) 20%, rgba(255,255,255,0.16) 36%, rgba(255,255,255,0) 48%)',
                      }}
                    />

                    {/* Spine Fold Crease Along Left Edge of Cover */}
                    <div className="pointer-events-none absolute top-0 bottom-0 left-0 w-4 z-20 bg-gradient-to-r from-black/65 via-white/25 to-transparent" />

                    {/* Top Japanese Manga Logo Lockup & Volume Badge */}
                    <div className="absolute top-3 inset-x-3 z-20 flex items-start justify-between pointer-events-none">
                      <div className="bg-black/85 text-white px-3 py-1.5 border-2 border-white shadow-[4px_4px_0px_#E11D48]">
                        <p className="text-[10px] font-black tracking-[0.25em] text-pink-400 leading-none">
                          【推しの子】
                        </p>
                        <h1 className="font-black text-xl sm:text-2xl tracking-tight uppercase leading-none mt-0.5">
                          OSHI NO KO
                        </h1>
                      </div>

                      {/* Manga Volume / Chapter Burst Badge */}
                      <div className="bg-[#FACC15] text-black border-2 border-black px-2.5 py-1 shadow-[3px_3px_0px_#000] text-center">
                        <span className="block text-[8px] font-black uppercase leading-none">
                          CHAPTER
                        </span>
                        <span className="font-mono-tabular text-lg font-black leading-none">
                          #{chapter.chapter}
                        </span>
                      </div>
                    </div>

                    {/* Vertical Japanese Idol Catchphrase on Right Margin */}
                    <div
                      className="pointer-events-none absolute top-20 right-3 z-20 bg-white/95 text-black px-1 py-2 border border-black font-black text-[10px] tracking-widest shadow-md"
                      style={{
                        writingMode: 'vertical-rl',
                        textOrientation: 'upright',
                      }}
                    >
                      赤坂アカ×横槍メンゴ
                    </div>

                    {/* AUTHENTIC REMOVABLE-STYLE JAPANESE MANGA OBI (BELLY BAND) AT BOTTOM OF COVER */}
                    {/* Tapping the Obi Band opens the full 169-Chapter Selector */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setIndexOpen(true);
                      }}
                      title="Tap Manga Obi Band to browse all 169 API Chapters"
                      className="absolute bottom-0 inset-x-0 z-30 bg-[#111113]/95 border-t-4 border-[#FACC15] p-3 sm:p-4 text-white shadow-[0_-8px_25px_rgba(0,0,0,0.7)] hover:bg-[#18181C] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="inline-block bg-[#E11D48] text-white text-[9px] font-black uppercase px-1.5 py-0.5 tracking-wider mb-1">
                            COMPLETE API ARCHIVE · {allChapters.length} CHAPTERS
                          </div>
                          <p className="font-black text-sm sm:text-base tracking-wide text-yellow-300 leading-tight">
                            CHAPTER {chapter.chapter} ({chapter.imageCount} MANGA PAGES)
                          </p>
                          <p className="text-[10px] text-zinc-300 mt-0.5">
                            {isLoadingApi
                              ? 'Syncing all 169 chapters from API...'
                              : 'Tap this Obi Band to switch any Chapter (1–166) · Swipe Cover to Read'}
                          </p>
                        </div>

                        <div className="shrink-0 bg-[#FACC15] text-black font-mono-tabular font-black text-xs px-2.5 py-2 border-2 border-black shadow-[2px_2px_0px_#E11D48] uppercase">
                          ALL {allChapters.length} CH ▾
                        </div>
                      </div>
                    </div>
                  </div>
                ) : sheet.frontType === 'page' ? (
                  isNearActiveSpread ? (
                    <MangaPageImage
                      src={sheet.frontImageUrl}
                      alt={`Oshi no Ko Ch ${chapter.chapter} Page ${sheet.frontPageNumber}`}
                      pageNumber={sheet.frontPageNumber}
                      totalPages={chapter.imageCount}
                      chapterNumber={chapter.chapter}
                      side="right"
                      onImageClick={onInspectPage}
                    />
                  ) : (
                    <div className="w-full h-full bg-[#FAF9F5]" />
                  )
                ) : (
                  /* End of Chapter Manga Next-Volume Promo Leaf */
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedChapterIdx < allChapters.length - 1) {
                        onSelectChapter(selectedChapterIdx + 1);
                      } else {
                        setIndexOpen(true);
                      }
                    }}
                    className="w-full h-full bg-[#FAF9F5] text-black flex flex-col items-center justify-center p-6 text-center manga-screentone cursor-pointer"
                  >
                    <div className="border-4 border-black bg-white p-6 shadow-[6px_6px_0px_#000] max-w-[240px]">
                      <p className="text-[10px] font-black tracking-widest uppercase text-[#E11D48]">
                        【推しの子】 TO BE CONTINUED
                      </p>
                      <p className="font-black text-lg uppercase mt-1">
                        END OF CH. {chapter.chapter}
                      </p>
                      <p className="text-xs text-zinc-600 mt-2">
                        {selectedChapterIdx < allChapters.length - 1
                          ? `Tap here to load Next Chapter (${
                              allChapters[selectedChapterIdx + 1]?.chapter
                            }) →`
                          : 'Tap to browse all 169 Chapters'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* BACK FACE OF SHEET (Left side after flipping) */}
              <div
                className="absolute inset-0 backface-hidden overflow-hidden rounded-l-[2px]"
                style={{
                  transform: 'rotateY(180deg)',
                  borderLeft:
                    sheet.backType === 'back-cover'
                      ? '2px solid #18181B'
                      : '2px solid #D4D0C8',
                  borderBottom: '2px solid #C4BFB6',
                  boxShadow: isBeingDragged
                    ? `18px 20px 42px rgba(0,0,0,${(0.35 + turnShadowAlpha).toFixed(2)})`
                    : '0 10px 28px rgba(0,0,0,0.48)',
                }}
              >
                {isBeingDragged && (
                  <div
                    className="pointer-events-none absolute inset-0 z-40"
                    style={{
                      background: `linear-gradient(to right, rgba(0,0,0,${turnShadowAlpha.toFixed(
                        2
                      )}) 0%, transparent 65%)`,
                    }}
                  />
                )}

                {sheet.backType === 'page' ? (
                  isNearActiveSpread ? (
                    <MangaPageImage
                      src={sheet.backImageUrl}
                      alt={`Oshi no Ko Ch ${chapter.chapter} Page ${sheet.backPageNumber}`}
                      pageNumber={sheet.backPageNumber}
                      totalPages={chapter.imageCount}
                      chapterNumber={chapter.chapter}
                      side="left"
                      onImageClick={onInspectPage}
                    />
                  ) : (
                    <div className="w-full h-full bg-[#FAF9F5]" />
                  )
                ) : sheet.backType === 'back-cover' ? (
                  /* AUTHENTIC JAPANESE TANKOBON BACK COVER WITH ISBN BARCODE, YEN PRICE & SYNOPSIS */
                  <div className="relative w-full h-full bg-white text-black p-6 flex flex-col justify-between overflow-hidden select-none manga-screentone">
                    {/* Right Spine Fold Crease */}
                    <div className="pointer-events-none absolute top-0 bottom-0 right-0 w-4 z-20 bg-gradient-to-l from-black/55 via-black/10 to-transparent" />

                    {/* Top Shueisha Manga Header */}
                    <div className="flex items-center justify-between border-b-2 border-black pb-2">
                      <span className="font-black text-xs tracking-widest uppercase">
                        YOUNG JUMP COMICS · 【推しの子】
                      </span>
                      <span className="font-mono-tabular text-xs font-black bg-black text-white px-2 py-0.5">
                        CH.{chapter.chapter}
                      </span>
                    </div>

                    {/* Manga Panel Preview Cutout on Back Cover */}
                    <div className="my-3 relative flex-1 border-2 border-black shadow-[5px_5px_0px_#E11D48] overflow-hidden bg-zinc-900">
                      {backCoverPreviewUrl && (
                        <img
                          src={backCoverPreviewUrl}
                          alt="Back Cover Manga Panel"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover object-center grayscale contrast-125"
                          draggable={false}
                        />
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-black/85 text-white p-2.5 text-[10px] leading-snug">
                        “In the entertainment world, lies are the greatest weapon.” — Complete {chapter.imageCount}-page manga chapter bound straight from the live Oshi no Ko archive.
                      </div>
                    </div>

                    {/* Authentic Japanese ISBN Barcode & Yen Price Box */}
                    <div className="flex items-end justify-between gap-3 pt-2 border-t-2 border-black bg-white p-2">
                      <div className="text-left font-mono-tabular text-[9px] leading-tight text-zinc-700">
                        <p className="font-bold text-black">ISBN978-4-08-891650-{chapter.chapter}</p>
                        <p>C9979 ¥680E</p>
                        <p>定価 本体680円＋税</p>
                      </div>

                      {/* Visual CSS Barcode */}
                      <div className="flex flex-col items-center">
                        <div
                          className="w-28 h-8"
                          style={{
                            background:
                              'repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px, #000 4px, #000 5px, #fff 5px, #fff 8px, #000 8px, #000 11px, #fff 11px, #fff 13px)',
                          }}
                        />
                        <span className="font-mono-tabular text-[8px] tracking-widest mt-0.5">
                          9784088916507
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full bg-[#FAF9F5]" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MANGA TABLE OF CONTENTS (MOKUJI) OVERLAY — Opens when tapping the Obi Belly-Band or Top Shiori Bookmark */}
      {indexOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-2xl max-h-[84vh] bg-[#FAF9F5] text-black border-4 border-black shadow-[12px_12px_0px_#E11D48] flex flex-col overflow-hidden manga-screentone">
            {/* Mokuji Header */}
            <div className="bg-black text-white px-5 py-4 flex items-center justify-between border-b-4 border-[#FACC15]">
              <div>
                <p className="text-[10px] font-black tracking-[0.25em] text-yellow-300 uppercase">
                  【推しの子】 MOKUJI · TABLE OF CONTENTS
                </p>
                <h2 className="font-black text-lg sm:text-xl tracking-wide uppercase">
                  ALL {allChapters.length} API CHAPTERS AVAILABLE
                </h2>
              </div>
              <div
                onClick={() => setIndexOpen(false)}
                className="px-3 py-1 bg-[#E11D48] text-white font-mono-tabular font-black text-xs border-2 border-white cursor-pointer"
              >
                CLOSE ✕
              </div>
            </div>

            {/* Quick Chapter Number Search */}
            <div className="p-3 bg-white border-b-2 border-black">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Type any chapter number from 1 to ${allChapters.length}...`}
                className="w-full px-3.5 py-2 border-2 border-black font-mono-tabular text-xs font-bold text-black placeholder:text-zinc-400 focus:outline-none focus:bg-yellow-50"
              />
            </div>

            {/* Grid of All 169 Chapters with Cover Thumbnails & Page Counts */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredChapters.map(({ ch, idx }) => {
                const isCurrent = idx === selectedChapterIdx;
                const thumb = ch.imageUrls?.[0];
                return (
                  <div
                    key={ch.chapter}
                    onClick={() => {
                      onSelectChapter(idx);
                      setIndexOpen(false);
                    }}
                    className={`group flex items-center gap-2.5 p-2 border-2 border-black cursor-pointer transition-transform hover:-translate-y-0.5 ${
                      isCurrent
                        ? 'bg-[#FACC15] shadow-[4px_4px_0px_#000]'
                        : 'bg-white hover:bg-pink-50 shadow-[3px_3px_0px_#000]'
                    }`}
                  >
                    <div className="w-11 h-15 bg-zinc-900 border border-black shrink-0 overflow-hidden">
                      {thumb && (
                        <img
                          src={thumb}
                          alt={`Ch ${ch.chapter}`}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="w-full h-full object-cover object-top"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono-tabular font-black text-xs uppercase truncate">
                        CH. {ch.chapter}
                      </p>
                      <p className="font-mono-tabular text-[10px] font-bold text-zinc-600 mt-0.5">
                        {ch.imageCount} Pages
                      </p>
                      {isCurrent && (
                        <span className="inline-block mt-1 px-1 bg-black text-yellow-300 text-[8px] font-black uppercase">
                          READING
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
