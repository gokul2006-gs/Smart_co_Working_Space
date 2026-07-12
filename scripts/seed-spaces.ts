import { connectDB } from "../src/lib/db";
import { SpaceModel } from "../src/models/Space";

const seedSpaces = [
  {
    id: "loft-atelier",
    name: "The Loft Atelier",
    tagline: "Sun-drenched brick loft for makers",
    city: "New York",
    neighborhood: "SoHo",
    type: "Hot Desk",
    price: 34,
    rating: 4.9,
    reviews: 218,
    capacity: 40,
    seatsAvailable: 12,
    image: "/assets/space-1.jpg",
    amenities: ["Fast Wi-Fi", "Barista Coffee", "Phone Booths", "Bike Storage", "Natural Light"],
    description:
      "A restored industrial loft with exposed brick, twelve-foot windows, and a community of designers, writers, and founders. Grab a hot desk and settle into the calm hum of focused work.",
    host: "Mara Ellison",
  },
  {
    id: "glass-pod",
    name: "Glass Pod Studio",
    tagline: "Private glass offices, quietly considered",
    city: "San Francisco",
    neighborhood: "Hayes Valley",
    type: "Private Office",
    price: 89,
    rating: 4.8,
    reviews: 142,
    capacity: 6,
    seatsAvailable: 3,
    image: "/assets/space-2.jpg",
    amenities: ["Soundproofing", "Ergonomic Chairs", "Smart TV", "Fast Wi-Fi", "24/7 Access"],
    description:
      "Minimalist private offices wrapped in glass and warm cream tones. Perfect for small teams that want privacy without losing the daylight.",
    host: "Devon Park",
  },
  {
    id: "velvet-lounge",
    name: "Velvet & Co. Lounge",
    tagline: "A club room that happens to work",
    city: "London",
    neighborhood: "Shoreditch",
    type: "Lounge",
    price: 42,
    rating: 4.9,
    reviews: 305,
    capacity: 30,
    seatsAvailable: 8,
    image: "/assets/space-3.jpg",
    amenities: ["Craft Coffee Bar", "Velvet Seating", "Events", "Fast Wi-Fi", "Terrace"],
    description:
      "Tufted velvet sofas, a copper coffee bar, and terracotta walls. Velvet & Co. blurs the line between a members' club and a workspace.",
    host: "Priya Nandakumar",
  },
  {
    id: "boardroom-oak",
    name: "The Oak Boardroom",
    tagline: "Where decisions get made",
    city: "Chicago",
    neighborhood: "The Loop",
    type: "Meeting Room",
    price: 120,
    rating: 4.7,
    reviews: 96,
    capacity: 14,
    seatsAvailable: 14,
    image: "/assets/space-4.jpg",
    amenities: ["Video Conferencing", "Whiteboard", "Catering", "Fast Wi-Fi", "Concierge"],
    description:
      "A walnut-clad boardroom with sculptural lighting and floor-to-ceiling windows. Book by the hour for the meetings that matter.",
    host: "Cole Ferris",
  },
  {
    id: "skyline-terrace",
    name: "Skyline Terrace",
    tagline: "Golden-hour work with a view",
    city: "Los Angeles",
    neighborhood: "Downtown",
    type: "Lounge",
    price: 55,
    rating: 5.0,
    reviews: 174,
    capacity: 24,
    seatsAvailable: 6,
    image: "/assets/space-5.jpg",
    amenities: ["Rooftop", "City Views", "Fast Wi-Fi", "Bar", "Heaters"],
    description:
      "An open-air rooftop terrace framed by the skyline. Lounge seating, greenery, and the best golden-hour light in the city.",
    host: "Ana Reyes",
  },
  {
    id: "focus-carrels",
    name: "The Focus Carrels",
    tagline: "Deep work, warmly lit",
    city: "Austin",
    neighborhood: "East Side",
    type: "Hot Desk",
    price: 28,
    rating: 4.8,
    reviews: 131,
    capacity: 20,
    seatsAvailable: 15,
    image: "/assets/space-6.jpg",
    amenities: ["Quiet Zone", "Task Lighting", "Fast Wi-Fi", "Lockers", "Free Refills"],
    description:
      "Individual walnut carrels with dedicated task lighting for uninterrupted deep work. A library-quiet space for people who need to think.",
    host: "Sam Whitfield",
  },
] as const;

async function seed() {
  await connectDB();

  const count = await SpaceModel.countDocuments();
  if (count > 0) {
    console.log(`Database already has ${count} spaces — skipping seed.`);
    process.exit(0);
  }

  await SpaceModel.insertMany(seedSpaces);
  console.log(`Seeded ${seedSpaces.length} coworking spaces.`);
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
