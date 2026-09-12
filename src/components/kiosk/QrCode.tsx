import { QRCodeSVG } from "qrcode.react";

/**
 * A scannable code for a visitor's phone.
 *
 * Encoded and drawn in-process — the shop's network is not assumed to be up, so
 * no external QR image service. Error level M (not L) because a storefront
 * screen collects glare and fingerprints and M tolerates roughly 15% damage.
 *
 * The code is generated once at a fixed module size and then scaled by CSS, so
 * a larger display costs no extra encoding and there is only ever one copy in
 * the DOM.
 */
export function QrCode({
  url,
  className = "h-44 w-44 2xl:h-64 2xl:w-64",
}: {
  url: string;
  className?: string;
}) {
  return (
    <div className={`${className} [&>svg]:h-full [&>svg]:w-full`}>
      <QRCodeSVG
        value={url}
        size={256}
        level="M"
        marginSize={3}
        // Explicit white: a transparent code over the cream page background, or
        // worse over an event photo, stops scanning reliably.
        bgColor="#ffffff"
        fgColor="#0a3c23"
        role="img"
        aria-label="Scan to open this event on your phone"
      />
    </div>
  );
}
