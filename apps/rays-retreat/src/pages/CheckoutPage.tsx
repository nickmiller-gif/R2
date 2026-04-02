import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

const PRICES: Record<string, { label: string; cents: number; interviews: number }> = {
  starter:  { label: 'Starter', cents: 9900,  interviews: 5 },
  standard: { label: 'Standard', cents: 14900, interviews: 10 },
};

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get('batchId') ?? 'batch_001';
  const tier = searchParams.get('tier') ?? 'starter';
  const title = searchParams.get('title') ?? 'Your idea';
  const plan = PRICES[tier] ?? PRICES.starter;

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setError(null);
    if (!cardNumber || !expiry || !cvc) {
      setError('Please fill in all card details.');
      return;
    }
    setPaying(true);
    // Stub: any card succeeds after a short delay
    // R2 integration: replace with Stripe PaymentIntent confirmation
    await new Promise((r) => setTimeout(r, 1200));
    setPaying(false);
    navigate(`/status/${batchId}`);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-8 font-serif text-4xl font-bold text-ink">Checkout</h1>

      <Card className="mb-6">
        <h2 className="font-serif text-lg font-bold text-ink">Order summary</h2>
        <div className="mt-4 space-y-2 font-sans text-sm">
          <div className="flex justify-between">
            <span className="text-ink-muted">Idea</span>
            <span className="max-w-[200px] truncate text-right text-ink">{decodeURIComponent(title)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Package</span>
            <span className="text-ink">{plan.label} — {plan.interviews} interviews</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Turnaround</span>
            <span className="text-ink">48 hours</span>
          </div>
          <div className="mt-3 border-t border-ink/10 pt-3 flex justify-between font-medium">
            <span className="text-ink">Total</span>
            <span className="font-mono text-xl text-ink">${(plan.cents / 100).toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {/* Stripe stub card form */}
      <Card>
        <h2 className="mb-4 font-serif text-lg font-bold text-ink">Payment details</h2>
        <p className="mb-4 font-mono text-xs text-ink-faint">
          {/* R2 integration: replace with Stripe Elements CardElement */}
          Dev mode: any card number will succeed
        </p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cardNumber">Card number</Label>
            <Input
              id="cardNumber"
              placeholder="4242 4242 4242 4242"
              maxLength={19}
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              autoComplete="cc-number"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="expiry">Expiry</Label>
              <Input
                id="expiry"
                placeholder="MM / YY"
                maxLength={7}
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                autoComplete="cc-exp"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cvc">CVC</Label>
              <Input
                id="cvc"
                placeholder="123"
                maxLength={4}
                value={cvc}
                onChange={(e) => setCvc(e.target.value)}
                autoComplete="cc-csc"
              />
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700">
            {error}
          </div>
        )}

        <Button
          size="lg"
          className="mt-6 w-full"
          loading={paying}
          onClick={() => void handlePay()}
        >
          Pay ${(plan.cents / 100).toFixed(2)} &amp; start the clock →
        </Button>

        <p className="mt-3 text-center font-sans text-xs text-ink-faint">
          Your card is charged immediately. Researcher assigned within 2 hours.
        </p>
      </Card>
    </div>
  );
}
