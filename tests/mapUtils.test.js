import assert from "node:assert/strict";
import test from "node:test";
import { getMappableSpots, getSpotCoordinates } from "../src/utils/mapUtils.js";

test("lat/lng と latitude/longitude の両方を座標として扱う", () => {
  assert.deepEqual(getSpotCoordinates({ lat: 35.68, lng: 139.76 }), [35.68, 139.76]);
  assert.deepEqual(
    getSpotCoordinates({ latitude: "34.69", longitude: "135.5" }),
    [34.69, 135.5]
  );
});

test("座標が欠けているか範囲外のスポットは除外する", () => {
  const spots = [
    { id: "valid", lat: 0, lng: 0 },
    { id: "missing", lat: 35 },
    { id: "invalid", latitude: 91, longitude: 140 },
  ];

  assert.deepEqual(getMappableSpots(spots), [
    { spot: spots[0], position: [0, 0] },
  ]);
});

test("保存スポットが0件ならマーカー候補も0件になる", () => {
  assert.deepEqual(getMappableSpots([]), []);
});
