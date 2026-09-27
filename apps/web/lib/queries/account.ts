import type { Client } from '@/lib/supabase/types';
import type {
  Address,
  AddressInsert,
  AddressUpdate,
  Order,
  Profile,
  ProfileUpdate,
} from '@repo/shared/types';


// ==========================================
// Profile
// ==========================================

/** Fetch the current user's profile */
export async function getProfile(client: Client): Promise<Profile | null> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  const { data, error } = await client.from('profiles').select('*').eq('id', user.id).single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/** Update the current user's profile */
export async function updateProfile(client: Client, update: ProfileUpdate): Promise<Profile> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Must be authenticated to update profile');

  const { data, error } = await client
    .from('profiles')
    .update(update)
    .eq('id', user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ==========================================
// Addresses
// ==========================================

/** Fetch all addresses for the current user */
export async function getAddresses(client: Client): Promise<Address[]> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return [];

  const { data, error } = await client
    .from('addresses')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Create a new address */
export async function createAddress(
  client: Client,
  address: Omit<AddressInsert, 'user_id'>,
): Promise<Address> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Must be authenticated to create address');

  const { data, error } = await client
    .from('addresses')
    .insert({ ...address, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Update an existing address */
export async function updateAddress(
  client: Client,
  addressId: string,
  update: AddressUpdate,
): Promise<Address> {
  const { data, error } = await client
    .from('addresses')
    .update(update)
    .eq('id', addressId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Delete an address */
export async function deleteAddress(client: Client, addressId: string): Promise<void> {
  const { error } = await client.from('addresses').delete().eq('id', addressId);
  if (error) throw error;
}

/** Set an address as the default */
export async function setDefaultAddress(client: Client, addressId: string): Promise<void> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Must be authenticated');

  // Clear all defaults first
  await client.from('addresses').update({ is_default: false }).eq('user_id', user.id);

  // Set the new default
  await client.from('addresses').update({ is_default: true }).eq('id', addressId);

  // Update profile's default_address_id
  await client.from('profiles').update({ default_address_id: addressId }).eq('id', user.id);
}

// ==========================================
// Orders
// ==========================================

/** Fetch all orders for the current user */
export async function getOrders(client: Client): Promise<Order[]> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return [];

  const { data, error } = await client
    .from('orders')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
