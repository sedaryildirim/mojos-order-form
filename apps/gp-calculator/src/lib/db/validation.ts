import { z } from "zod";

// Length limits keep names, notes and contact details displayable (cards, tables, spec sheets, PDFs).
export const LIMITS = { name: 120, category: 60, contact: 500, notes: 2000, person: 80, email: 254 } as const;

const name = z.string().trim().min(1, "Name is required").max(LIMITS.name, `Name must be ${LIMITS.name} characters or fewer`);
const category = z.string().trim().min(1, "Category is required").max(LIMITS.category, `Category must be ${LIMITS.category} characters or fewer`);
const person = z.string().trim().min(1, "Changes need a name to record them under. Reload the page and try again.").max(LIMITS.person, `Name must be ${LIMITS.person} characters or fewer`);
const notes = z.string().max(LIMITS.notes, `Notes must be ${LIMITS.notes} characters or fewer`);

export const supplierInputSchema = z.object({
  name,
  contactInfo: z.string().max(LIMITS.contact, `Contact details must be ${LIMITS.contact} characters or fewer`).optional(),
  createdBy: person,
});

export const ingredientInputSchema = z.object({
  name,
  category,
  supplierId: z.string().min(1, "Supplier is required"),
  purchaseUnit: z.enum(["G", "ML", "EACH"]),
  packQuantity: z.number().positive("Pack quantity must be greater than 0"),
  packPrice: z.number().positive("Pack price must be greater than 0"),
  yieldPct: z.number().gt(0).lte(100).default(100),
  createdBy: person,
});

export type SupplierInput = z.infer<typeof supplierInputSchema>;
export type IngredientInput = z.infer<typeof ingredientInputSchema>;

export const dishInputSchema = z.object({
  name,
  category,
  createdBy: person,
});
export type DishInput = z.infer<typeof dishInputSchema>;

export const dishVersionInputSchema = z.object({
  notes: notes.optional(),
  sellingPrice: z.number().positive().optional(),
  targetGpPct: z.number().min(0).max(99).optional(),
  createdBy: person,
  lines: z
    .array(
      z.object({
        ingredientId: z.string().min(1),
        quantity: z.number().positive("Quantity must be greater than 0"),
        unit: z.enum(["G", "KG", "ML", "L", "EACH"]),
      })
    )
    .min(1, "A dish needs at least one ingredient"),
});
export type DishVersionInput = z.infer<typeof dishVersionInputSchema>;

export const emailShareSchema = z.object({
  to: z.string().trim().max(LIMITS.email).email("Enter a valid email address"),
});

export const batchRecipeInputSchema = z.object({
  name,
  category,
  yieldQuantity: z.number().positive("Yield must be greater than 0"),
  yieldUnit: z.enum(["G", "ML", "EACH"]),
  portionSize: z.number().positive("Portion size must be greater than 0").nullable().optional(),
  sellingPrice: z.number().positive("Menu price must be greater than 0").nullable().optional(),
  notes: notes.optional(),
  createdBy: person,
  lines: z
    .array(
      z.object({
        ingredientId: z.string().min(1),
        quantity: z.number().positive("Quantity must be greater than 0"),
        unit: z.enum(["G", "KG", "ML", "L", "EACH"]),
      })
    )
    .default([]),
});
export type BatchRecipeInput = z.infer<typeof batchRecipeInputSchema>;
