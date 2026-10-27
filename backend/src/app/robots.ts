import type { MetadataRoute } from "next";

// The dashboard and the API are not for search engines. (Customers use the app, not these pages.)
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
