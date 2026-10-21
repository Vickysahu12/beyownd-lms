"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button, Field, TextArea } from "./ui";

/*
 * Confirm dialog for destructive admin actions (refund, revoke, delete, role
 * change). When `reason` is required, the confirm button stays disabled until
 * 5+ characters are typed (the API's audit-log rule). Errors from the API are
 * shown inside the dialog, so nothing closes on failure.
 */
export function ConfirmDialog({
  trigger,
  title,
  body,
  confirmLabel,
  danger = true,
  reason = false,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  reason?: boolean;
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ok = !reason || text.trim().length >= 5;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(text.trim());
      setOpen(false);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="menu-overlay fixed inset-0 z-[60] bg-ink/35" />
        <Dialog.Content className="dialog-pop fixed left-1/2 top-1/2 z-[61] w-[calc(100%-24px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-[24px] bg-white p-6 shadow-[var(--shadow-lift)]">
          <Dialog.Title className="text-[22px] font-light tracking-[-0.03em] text-ink">{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className="mt-2 text-[15px] leading-relaxed text-ink-soft">{body}</div>
          </Dialog.Description>
          {reason ? (
            <Field className="mt-4" label="Reason (saved in the audit log)" error={text && !ok ? "At least 5 characters" : undefined}>
              {(id, d) => <TextArea id={id} aria-describedby={d} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} autoFocus />}
            </Field>
          ) : null}
          {error ? <p role="alert" className="mt-3 rounded-xl bg-[#fde8eb] px-3.5 py-2.5 text-[14px] text-[#a3263a]">{error}</p> : null}
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild><Button variant="outline">Cancel</Button></Dialog.Close>
            <Button variant={danger ? "danger" : "primary"} disabled={!ok} loading={busy} onClick={run}>{confirmLabel}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
