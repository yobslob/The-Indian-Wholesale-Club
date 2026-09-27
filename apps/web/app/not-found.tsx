import { AnnouncementBar, Footer, Header } from '@/components/layout';

import NotFoundContent from './(public)/not-found';

export default function RootNotFound(): React.JSX.Element {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main className="min-h-[calc(100vh-4rem)]">
        <NotFoundContent />
      </main>
      <Footer />
    </>
  );
}
