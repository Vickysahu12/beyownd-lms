"use client";

import type { Checkout } from "@/lib/student-types";

/*
 * Razorpay Checkout loader. The script is fetched only when the student
 * presses Pay, never on page load. Resolves with Razorpay's handler payload,
 * rejects with "dismissed" (closed the popup) or "failed" (payment failed).
 */
export type RazorpaySuccess = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayCtor = new (o: Record<string, unknown>) => { open: () => void; on: (ev: string, fn: (r: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

let loader: Promise<RazorpayCtor> | null = null;
function load() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  loader ??= new Promise<RazorpayCtor>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error("load")));
    s.onerror = () => {
      loader = null;
      reject(new Error("load"));
    };
    document.head.appendChild(s);
  });
  return loader;
}

export class CheckoutClosed extends Error {
  constructor(public reason: "dismissed" | "failed" | "load", public detail?: string) {
    super(reason);
  }
}

export async function openCheckout(c: Checkout): Promise<RazorpaySuccess> {
  let Razorpay: RazorpayCtor;
  try {
    Razorpay = await load();
  } catch {
    throw new CheckoutClosed("load");
  }
  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: c.keyId,
      order_id: c.orderId,
      amount: c.amountPaise,
      currency: c.currency,
      name: c.name,
      description: c.description,
      prefill: c.prefill,
      theme: { color: "#3157e8" },
      handler: (r: RazorpaySuccess) => resolve(r),
      modal: { ondismiss: () => reject(new CheckoutClosed("dismissed")), confirm_close: true },
    });
    rzp.on("payment.failed", (r) => reject(new CheckoutClosed("failed", r.error?.description)));
    rzp.open();
  });
}
