/**
 * Dependency-free SVG → PNG helpers for Recharts/SVG chart containers.
 * Serializes the rendered SVG, rasterizes it on a canvas, and returns a
 * resized data URL (svgToDataUrl) or triggers a download (exportSvgAsPng)
 * — no html-to-image dependency required.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

interface SvgToDataUrlOptions {
  /** Maximum edge length in px before downscaling (default 1024). */
  maxDimension?: number;
}

function serializeSvg(svg: SVGSVGElement): { serialized: string; width: number; height: number } | null {
  const rect = svg.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  // Copy so we can override dimensions without mutating the live chart.
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", SVG_NS);

  const serialized = new XMLSerializer().serializeToString(clone);
  return { serialized, width, height };
}

function loadSvgImage(serialized: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to rasterize SVG"));
    };
    img.src = url;
  });
}

/**
 * Rasterize an SVG chart to a PNG data URL, optionally downscaled so the
 * payload stays small when sent to the AI analysis endpoint.
 */
export async function svgToDataUrl(
  svg: SVGSVGElement,
  options: SvgToDataUrlOptions = {}
): Promise<string> {
  const maxDimension = options.maxDimension ?? 1024;
  const parsed = serializeSvg(svg);
  if (!parsed) throw new Error("Chart has zero size — nothing to capture");
  const { serialized, width, height } = parsed;

  // Pull the current surface color so light/dark charts capture correctly.
  const bg =
    (typeof document !== "undefined"
      ? getComputedStyle(document.body).getPropertyValue("--panel").trim()
      : "") || "#ffffff";

  const img = await loadSvgImage(serialized);

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export function exportSvgAsPng(svg: SVGSVGElement, filename: string): void {
  const parsed = serializeSvg(svg);
  if (!parsed) return;
  const { serialized, width, height } = parsed;

  const img = loadSvgImage(serialized);
  img.then((loaded) => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(scale, scale);
      ctx.drawImage(loaded, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
      a.click();
    }
  }).catch(() => {
    // Rasterization failed — nothing to download. Silently ignore.
  });
}

export function findChartSvg(container: HTMLElement | null): SVGSVGElement | null {
  if (!container) return null;
  return container.querySelector("svg");
}
