import { useRef, useState } from "react";
import { MapPin, Upload, Home, X, Loader2 } from "lucide-react";

import { Panel } from "./ui";
import AddressSearch from "./AddressSearch";
import {
  satelliteUrlFor,
  satelliteAvailable,
  readImageFile,
  tidyAddress,
  SATELLITE_VIEW,
} from "../lib/siteImage";
import { scaleForStaticMap } from "../design/scale";

/**
 * Address and a picture of the house, at the top of the rep's flow.
 *
 * The point is a proposal that looks like it was made for this house, not a
 * shading study. This panel only gets the image; laying panels on it happens on
 * the Design tab.
 */
export default function SitePanel({
  customerName,
  setCustomerName,
  address,
  setAddress,
  siteImage,
  setSiteImage,
  setImageAspect,
  coords,
  setCoords,
  setSiteScale,
  systemSizeKw,
  batteryCapacity,
}) {
  const fileRef = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const canFetch = satelliteAvailable();

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after a removal
    if (!file) return;
    setError("");
    try {
      const src = await readImageFile(file);
      setSiteImage({ src, kind: "upload" });
      // A file carries no zoom level, so nothing here knows what it is worth in
      // metres. Drop the old scale rather than draw panels to the last photo's
      // scale on this one; the Design tab asks for one line to get it back.
      setSiteScale?.(null);
    } catch (err) {
      setError(err.message);
    }
  };

  // Picking a suggestion gives us coordinates; if imagery is available, drop
  // the roof straight on screen rather than making the rep press anything.
  const onAddressResolved = (resolved) => {
    if (!resolved) return;
    setCoords?.({ lat: resolved.lat, lng: resolved.lng });
    if (satelliteAvailable()) loadSatellite({ lat: resolved.lat, lng: resolved.lng });
  };

  const loadSatellite = ({ lat, lng } = {}) => {
    const url = satelliteUrlFor(address, { lat, lng });
    if (!url) {
      setError("Type the address first.");
      return;
    }
    setError("");
    setLoading(true);
    // Preload so a failure surfaces as a message rather than a broken frame.
    const img = new Image();
    img.onload = () => {
      setSiteImage({ src: url, kind: "satellite" });
      // We asked for this tile, so we know exactly what it covers — panels can
      // now draw themselves at true size without anyone measuring anything.
      setSiteScale?.(
        scaleForStaticMap({
          zoom: SATELLITE_VIEW.zoom,
          latitude: lat ?? coords?.lat,
          requestWidth: SATELLITE_VIEW.width,
        })
      );
      setLoading(false);
    };
    img.onerror = () => {
      setError("Couldn't load the aerial image. Check the address, or upload a photo.");
      setLoading(false);
    };
    img.src = url;
  };

  return (
    <Panel title="Customer & site" icon={MapPin}>
      <div className="space-y-2.5">
        <label className="block">
          <span className="mb-1 block text-[13px] text-slate-600">Customer name</span>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g. the Nguyen family"
            className="h-9 w-full rounded-md border border-slate-300 px-2.5 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
          />
        </label>

        <AddressSearch value={address} onChange={setAddress} onResolved={onAddressResolved} />
      </div>

      {/* image */}
      <div className="pt-1">
        {siteImage ? (
          <figure className="relative overflow-hidden rounded-lg border border-slate-200">
            <img
              src={siteImage.src}
              alt={`The property at ${tidyAddress(address) || "this address"}`}
              className="block h-[150px] w-full object-cover"
              onLoad={(e) => {
                // The design canvas needs the real shape of the photo, or the
                // panels would sit on a differently-proportioned surface.
                const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                if (setImageAspect && w > 0 && h > 0) setImageAspect(w / h);
              }}
              onError={() => {
                // The bundled sample image is optional — if it isn't there,
                // fall back to the empty state rather than a broken frame.
                if (siteImage.kind === "sample") setSiteImage(null);
              }}
            />
            <figcaption className="absolute bottom-2 left-2 rounded-md bg-ink-900/85 px-2 py-1 text-[11.5px] font-semibold text-white backdrop-blur">
              {systemSizeKw || 0} kW
              {batteryCapacity > 0 ? ` + ${batteryCapacity} kWh battery` : " solar"}
            </figcaption>
            <button
              type="button"
              onClick={() => {
                setSiteImage(null);
                setSiteScale?.(null);
              }}
              title="Remove image"
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-ink-900/75 text-white transition hover:bg-ink-900"
            >
              <X size={14} />
            </button>
          </figure>
        ) : (
          <div className="grid h-[150px] w-full place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400">
            <div className="text-center">
              <Home size={22} className="mx-auto mb-1.5 opacity-60" />
              <p className="text-[11.5px]">No image yet</p>
            </div>
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-300 py-2 text-[12.5px] font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Upload size={13} /> Upload photo
          </button>
          {canFetch && (
            <button
              type="button"
              onClick={() => loadSatellite(coords ?? {})}
              disabled={loading}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-300 py-2 text-[12.5px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
              Aerial view
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onPick}
            className="hidden"
          />
        </div>

        {error && <p className="mt-2 text-[11.5px] text-red-600">{error}</p>}

        {!canFetch && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">
            Aerial images need a Google Maps key — set <code>VITE_MAP_KEY</code> and the
            button appears. Until then, upload a photo or a screenshot.
          </p>
        )}
      </div>
    </Panel>
  );
}
