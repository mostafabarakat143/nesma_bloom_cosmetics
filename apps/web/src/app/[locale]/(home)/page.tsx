import { getCategories, getNewArrivals } from "@/features/catalog/services/catalog.server";
import { AboutPreview } from "@/features/home/components/about-preview";
import { AnnouncementBar } from "@/features/home/components/announcement-bar";
import { Hero } from "@/features/home/components/hero";
import { NewArrivals } from "@/features/home/components/new-arrivals";
import { Newsletter } from "@/features/home/components/newsletter";
import { ShopByCategory } from "@/features/home/components/shop-by-category";
import { WhyLamsa } from "@/features/home/components/why-lamsa";

export default async function HomePage() {
  const [categories, products] = await Promise.all([
    getCategories(),
    getNewArrivals(),
  ]);

  return (
    <>
      <AnnouncementBar />
      <Hero />
      <ShopByCategory categories={categories} />
      <NewArrivals products={products} />
      <WhyLamsa />
      <AboutPreview />
      <Newsletter />
    </>
  );
}
