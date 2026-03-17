import type { AppProps } from "next/app";
import Head from "next/head";
// @ts-ignore - CSS import for Next.js pages router
import "../src/index.css";

const RELEASE_VERSION = "2026-03-17-home-cache-reset-v1";
const releaseResetScript = `
(function () {
  try {
    var versionKey = "spider-league-release-version";
    var reloadKey = "spider-league-release-reloaded";
    var currentVersion = "${RELEASE_VERSION}";
    var previousVersion = localStorage.getItem(versionKey);

    if (previousVersion !== currentVersion) {
      localStorage.setItem(versionKey, currentVersion);
      sessionStorage.removeItem(reloadKey);

      if (window.caches && typeof window.caches.keys === "function") {
        window.caches.keys().then(function (keys) {
          keys.forEach(function (key) {
            window.caches.delete(key);
          });
        }).catch(function () {});
      }

      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, "true");
        window.location.replace(window.location.pathname + "?v=" + encodeURIComponent(currentVersion) + window.location.hash);
      }
    }
  } catch (error) {
    console.warn("Release cache reset failed", error);
  }
})();
`;

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="spider-league-release" content={RELEASE_VERSION} />
        <link rel="manifest" href={`/manifest.json?v=${RELEASE_VERSION}`} />
        <link rel="icon" type="image/png" href="/favicon.png?v=2" />
        <link rel="shortcut icon" href="/favicon.png?v=2" />
        <link rel="apple-touch-icon" href="/favicon.png?v=2" />
        <script dangerouslySetInnerHTML={{ __html: releaseResetScript }} />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
