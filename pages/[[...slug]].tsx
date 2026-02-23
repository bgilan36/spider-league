import dynamic from "next/dynamic";

const SpiderLeagueApp = dynamic(() => import("../src/App"), { ssr: false });

export default function CatchAllPage() {
  return <SpiderLeagueApp />;
}
