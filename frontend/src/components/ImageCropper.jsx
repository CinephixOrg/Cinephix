import React, { useState, useCallback, useEffect } from "react";
import Cropper from "react-easy-crop";

/* Helper: create image element from src */
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (err) => reject(err));
    img.setAttribute("crossOrigin", "anonymous");
    img.src = url;
  });

/**
 * getCroppedImg
 * - imageSrc: dataURL or url
 * - pixelCrop: object returned by react-easy-crop (x, y, width, height)
 * - overlayRatio: fraction of the square that the visible circle uses (0..1). Should match overlay width/height % in UI.
 *
 * This function will:
 * 1) compute the circular diameter inside the square crop using overlayRatio
 * 2) create a canvas sized to that diameter
 * 3) draw the corresponding portion of the source image, clipped to a circle
 * 4) return a PNG blob (transparent outside the circle)
 */
async function getCroppedImg(imageSrc, pixelCrop, overlayRatio = 0.7) {
  const image = await createImage(imageSrc);

  // Ensure we operate on a square area (react-easy-crop with aspect=1 should give square).
  const squareSize = Math.max(pixelCrop.width, pixelCrop.height);

  // diameter of the desired circle (in source pixels)
  const diameter = Math.round(squareSize * overlayRatio);

  // If diameter is 0 (safety), fallback to squareSize
  const outSize = Math.max(1, diameter);

  // Source coordinates: center the circle inside the square pixelCrop
  const sx = Math.round(pixelCrop.x + (squareSize - outSize) / 2);
  const sy = Math.round(pixelCrop.y + (squareSize - outSize) / 2);

  // Clamp source coords to image bounds (safety)
  const maxSX = Math.max(0, Math.min(sx, image.naturalWidth - outSize));
  const maxSY = Math.max(0, Math.min(sy, image.naturalHeight - outSize));

  const canvas = document.createElement("canvas");
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");

  // Make transparent background
  ctx.clearRect(0, 0, outSize, outSize);

  // Create circular clipping path
  const cx = outSize / 2;
  const cy = outSize / 2;
  const r = outSize / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Draw the correct portion of the original image into the clipped canvas
  // source: image, sx, sy, outSize, outSize -> dst: 0,0,outSize,outSize
  ctx.drawImage(image, maxSX, maxSY, outSize, outSize, 0, 0, outSize, outSize);

  ctx.restore();

  // Return blob (PNG to keep transparency)
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob);
      },
      "image/png",
      1
    );
  });
}

export default function ImageCropper({ file, onCancel, onConfirm }) {
  const [zoom, setZoom] = useState(1);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);

  // overlay ratio must match the overlay width in the JSX (70% used in original)
  const overlayRatio = 0.7;

  // ensure a sane default zoom and center when image loads
  useEffect(() => {
    if (!file) return;
    setZoom(1); // default zoom (less zoomed-in)
    setCrop({ x: 0, y: 0 }); // reset crop position
  }, [file]);

  // Read file as data URL or set remote URL string directly (avoids blob URL revocation problems)
  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      return;
    }
    if (typeof file === "string") {
      setImageSrc(file);
      return;
    }
    let mounted = true;
    const reader = new FileReader();
    reader.onload = () => {
      if (mounted) setImageSrc(reader.result);
    };
    reader.onerror = () => {
      console.error("Failed to read file");
    };
    reader.readAsDataURL(file);
    return () => {
      mounted = false;
    };
  }, [file]);

  const onCropComplete = useCallback((_area, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  // helper to "center" the crop area (quick reset)
  const handleCenter = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  // helper to reset zoom and crop preserving imageSrc
  const handleReset = useCallback(() => {
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setCroppedAreaPixels(null);
  }, []);

  const handleConfirm = useCallback(
    async (ev) => {
      try {
        if (!imageSrc || !croppedAreaPixels) {
          console.error("No image or crop area");
          return;
        }
        // Use overlayRatio so we crop exactly the visible circle
        const blob = await getCroppedImg(imageSrc, croppedAreaPixels, overlayRatio);
        if (blob) onConfirm(blob);
      } catch (err) {
        console.error("Crop error:", err);
      }
    },
    [imageSrc, croppedAreaPixels, onConfirm]
  );

  // Render: use a square container so overlay stays circular
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-base-100 rounded-lg w-full max-w-3xl p-4">
        <h3 className="text-lg font-semibold mb-2">Adjust your photo</h3>

        {/* square container so overlay stays circular */}
        <div style={{ width: "100%", maxWidth: 800, margin: "0 auto" }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              paddingTop: "100%",
              background: "#111",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {imageSrc && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
              >
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  objectFit="horizontal-cover"
                  showGrid={true}
                  restrictPosition={false} /* allow free movement */
                />

                {/* perfect circular overlay — keep overlayRatio in sync */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: `${overlayRatio * 100}%`,
                    height: `${overlayRatio * 100}%`,
                    borderRadius: "50%",
                    boxShadow: "0 0 0 2000px rgba(0,0,0,0.45)",
                    pointerEvents: "none",
                    border: "2px solid rgba(255,255,255,0.85)",
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4">
          <label className="flex-1">
            Zoom
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </label>

          {/* quick action buttons */}
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={handleCenter}>
              Center
            </button>
            <button className="btn btn-ghost" onClick={handleReset}>
              Reset
            </button>
            <button className="btn btn-ghost" onClick={() => onCancel()}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleConfirm}>
              Save & Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}