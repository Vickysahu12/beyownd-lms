"use client";

import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TextInput } from "./ui";

/*
 * College autocomplete (GET /colleges?q=, debounced 300 ms). Free text is
 * always allowed: the backend maps differently written names to one college.
 * ARIA combobox pattern: arrows move, Enter picks, Esc closes.
 */
type College = { id: string; name: string; studentCount: number };

export function CollegeCombobox({ id, describedBy, value, onChange, invalid }: { id: string; describedBy: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [q, setQ] = useState(value.trim());

  useEffect(() => {
    const t = setTimeout(() => setQ(value.trim()), 300);
    return () => clearTimeout(t);
  }, [value]);

  const res = useQuery({
    queryKey: ["colleges", q.toLowerCase()],
    queryFn: () => api<{ colleges: College[] }>(`/colleges?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    staleTime: 5 * 60_000,
  });
  const options = (res.data?.colleges ?? []).filter((c) => c.name.toLowerCase() !== value.trim().toLowerCase()).slice(0, 6);
  const show = open && options.length > 0;

  const pick = (c: College) => {
    onChange(c.name);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div className="relative">
      <TextInput
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={show}
        aria-controls={listId}
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        invalid={invalid}
        value={value}
        placeholder="Start typing your college name"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % options.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? options.length - 1 : a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(options[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {show ? (
        <ul id={listId} role="listbox" aria-label="Colleges" className="dialog-pop absolute inset-x-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-2xl bg-white py-1 shadow-[var(--shadow-lift)] ring-1 ring-line">
          {options.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(c)}
              className={cn("flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-[14.5px] text-ink", i === active ? "bg-brand-wash" : "hover:bg-canvas")}
            >
              <span className="min-w-0 truncate">{c.name}</span>
              {c.studentCount > 0 ? <span className="shrink-0 text-[12px] text-muted">{c.studentCount} {c.studentCount === 1 ? "student" : "students"}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
