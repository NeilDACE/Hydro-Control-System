const CACHE_NAME = "hydro-control-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./styles/standard.css",
  "./script.js",
  "./scripts/templates.js",
  "./config.js",
  "./assets/favicon/site.webmanifest",
  "./assets/favicon/android-chrome-192x192.png",
  "./assets/favicon/android-chrome-512x512.png",
  "./assets/favicon/apple-touch-icon.png",
  "./assets/favicon/favicon-32x32.png",
  "./assets/favicon/favicon-16x16.png",
  "./assets/favicon/favicon.ico",
  "./assets/img/logo-only.png",
  "./privacy-police.html",
  "./legal-notice.html",
];

/**
 * Caches the application shell during the install phase.
 * @returns {Promise<void>} Promise that resolves when precaching is done.
 */
async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);
}

/**
 * Removes old caches that do not match the current cache name.
 * @returns {Promise<void[]>} Promise that resolves when old caches are removed.
 */
async function clearOldCaches() {
  const keys = await caches.keys();
  const outdatedKeys = keys.filter((key) => key !== CACHE_NAME);
  return Promise.all(outdatedKeys.map((key) => caches.delete(key)));
}

/**
 * Checks if a request uses the GET method.
 * @param {Request} request - Incoming fetch request.
 * @returns {boolean} True when the request can be cached.
 */
function isGetRequest(request) {
  return request.method === "GET";
}

/**
 * Validates whether a response is safe to cache.
 * @param {Response} response - Network response to validate.
 * @returns {boolean} True when the response is cacheable.
 */
function isCacheableResponse(response) {
  return !!response && response.status === 200 && response.type === "basic";
}

/**
 * Stores a successful response clone in the active cache.
 * @param {Request} request - Original fetch request.
 * @param {Response} response - Network response to store.
 * @returns {Promise<void>} Promise that resolves when the response is cached.
 */
async function cacheResponse(request, response) {
  const responseClone = response.clone();
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, responseClone);
}

/**
 * Handles fetch requests with cache fallback and runtime caching.
 * @param {Request} request - Incoming fetch request.
 * @returns {Promise<Response|undefined>} Cached or fetched response.
 */
async function handleFetch(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) await cacheResponse(request, response);
    return response;
  } catch {
    return cached;
  }
}

/**
 * Handles the install event lifecycle.
 * @param {ExtendableEvent} event - Service worker install event.
 */
function onInstall(event) {
  event.waitUntil(precacheAppShell());
  self.skipWaiting();
}

/**
 * Handles the activate event lifecycle.
 * @param {ExtendableEvent} event - Service worker activate event.
 */
function onActivate(event) {
  event.waitUntil(clearOldCaches());
  self.clients.claim();
}

/**
 * Handles fetch events and serves cached or network responses.
 * @param {FetchEvent} event - Service worker fetch event.
 */
function onFetch(event) {
  if (!isGetRequest(event.request)) return;
  event.respondWith(handleFetch(event.request));
}

self.addEventListener("install", onInstall);
self.addEventListener("activate", onActivate);
self.addEventListener("fetch", onFetch);
