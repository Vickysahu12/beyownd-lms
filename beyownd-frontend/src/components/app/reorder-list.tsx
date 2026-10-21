"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUp01Icon, DragDropVerticalIcon } from "@hugeicons/core-free-icons";

/*
 * Reorderable list without a new dependency: native HTML drag-and-drop on
 * desktop, plus up/down buttons that work with the keyboard, touch and
 * screen readers. The new order is applied optimistically and sent as one
 * request; on failure the parent refetches and the list snaps back.
 */
export function ReorderList<T extends { id: string }>({
  items,
  onReorder,
  render,
  label,
}: {
  items: T[];
  onReorder: (ids: string[]) => Promise<unknown>;
  render: (item: T, index: number) => React.ReactNode;
  label: string;
}) {
  const [order, setOrder] = useState(items);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  // New data from the server (after save or refetch) replaces the local order.
  const [source, setSource] = useState(items);
  if (source !== items) {
    setSource(items);
    setOrder(items);
  }

  const commit = async (next: T[], moved: T) => {
    const prev = order;
    setOrder(next);
    setAnnounce(`${label} moved to position ${next.indexOf(moved) + 1} of ${next.length}`);
    try {
      await onReorder(next.map((i) => i.id));
    } catch {
      setOrder(prev);
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    commit(next, it);
  };

  return (
    <>
      <ul className="divide-y divide-line">
        {order.map((item, i) => (
          <li
            key={item.id}
            draggable
            data-dragging={drag === item.id}
            data-over={over === item.id && drag !== item.id}
            onDragStart={(e) => {
              setDrag(item.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(item.id);
            }}
            onDragLeave={() => setOver((o) => (o === item.id ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              const from = order.findIndex((x) => x.id === drag);
              setDrag(null);
              setOver(null);
              if (from >= 0) move(from, i);
            }}
            onDragEnd={() => {
              setDrag(null);
              setOver(null);
            }}
            className="drag-row flex items-center gap-2 bg-white transition-opacity"
          >
            <span aria-hidden className="hidden cursor-grab pl-3 text-muted active:cursor-grabbing sm:block">
              <HugeiconsIcon icon={DragDropVerticalIcon} size={16} strokeWidth={1.7} />
            </span>
            <div className="min-w-0 flex-1">{render(item, i)}</div>
            <div className="flex shrink-0 flex-col pr-2">
              <button type="button" aria-label={`Move ${label} up`} disabled={i === 0} onClick={() => move(i, i - 1)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink disabled:opacity-30">
                <HugeiconsIcon icon={ArrowUp01Icon} size={15} strokeWidth={1.8} aria-hidden />
              </button>
              <button type="button" aria-label={`Move ${label} down`} disabled={i === order.length - 1} onClick={() => move(i, i + 1)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink disabled:opacity-30">
                <HugeiconsIcon icon={ArrowDown01Icon} size={15} strokeWidth={1.8} aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <span className="sr-only" aria-live="polite">{announce}</span>
    </>
  );
}
