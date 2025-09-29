import { PrivyProvider } from '@/components/providers/PrivyProvider';
import { AuthWrapper } from '@/components/auth/AuthWrapper';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PrivyProvider>
          <AuthWrapper>
            {children}
          </AuthWrapper>
        </PrivyProvider>
      </body>
    </html>
  );
}