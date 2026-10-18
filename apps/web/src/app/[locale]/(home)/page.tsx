import { AboutPreview } from "@/components/home/about-preview";
import { AnnouncementBar } from "@/components/home/announcement-bar";
import { Hero } from "@/components/home/hero";
import { NewArrivals } from "@/components/home/new-arrivals";
import { Newsletter } from "@/components/home/newsletter";
import { ShopByCategory } from "@/components/home/shop-by-category";
import { WhyNesma } from "@/components/home/why-nesma";
import { getCategories, getNewArrivals } from "@/lib/api/catalog";

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
      <WhyNesma />
      <AboutPreview />
      <Newsletter />
    </>
  );
}
