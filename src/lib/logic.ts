export type PartnerCategory = 'NGO' | 'Orphanage' | 'PetFeed' | 'Fertilizer';

export interface Partner {
  id: string;
  name: string;
  distance: number;
  type: string;
  category: PartnerCategory;
  address: string;
  email: string;
  phone: string;
  lat: number;
  lon: number;
}

export const PARTNERS: Partner[] = [
  // NGOs & Orphanages (Edible Good Food)
  { 
    id: "h1", name: "City Food Bank", distance: 2.5, type: "Food Bank", category: 'NGO',
    address: "123 Main St, Bangalore", email: "contact@cityfoodbank.org", phone: "+91 98765 43210",
    lat: 12.9850, lon: 77.6100
  },
  { 
    id: "h2", name: "Shelter Meals", distance: 4.2, type: "Homeless Shelter", category: 'NGO',
    address: "456 Park Ave, Bangalore", email: "info@sheltermeals.in", phone: "+91 87654 32109",
    lat: 12.9950, lon: 77.6200
  },
  { 
    id: "h3", name: "Community Kitchen", distance: 1.8, type: "Community", category: 'NGO',
    address: "789 Lake View, Bangalore", email: "hello@communitykitchen.com", phone: "+91 76543 21098",
    lat: 12.9750, lon: 77.5850
  },
  { 
    id: "h4", name: "Hope Harvest", distance: 3.1, type: "Food Bank", category: 'NGO',
    address: "101 Green Rd, Bangalore", email: "support@hopeharvest.org", phone: "+91 65432 10987",
    lat: 12.9650, lon: 77.6050
  },
  { 
    id: "o1", name: "Sunshine Orphanage", distance: 2.8, type: "Children's Home", category: 'Orphanage',
    address: "202 Sky Ln, Bangalore", email: "care@sunshine.org", phone: "+91 54321 09876",
    lat: 12.9600, lon: 77.5800
  },
  { 
    id: "o2", name: "Little Hearts Home", distance: 5.1, type: "Orphanage", category: 'Orphanage',
    address: "303 Love St, Bangalore", email: "contact@littlehearts.in", phone: "+91 43210 98765",
    lat: 12.9500, lon: 77.5700
  },
  
  // Pet Feed Makers (Semi-edible Food)
  { 
    id: "p1", name: "Paws & Care Feed", distance: 3.5, type: "Animal Feed Maker", category: 'PetFeed',
    address: "404 Tail Way, Bangalore", email: "feed@pawscare.com", phone: "+91 32109 87654",
    lat: 12.9400, lon: 77.6100
  },
  { 
    id: "p2", name: "Happy Tails Nutrition", distance: 5.2, type: "Pet Food Processor", category: 'PetFeed',
    address: "505 Bark Blvd, Bangalore", email: "nutrition@happytails.org", phone: "+91 21098 76543",
    lat: 12.9300, lon: 77.6200
  },
  { 
    id: "p3", name: "Urban Pet Haven", distance: 2.1, type: "Feed Collector", category: 'PetFeed',
    address: "606 Furry Rd, Bangalore", email: "info@urbanpet.in", phone: "+91 10987 65432",
    lat: 12.9800, lon: 77.5700
  },

  // Organic Fertilizer Makers (Wet Waste)
  { 
    id: "f1", name: "Green Earth Compost", distance: 6.2, type: "Fertilizer Plant", category: 'Fertilizer',
    address: "707 Soil St, Bangalore", email: "green@earthcompost.com", phone: "+91 99887 76655",
    lat: 12.9900, lon: 77.5700
  },
  { 
    id: "f2", name: "Bio-Organic Solutions", distance: 4.5, type: "Composting Unit", category: 'Fertilizer',
    address: "808 Nature Ln, Bangalore", email: "bio@organicsolutions.org", phone: "+91 88776 65544",
    lat: 12.9200, lon: 77.5900
  },
];

export function predictDemand(pastSales: number, timeOfDay: string): number {
  let multiplier = 1.0;
  switch (timeOfDay.toLowerCase()) {
    case "breakfast":
      multiplier = 0.8;
      break;
    case "lunch":
      multiplier = 1.3;
      break;
    case "dinner":
      multiplier = 1.5;
      break;
    case "late night":
      multiplier = 0.6;
      break;
  }
  return Math.round(pastSales * multiplier);
}

export function getRecommendedAction(surplus: number, foodType: string) {
  if (surplus <= 0) {
    return "Maintain current preparation levels.";
  }

  let baseAction = "";
  if (surplus < 5) {
    baseAction = "Low Surplus: Suggest reducing next shift preparation.";
  } else if (surplus < 15) {
    baseAction = "Medium Surplus: Suggest 30% discount + redistribution.";
  } else {
    baseAction = "High Surplus: Immediate redistribution recommended.";
  }

  let destination = "";
  switch (foodType) {
    case 'Edible':
      destination = "Redirect to NGOs or Orphanages.";
      break;
    case 'Semi-edible':
      destination = "Redirect to Pet Feed Makers.";
      break;
    case 'Wet Waste':
      destination = "Redirect to Organic Fertilizer Makers.";
      break;
  }

  return `${baseAction} ${destination}`;
}

export function findNearestPartner(partners: Partner[]): Partner {
  return [...partners].sort((a, b) => a.distance - b.distance)[0];
}
