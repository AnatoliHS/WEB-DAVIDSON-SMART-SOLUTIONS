// LocalBusiness structured data for the home page.
// The street address is left out until it's confirmed: add streetAddress and postalCode here once it is.
const site = require("./site.json");

module.exports = {
  "@context": "https://schema.org",
  "@type": "Electrician",
  "@id": `${site.url}/#business`,
  name: site.title,
  description: site.description,
  url: `${site.url}/`,
  telephone: `+1-${site.phone}`,
  email: site.email,
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
