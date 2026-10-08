import { redirect } from 'next/navigation';

/** Orders moved to the profile's first section (D-089); old links still land there. */
export default function AccountOrdersPage(): never {
  redirect('/account');
}
