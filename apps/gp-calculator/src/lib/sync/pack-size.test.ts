import { describe, expect, it } from "vitest";
import { parsePackSize } from "./pack-size";

describe("parsePackSize", () => {
  it("Kilogram items are 1000 g priced per kg", () => {
    expect(parsePackSize("Chicken Boneless Breast Skin-On 1 kg", "Kilogram")).toEqual({ purchaseUnit: "G", packQuantity: 1000, needsPackSize: false });
  });
  it("reads weights and volumes from the name", () => {
    expect(parsePackSize("ALLOWRIE Butter Product Salted 5 kg", "EACH")).toMatchObject({ purchaseUnit: "G", packQuantity: 5000 });
    expect(parsePackSize("MAINLAND Vintage Cheese 470 g", "EACH")).toMatchObject({ purchaseUnit: "G", packQuantity: 470 });
    expect(parsePackSize("Mascarpone Tatua 1kg", "EACH")).toMatchObject({ purchaseUnit: "G", packQuantity: 1000 });
    expect(parsePackSize("Anchovies Ristoris 700gr", "EACH")).toMatchObject({ purchaseUnit: "G", packQuantity: 700 });
    expect(parsePackSize("HEINZ Apple Vinegar 946 ml", "EACH")).toMatchObject({ purchaseUnit: "ML", packQuantity: 946 });
    expect(parsePackSize("BONUS Palm Oil 18 l", "EACH")).toMatchObject({ purchaseUnit: "ML", packQuantity: 18000 });
  });
  it("multiplies 'x N' multipacks and counts pieces", () => {
    expect(parsePackSize("ARO Frozen Mixed Berries 1 kg x 10", "EACH")).toMatchObject({ purchaseUnit: "G", packQuantity: 10000 });
    expect(parsePackSize("MALEE 100% Mandarin Orange Juice 1 l x 3", "EACH")).toMatchObject({ purchaseUnit: "ML", packQuantity: 3000 });
    expect(parsePackSize("ARO Chicken Egg no.2 with Cover 30 pcs", "EACH")).toMatchObject({ purchaseUnit: "EACH", packQuantity: 30 });
  });
  it("ignores dimensions like 10mm and takes the pack size", () => {
    expect(parsePackSize("SAVEPAK French Fries 10mm 2 kg x 6", "EACH")).toMatchObject({ purchaseUnit: "G", packQuantity: 12000 });
  });
  it("a Bottle is one EACH and needs no flag", () => {
    expect(parsePackSize("VINA TOLDOS Red 2025", "Bottle")).toEqual({ purchaseUnit: "EACH", packQuantity: 1, needsPackSize: false });
  });
  it("flags an unreadable size as 1 EACH", () => {
    expect(parsePackSize("ARO Toilet Tissue 48 rolls", "EACH")).toEqual({ purchaseUnit: "EACH", packQuantity: 1, needsPackSize: true });
  });
  it("an override wins and clears the flag", () => {
    expect(parsePackSize("ARO Toilet Tissue 48 rolls", "EACH", { purchaseUnit: "EACH", packQuantity: 48 })).toEqual({ purchaseUnit: "EACH", packQuantity: 48, needsPackSize: false });
  });
});
