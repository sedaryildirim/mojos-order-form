import { expect, test } from "vitest";
import { comparableName } from "./ingredient-compare";

test("sizes, pack multipliers and bracketed notes are ignored", () => {
  expect(comparableName("Parsley 100 g")).toBe("parsley");
  expect(comparableName("Parsley")).toBe("parsley");
  expect(comparableName("Carrot (10 kg box)")).toBe("carrot");
  expect(comparableName("ARO Frozen Mixed Berries 1 kg x 10")).toBe("aro frozen mixed berries");
});

test("different products stay different", () => {
  expect(comparableName("Purple Eggplant")).not.toBe(comparableName("Green Eggplant"));
});
