import type { Category, Subcategory } from "../../generated/prisma/client.js";

export type SubcategoryCategorySummary = {
  id: number;
  name: string;
  slug: string;
  status: Category["status"];
};

export type SubcategoryDto = {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string | null;
  status: Subcategory["status"];
  createdAt: string;
  updatedAt: string;
  category: SubcategoryCategorySummary;
};

export type SubcategoryWithCategory = Subcategory & {
  category: Pick<Category, "id" | "name" | "slug" | "status">;
};

export function toSubcategoryDto(
  subcategory: SubcategoryWithCategory,
): SubcategoryDto {
  return {
    id: subcategory.id,
    categoryId: subcategory.categoryId,
    name: subcategory.name,
    slug: subcategory.slug,
    description: subcategory.description,
    status: subcategory.status,
    createdAt: subcategory.createdAt.toISOString(),
    updatedAt: subcategory.updatedAt.toISOString(),
    category: {
      id: subcategory.category.id,
      name: subcategory.category.name,
      slug: subcategory.category.slug,
      status: subcategory.category.status,
    },
  };
}
