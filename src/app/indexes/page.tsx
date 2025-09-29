import dynamic from "next/dynamic";

const IndexHubClient = dynamic(() => import("./IndexHubClient"), { ssr: false, loading: () => null });

export const dynamic = "force-dynamic";

export default function IndexesPage() {
  return <IndexHubClient />;
}
