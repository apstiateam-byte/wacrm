// Browser-side Razorpay Checkout: loads checkout.js on demand and
// resolves with the handler payload once the customer pays. Rejects
// with `dismissed` when they close the modal.

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_signature: string;
  razorpay_subscription_id?: string;
  razorpay_order_id?: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (payload: { error?: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error('Could not load Razorpay Checkout'));
    };
    document.body.appendChild(script);
  });
  return loading;
}

export interface CheckoutSession {
  kind: 'subscription' | 'order';
  key_id: string;
  subscription_id?: string;
  order_id?: string;
  plan_name: string;
  amount_paise: number;
  prefill: { name: string; email: string };
}

export class CheckoutDismissedError extends Error {
  constructor() {
    super('dismissed');
    this.name = 'CheckoutDismissedError';
  }
}

export async function openRazorpayCheckout(
  session: CheckoutSession,
  opts: { businessName: string; description: string; color?: string },
): Promise<RazorpayHandlerResponse> {
  await loadScript();
  if (!window.Razorpay) throw new Error('Razorpay Checkout unavailable');
  const Razorpay = window.Razorpay;

  return new Promise<RazorpayHandlerResponse>((resolve, reject) => {
    const rzp = new Razorpay({
      key: session.key_id,
      name: opts.businessName,
      description: opts.description,
      ...(session.kind === 'subscription'
        ? { subscription_id: session.subscription_id }
        : { order_id: session.order_id, amount: session.amount_paise, currency: 'INR' }),
      prefill: session.prefill,
      theme: opts.color ? { color: opts.color } : undefined,
      handler: (response: RazorpayHandlerResponse) => resolve(response),
      modal: { ondismiss: () => reject(new CheckoutDismissedError()) },
    });
    rzp.on('payment.failed', (payload) => {
      reject(new Error(payload.error?.description ?? 'Payment failed'));
    });
    rzp.open();
  });
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
