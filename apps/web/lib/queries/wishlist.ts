import type { Client } from '@/lib/supabase/types';
import type { WishlistItem, WishlistItemInsert } from '@repo/shared/types';

/** Fetch all wishlist items for the current user */
export async function getWishlistItems(client: Client): Promise<WishlistItem[]> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return [];

  const { data, error } = await client
    .from('wishlists')
    .select('*')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Add a product to the wishlist */
export async function addToWishlist(client: Client, productId: string): Promise<WishlistItem> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Must be authenticated to add to wishlist');

  const insert: WishlistItemInsert = {
    user_id: user.id,
    product_id: productId,
  };

  const { data, error } = await client.from('wishlists').insert(insert).select().single();
  if (error) throw error;
  return data;
}

/** Remove a product from the wishlist */
export async function removeFromWishlist(client: Client, productId: string): Promise<void> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return;

  const { error } = await client
    .from('wishlists')
    .delete()
    .eq('user_id', user.id)
    .eq('product_id', productId);
  if (error) throw error;
}

/** Check if a product is in the user's wishlist */
export async function isInWishlist(client: Client, productId: string): Promise<boolean> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return false;

  const { data, error } = await client
    .from('wishlists')
    .select('id')
    .eq('user_id', user.id)
    .eq('product_id', productId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
}
