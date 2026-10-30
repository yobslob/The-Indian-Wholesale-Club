'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { publishHomePhotosAction, uploadHomePhotoAction } from '../actions/home-photos';
import { button, input, linkButton, secondaryButton } from '../styles';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_BYTES = 8 * 1024 * 1024;

interface Picked {
  file: File;
  preview: string;
  alt: string;
  problem: string | null;
  done: boolean;
}

/** "holi-in-mathura_2.jpg" → "Holi in mathura 2": a start for the line the founder can change. */
const lineFrom = (name: string): string => {
  const words = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : '';
};

/**
 * Home photos (D-169): choose many at once, give each a line (what it shows, for screen readers), upload. The photos go
 * one by one, so each stays under the server's size limit and a failure stops only that photo; Home is refreshed once
 * when the batch is done. New photos join the end of the grid.
 */
export function HomePhotosUpload(): React.JSX.Element {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked[]>([]);
  const [sending, setSending] = useState<number | null>(null);
  const made = useRef<string[]>([]);

  // the previews are blob addresses: let them go when the page closes
  useEffect(() => () => made.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const choose = (files: FileList | null): void => {
    if (!files) return;
    const added = Array.from(files).map((file) => {
      const preview = URL.createObjectURL(file);
      made.current.push(preview);
      return {
        file,
        preview,
        alt: lineFrom(file.name),
        problem: !TYPES.includes(file.type)
          ? 'not a JPEG, PNG, WebP or AVIF image'
          : file.size > MAX_BYTES
            ? 'larger than 8 MB'
            : null,
        done: false,
      };
    });
    setPicked((before) => [...before, ...added]);
  };
  const set = (i: number, change: Partial<Picked>): void =>
    setPicked((list) => list.map((p, k) => (k === i ? { ...p, ...change } : p)));

  async function send(): Promise<void> {
    let added = 0;
    for (let i = 0; i < picked.length; i++) {
      const p = picked[i]!;
      if (p.done || p.problem || !p.alt.trim()) continue;
      setSending(i);
      const form = new FormData();
      form.set('image', p.file);
      form.set('alt', p.alt);
      const { error } = await uploadHomePhotoAction(form);
      set(i, error ? { problem: error } : { done: true });
      if (!error) added++;
    }
    setSending(null);
    if (added > 0) {
      await publishHomePhotosAction();
      setPicked((list) => list.filter((p) => !p.done));
      router.refresh();
    }
  }

  const ready = picked.filter((p) => !p.done && !p.problem && p.alt.trim()).length;
  const busy = sending !== null;
  return (
    <div className="space-y-3">
      <label className={`${secondaryButton} cursor-pointer`}>
        Choose photos…
        <input
          type="file"
          multiple
          accept={TYPES.join(',')}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            choose(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
      {picked.length > 0 ? (
        <>
          <ul className="grid gap-2">
            {picked.map((p, i) => (
              <li key={p.preview} className="grid grid-cols-[64px_1fr_auto] items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local preview before upload */}
                <img src={p.preview} alt="" className="bg-surface size-16 rounded-md object-cover" />
                <div className="min-w-0 space-y-1">
                  <input
                    value={p.alt}
                    onChange={(e) => set(i, { alt: e.target.value })}
                    maxLength={300}
                    disabled={busy || p.done}
                    aria-label={`What photo ${i + 1} shows`}
                    placeholder="What the photo shows"
                    className={input}
                  />
                  <p className="text-ink-muted truncate text-xs">
                    {p.file.name}
                    {p.problem ? <span className="text-danger"> · {p.problem}</span> : null}
                    {sending === i ? ' · uploading…' : p.done ? ' · added' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className={`${linkButton} text-sm`}
                  disabled={busy}
                  onClick={() => setPicked((list) => list.filter((_, k) => k !== i))}
                >
                  Leave out
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={button} disabled={busy || ready === 0} onClick={() => void send()}>
            {busy ? `Uploading ${(sending ?? 0) + 1} of ${picked.length}…` : `Upload ${ready} ${ready === 1 ? 'photo' : 'photos'}`}
          </button>
        </>
      ) : null}
    </div>
  );
}
