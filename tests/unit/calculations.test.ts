import { describe, it, expect } from "vitest";
import { classifyIntensity, spectrumPosition } from "@/utils/calculations";

describe("Calculations Utility Unit Tests", () => {
  it("classifies carbon emissions below 250g as clean", () => {
    expect(classifyIntensity(100)).toBe("clean");
  });

  it("classifies carbon emissions between 250g and 500g as moderate", () => {
    expect(classifyIntensity(300)).toBe("moderate");
  });

  it("classifies carbon emissions above 500g as high", () => {
    expect(classifyIntensity(550)).toBe("high");
  });

  it("calculates correct spectrum position percentage for 0-25kg scale", () => {
    expect(spectrumPosition(0)).toBe(0);
    expect(spectrumPosition(25)).toBe(100);
    expect(spectrumPosition(12.5)).toBe(50);
  });
});
