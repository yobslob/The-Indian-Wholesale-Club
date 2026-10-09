import { useRouter } from 'expo-router';

import { ErrorText, Loading, Screen } from '@/components/ui';
import { ListingForm, useListingData } from '@/features/admin/listing-form';

/** New listing (D-097, flows.md §2): the camera or many from the gallery, saved as a draft or published. */
export default function NewListingScreen(): React.JSX.Element {
  const router = useRouter();
  const { data, error, loading } = useListingData();
  if (data) return <ListingForm data={data} onDone={() => router.replace('/admin/listings')} />;
  return (
    <Screen title="New listing">
      {error ? <ErrorText>{error}</ErrorText> : null}
      {loading ? <Loading /> : null}
    </Screen>
  );
}
