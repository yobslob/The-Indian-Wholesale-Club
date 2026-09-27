import { AnnouncementBar, Footer, Header } from '@/components/layout';
import { PageTransition } from '@/components/ui';

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main className="min-h-[calc(100vh-4rem)]">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
    </>
  );
}
