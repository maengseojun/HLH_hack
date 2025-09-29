import nextDynamic from "next/dynamic";

const IndexHubClient = nextDynamic(() => import("./IndexHubClient"), {
  ssr: false,
});

export const dynamic = "force-dynamic";

export default function IndexesPage() {
  return <IndexHubClient />;
}
