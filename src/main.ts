import "./app.css";
import App from "./App.svelte";
import { hydrate, mount } from "svelte";
import { readEmbeddedComparison } from "./lib/data";
import type { Lang } from "./i18n";

const target = document.getElementById("app")!;

// The language is derived synchronously from the URL path so the first client
// render hydrates the prerendered file (`/` → en, `/de/` → de). Stored language
// and `?lang=` are applied later, in App's onMount.
const base = import.meta.env.BASE_URL;
const path = window.location.pathname;
const initialLang: Lang = path === `${base}de` || path.startsWith(`${base}de/`) ? "de" : "en";

const initialData = readEmbeddedComparison();


// Prerendered pages ship real markup inside #app → hydrate it. A plain mount is
// used for the dev server / empty root.
const app = target.firstChild
  ? hydrate(App, { target, props: { initialData, initialLang } })
  : mount(App, { target, props: { initialData, initialLang } });

export default app;
