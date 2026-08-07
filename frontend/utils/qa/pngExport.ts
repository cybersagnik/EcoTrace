/**
 * Dependency-free SVG → PNG export for Recharts/SVG chart containers.
 * Serializes the rendered SVG, rasterizes it on a canvas, and triggers a
 * download — no html-to-image dependency required.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

export function exportSvgAsPng(svg: SVGSVGElement, filename: string): void {
  const rect = svg.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  // Copy so we can override dimensions without mutating the live chart.
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", SVG_NS);

  // Pull the current surface color so light/dark charts export correctly.
  const bg = getComputedStyle(document.body).getPropertyValue("--panel").trim() || "#ffffff";

  const serialized = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(scale, scale);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
      a.click();
    }
    URL.revokeObjectURL(url);
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

export function findChartSvg(container: HTMLElement | null): SVGSVGElement | null {
  if (!container) return null;
  return container.querySelector("svg");
}
