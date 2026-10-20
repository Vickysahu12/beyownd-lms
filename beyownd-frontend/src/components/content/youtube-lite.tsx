"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlayIcon } from "@hugeicons/core-free-icons";

/*
 * Lite YouTube facade (BRIEF §8): a thumbnail and a play button. The heavy
 * iframe (privacy-enhanced youtube-nocookie) loads only after a tap.
 */
export function YouTubeLite({ id, title }: { id: string; title: string }) {
  const [play, setPlay] = useState(false);
  return (
    <div className="relative aspect-video overflow-hidden rounded-[20px] bg-ink">
      {play ? (
        <iframe
          className="absolute inset-0 size-full"
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button type="button" onClick={() => setPlay(true)} className="group absolute inset-0 size-full" aria-label={`Play video: ${title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail in a fixed box */}
          <img src={`https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover opacity-90 transition-opacity duration-300 group-hover:opacity-100" />
          <span className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-[var(--shadow-lift)] transition-transform duration-200 ease-out group-hover:scale-105 group-active:scale-95">
            <HugeiconsIcon icon={PlayIcon} size={26} strokeWidth={2} aria-hidden />
          </span>
        </button>
      )}
    </div>
  );
}
