import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Gian Lucca's Ranch — From Daddy",
  description: "A sunny ranch page for Gian Lucca, built with love by Daddy.",
}

export default function GianLuccaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
