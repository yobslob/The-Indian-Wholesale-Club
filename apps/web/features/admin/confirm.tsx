'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';

import { MailPreview, Modal } from './modal';
import { button, secondaryButton } from './styles';

function Submit({ label, danger }: { label: string; danger: boolean }): React.JSX.Element {
  const { pending } = useFormStatus();
  return (
    <button type="submit" data-autofocus disabled={pending} className={`${button} ${danger ? '!bg-danger' : ''}`}>
      {pending ? 'Working…' : label}
    </button>
  );
}

/**
 * A button that asks first (D-096): every refund and cancel shows the exact amount and the email the customer gets
 * before anything happens. The action is a server action bound to its order; the database checks the amount again.
 */
export function ConfirmButton({
  label,
  className = secondaryButton,
  title,
  children,
  mail,
  confirm,
  action,
  danger = true,
}: {
  label: string;
  className?: string;
  title: string;
  children: React.ReactNode;
  mail?: { subject: string; text: string };
  confirm: string;
  action: () => Promise<void>;
  danger?: boolean;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      {open ? (
        <Modal title={title} onClose={() => setOpen(false)}>
          <div className="mb-3 text-[14px] leading-[1.5]">{children}</div>
          {mail ? <MailPreview subject={mail.subject}>{mail.text}</MailPreview> : null}
          <form
            action={async () => {
              await action();
              setOpen(false);
            }}
            className="flex justify-end gap-2"
          >
            <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
              Keep it
            </button>
            <Submit label={confirm} danger={danger} />
          </form>
        </Modal>
      ) : null}
    </>
  );
}

/** A "More" action that opens a small form in a box: a new delivery date, a note, a move to another cycle. */
export function FormButton({
  label,
  title,
  children,
  action,
  submit,
  mail,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
  action: (form: FormData) => Promise<void>;
  submit: string;
  mail?: { subject: string; text: string };
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${secondaryButton} w-full`}>
        {label}
      </button>
      {open ? (
        <Modal title={title} onClose={() => setOpen(false)}>
          <form
            action={async (form) => {
              await action(form);
              setOpen(false);
            }}
            className="space-y-3"
          >
            {children}
            {mail ? <MailPreview subject={mail.subject}>{mail.text}</MailPreview> : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
                Cancel
              </button>
              <Submit label={submit} danger={false} />
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
