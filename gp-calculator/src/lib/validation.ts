import { z } from "zod";

export const supplierInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contactInfo: z.string().optional(),
  createdBy: z.string().min(1, "Your name is required"),
});

export const ingredientInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  purchaseUnit: z.enum(["G", "ML", "EACH"]),
  packQuantity: z.number().positive("Pack quantity must be greater than 0"),
  packPrice: z.number().positive("Pack price must be greater than 0"),
  yieldPct: z.number().gt(0).lte(100).default(100),
  createdBy: z.string().min(1, "Your name is required"),
});

export type SupplierInput = z.infer<typeof supplierInputSchema>;
export type IngredientInput = z.infer<typeof ingredientInputSchema>;

export const dishInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  createdBy: z.string().min(1, "Your name is required"),
});
export type DishInput = z.infer<typeof dishInputSchema>;

export const dishVersionInputSchema = z.object({
  notes: z.string().optional(),
  sellingPrice: z.number().positive().optional(),
  targetGpPct: z.number().min(0).max(99).optional(),
  createdBy: z.string().min(1, "Your name is required"),
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
  to: z.string().email("Enter a valid email address"),
});

export const batchRecipeInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  yieldQuantity: z.number().positive("Yield must be greater than 0"),
  yieldUnit: z.enum(["G", "ML", "EACH"]),
  portionSize: z.number().positive("Portion size must be greater than 0").nullable().optional(),
  sellingPrice: z.number().positive("Menu price must be greater than 0").nullable().optional(),
  notes: z.string().optional(),
  createdBy: z.string().min(1, "Your name is required"),
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
