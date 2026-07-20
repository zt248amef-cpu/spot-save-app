import test from "node:test";
import assert from "node:assert/strict";
import { extractTikTokLocation, extractTikTokPageMedia } from "../api/_lib/tiktokParser.js";
import { mergeTikTokLocationResult } from "../src/services/tiktokService.js";

const placeLinkHtml = `
  <meta property="og:image" content="https://images.example.invalid/cover.jpg">
  <a href="https://www.tiktok.com/place/sample-123" aria-label="場所を表示">Sample Cafe</a>
`;

test("A: place link and thumbnail are extracted independently", () => {
  const location = extractTikTokLocation(placeLinkHtml);
  const media = extractTikTokPageMedia(placeLinkHtml);
  assert.equal(location.status, "single");
  assert.equal(location.candidates[0].source, "tiktok_place_link");
  assert.equal(media.thumbnailUrl, "https://images.example.invalid/cover.jpg");
});

test("B: place-link evidence wins over weaker caption extraction", () => {
  const location = extractTikTokLocation(placeLinkHtml);
  const weakAi = {
    mode: "single",
    placeName: "Sample Cafe",
    area: "Tokyo",
    addressCandidate: "",
    category: "cafe",
    geoSearchQueries: [],
  };
  const merged = mergeTikTokLocationResult(location, weakAi);
  assert.equal(merged.mode, "single");
  assert.equal(merged.sourceType, "place_link");
  assert.equal(merged.area, "Tokyo");
});

test("C: no location remains unknown while media remains available", () => {
  const html = '<meta property="og:image" content="https://images.example.invalid/only-media.jpg">';
  assert.equal(extractTikTokLocation(html).status, "unknown");
  assert.match(extractTikTokPageMedia(html).thumbnailUrl, /only-media/);
});

test("D: failed AI result does not discard a location or media result", () => {
  const location = extractTikTokLocation(placeLinkHtml);
  assert.equal(mergeTikTokLocationResult(location, null).mode, "single");
  assert.ok(extractTikTokPageMedia(placeLinkHtml).thumbnailUrl);
});

test("E: missing page media produces an empty real-thumbnail result for fallback selection", () => {
  assert.equal(extractTikTokPageMedia("<html></html>").thumbnailUrl, "");
});

test("F: multiple POIs are never collapsed to one place", () => {
  const html = `
    <a href="https://www.tiktok.com/place/first">First Cafe</a>
    <a href="https://www.tiktok.com/place/second">Second Cafe</a>
  `;
  const location = extractTikTokLocation(html);
  const merged = mergeTikTokLocationResult(location, { mode: "single", placeName: "First Cafe" });
  assert.equal(location.status, "multiple");
  assert.equal(merged.mode, "multiple");
  assert.equal(merged.candidates.length, 2);
});

test("embedded POI JSON exposes address and coordinates without relying on icon color", () => {
  const html = `<script type="application/json">${JSON.stringify({
    item: {
      poiInfo: {
        poiName: "Lakeside Park",
        address: "Example ward",
        latitude: 35.1,
        longitude: 139.2,
      },
    },
  })}</script>`;
  const candidate = extractTikTokLocation(html).candidates[0];
  assert.equal(candidate.placeName, "Lakeside Park");
  assert.equal(candidate.address, "Example ward");
  assert.equal(candidate.latitude, 35.1);
  assert.equal(candidate.longitude, 139.2);
  assert.equal(candidate.confidence, "high");
});

test("embedded JSON thumbnail is preferred over a video poster", () => {
  const html = `
    <script type="application/json">${JSON.stringify({ item: { video: { cover: "https://images.example.invalid/json-cover.jpg" } } })}</script>
    <video poster="https://images.example.invalid/poster.jpg"></video>
  `;
  const media = extractTikTokPageMedia(html);
  assert.match(media.thumbnailUrl, /json-cover/);
  assert.equal(media.source, "tiktok_embedded_json");
});

test("hydration POI is preferred and normalizes nested contentLocation address", () => {
  const hydration = {
    __DEFAULT_SCOPE__: {
      "webapp.reflow.video.detail": {
        itemInfo: {
          itemStruct: {
            poi: {
              id: "poi-id",
              name: "Hydration Cafe",
              address: "Main street",
              city: "Sample city",
              province: "",
            },
            contentLocation: {
              address: {
                streetAddress: "Second street",
                addressLocality: "Sample ward",
                addressRegion: "",
                addressCountry: "JP",
              },
            },
          },
        },
      },
    },
  };
  const html = `
    <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(hydration)}</script>
    <a href="https://www.tiktok.com/place/weaker">Weaker generic candidate</a>
  `;
  const location = extractTikTokLocation(html);
  assert.equal(location.status, "single");
  assert.equal(location.candidates[0].placeName, "Hydration Cafe");
  assert.match(location.candidates[0].address, /Main street/);
  assert.match(location.candidates[0].address, /Sample ward/);
  assert.equal(location.candidates[0].source, "tiktok_hydration_poi");
  assert.equal(location.candidates[0].confidence, "high");
  assert.match(location.candidates[0].placeUrl, /\/place\//);
});
