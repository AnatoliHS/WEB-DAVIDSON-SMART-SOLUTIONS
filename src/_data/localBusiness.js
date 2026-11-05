// LocalBusiness structured data for the home page.
// Phone, email and street address are left out until they're confirmed: add telephone, email,
// streetAddress and postalCode here once they are.
const site = require("./site.json");

module.exports = {
  "@context": "https://schema.org",
  "@type": "Electrician",
  "@id": `${site.url}/#business`,
  name: site.title,
  description: site.description,
  url: `${site.url}/`,
  logo: `${site.url}/assets/davidson-logo.webp`,
  image: `${site.url}/assets/Davidson-House-Main.webp`,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Belleville",
    addressRegion: "ON",
    addressCountry: "CA",
  },
  areaServed: ["Belleville", "Prince Edward County", "Quinte West", "Eastern Ontario"].map((name) => ({
    "@type": "AdministrativeArea",
    name,
  })),
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "08:00",
    closes: "17:00",
  },
  founder: { "@type": "Person", name: "Justin Davidson" },
  sameAs: [site.socials.youtube],
};
