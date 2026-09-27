import { Check, ChevronRight } from 'lucide-react';

export type CheckoutStep = 'information' | 'shipping' | 'payment';

interface CheckoutStepperProps {
  currentStep: CheckoutStep;
  onStepClick?: (step: CheckoutStep) => void;
}

const steps: Array<{ id: CheckoutStep; label: string }> = [
  { id: 'information', label: 'Information' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'payment', label: 'Payment' },
];

export function CheckoutStepper({
  currentStep,
  onStepClick,
}: CheckoutStepperProps): React.JSX.Element {
  const currentIdx = steps.findIndex((s) => s.id === currentStep);

  return (
    <nav aria-label="Checkout Progress" className="mb-8">
      <ol className="flex items-center space-x-2 text-xs font-medium sm:space-x-4 sm:text-sm">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isClickable = isCompleted && onStepClick;

          return (
            <li key={step.id} className="flex items-center">
              {idx > 0 && <ChevronRight className="mr-2 h-4 w-4 text-neutral-300 sm:mr-4" />}
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(step.id)}
                className={`flex items-center gap-1.5 transition-colors ${
                  isCurrent
                    ? 'text-primary font-semibold'
                    : isCompleted
                      ? 'hover:text-primary text-neutral-700'
                      : 'cursor-not-allowed text-neutral-400'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-neutral-200 text-neutral-600'
                  }`}
                >
                  {isCompleted ? <Check className="h-3 w-3 stroke-[3]" /> : idx + 1}
                </span>
                <span>{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
