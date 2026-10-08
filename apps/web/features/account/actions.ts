'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import {
  addMyAddress,
  deleteMyAddress,
  saveProduct,
  setDefaultAddress,
  updateMyAddress,
  unsaveProduct,
  updateMyProfile,
} from '@repo/db/account';
import { shippingAddressSchema } from '@repo/shared/domain';

import { currentUser, sessionClient } from '@/lib/supabase/server';

async function signedIn() {
  const client = await sessionClient();
  const user = await currentUser(client);
  if (!user) redirect('/login');
  return { client, user };
}

export async function signOutAction(): Promise<void> {
  const client = await sessionClient();
  await client.auth.signOut();
  redirect('/');
}

export async function updateProfileAction(form: FormData): Promise<void> {
  const { client, user } = await signedIn();
  const parsed = z
    .object({ fullName: z.string().trim().max(120), phone: z.string().trim().max(40) })
    .parse({ fullName: form.get('fullName') ?? '', phone: form.get('phone') ?? '' });
  await updateMyProfile(client, user.id, {
    full_name: parsed.fullName || null,
    phone: parsed.phone || null,
  });
  revalidatePath('/account/details');
}

function addressFrom(form: FormData) {
  const address = shippingAddressSchema.parse(Object.fromEntries(form));
  const label =
    String(form.get('label') ?? '')
      .trim()
      .slice(0, 40) || null;
  return { ...address, label };
}

export async function addAddressAction(form: FormData): Promise<void> {
  const { client, user } = await signedIn();
  await addMyAddress(client, user.id, addressFrom(form));
  revalidatePath('/account/addresses');
  redirect('/account/addresses');
}

/** The pencil on an address card (D-089): the same form, filled in. */
export async function updateAddressAction(id: string, form: FormData): Promise<void> {
  const { client } = await signedIn();
  await updateMyAddress(client, z.string().uuid().parse(id), addressFrom(form));
  revalidatePath('/account/addresses');
  redirect('/account/addresses');
}

export async function deleteAddressAction(id: string): Promise<void> {
  const { client } = await signedIn();
  await deleteMyAddress(client, z.string().uuid().parse(id));
  revalidatePath('/account/addresses');
}

export async function setDefaultAddressAction(id: string): Promise<void> {
  const { client, user } = await signedIn();
  await setDefaultAddress(client, user.id, z.string().uuid().parse(id));
  revalidatePath('/account/addresses');
}

/** Save button on product pages. Returns 'signin' for visitors so the page can send them to /login. */
export async function saveProductAction(productId: string): Promise<'saved' | 'signin'> {
  const client = await sessionClient();
  const user = await currentUser(client);
  if (!user) return 'signin';
  await saveProduct(client, user.id, z.string().uuid().parse(productId));
  revalidatePath('/account/saved');
  return 'saved';
}

export async function unsaveProductAction(productId: string): Promise<void> {
  const { client } = await signedIn();
  await unsaveProduct(client, z.string().uuid().parse(productId));
  revalidatePath('/account/saved');
}
