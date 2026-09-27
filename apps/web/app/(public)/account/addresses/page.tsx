'use client';

import { MapPin, Plus, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AddressCard, AddressForm } from '@/components/account';
import {
  createAddress,
  deleteAddress,
  getAddresses,
  setDefaultAddress,
  updateAddress,
} from '@/lib/queries/account';
import { createClient } from '@/lib/supabase/client';

import type { AddressInput } from '@repo/shared/schemas';
import type { Address } from '@repo/shared/types';

function toAddressPayload(data: AddressInput, country = 'US'): Omit<Address, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  return {
    label: data.label || null,
    full_name: data.fullName,
    line1: data.line1,
    line2: data.line2 || null,
    city: data.city,
    state: data.state,
    zip_code: data.zipCode,
    country,
    phone: data.phone || null,
    is_default: data.isDefault || false,
  };
}

export default function SavedAddressesPage(): React.JSX.Element {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const supabase = createClient();

  const loadAddresses = useCallback(async (): Promise<void> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login?redirect=/account/addresses');
        return;
      }

      const data = await getAddresses(supabase);
      setAddresses(data);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load addresses');
    } finally {
      setIsLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  const handleCreateOrUpdate = async (data: AddressInput): Promise<void> => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = toAddressPayload(data);

      if (editingAddress) {
        const updated = await updateAddress(supabase, editingAddress.id, payload);
        setAddresses((prev) =>
          prev.map((a) => {
            if (a.id === updated.id) return updated;
            if (updated.is_default) return { ...a, is_default: false };
            return a;
          }),
        );
      } else {
        const created = await createAddress(supabase, payload);
        setAddresses((prev) => {
          if (created.is_default) {
            return [created, ...prev.map((a) => ({ ...a, is_default: false }))];
          }
          return [created, ...prev];
        });
      }

      setIsFormOpen(false);
      setEditingAddress(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save address');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    setErrorMsg(null);
    try {
      await deleteAddress(supabase, id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete address');
    }
  };

  const handleSetDefault = async (id: string): Promise<void> => {
    setErrorMsg(null);
    try {
      await setDefaultAddress(supabase, id);
      setAddresses((prev) => prev.map((a) => ({ ...a, is_default: a.id === id })));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to set default address');
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-10 md:px-8 lg:px-12">
      {/* Header bar */}
      <div className="border-b border-neutral-200 pb-6">
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center space-x-2 text-xs text-neutral-500">
            <li>
              <Link href="/" className="hover:text-primary">
                Home
              </Link>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-neutral-400">/</span>
              <Link href="/account" className="hover:text-primary">
                Account
              </Link>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-neutral-400">/</span>
              <span className="font-medium text-neutral-900">Addresses</span>
            </li>
          </ol>
        </nav>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-primary text-3xl font-bold tracking-tight md:text-4xl">
              Saved Addresses
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Manage your domestic shipping destinations and default delivery addresses.
            </p>
          </div>

          {!isFormOpen && !isLoading && (
            <button
              type="button"
              onClick={() => {
                setEditingAddress(null);
                setIsFormOpen(true);
              }}
              className="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-md px-4 py-2.5 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800"
            >
              <Plus className="h-4 w-4" />
              Add New Address
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-8">
        {errorMsg && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
          </div>
        ) : isFormOpen ? (
          <div className="mx-auto max-w-2xl">
            <AddressForm
              initialData={editingAddress}
              onSubmit={handleCreateOrUpdate}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingAddress(null);
              }}
              isLoading={isSubmitting}
            />
          </div>
        ) : addresses.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
              <MapPin className="h-8 w-8 text-neutral-400" />
            </div>
            <h3 className="font-display text-primary mt-4 text-lg font-bold">No saved addresses</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Add your preferred shipping address for faster checkout.
            </p>
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="bg-primary text-primary-foreground mt-6 rounded-md px-6 py-2.5 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800"
            >
              Add First Address
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {addresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                onEdit={(addr) => {
                  setEditingAddress(addr);
                  setIsFormOpen(true);
                }}
                onDelete={handleDelete}
                onSetDefault={handleSetDefault}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
