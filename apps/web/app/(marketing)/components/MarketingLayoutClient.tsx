'use client';

import { usePathname } from "next/navigation";
import { MarketingHeader } from "./MarketingHeader";
import { MarketingFooter } from "./MarketingFooter";

export function MarketingLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <>
      {!isLoginPage && <MarketingHeader />}
      <main>{children}</main>
      {!isLoginPage && <MarketingFooter />}
    </>
  );
} 