import type { Category } from "../../generated/prisma/client.js";

export type CategoryDto = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  status: Category["status"];
  createdAt: string;
  updatedAt: string;
};

export function toCategoryDto(category: Category): CategoryDto {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    status: category.status,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}
