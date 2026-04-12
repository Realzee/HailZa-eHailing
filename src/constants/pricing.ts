export interface PredefinedRoute {
  id: string;
  from: string;
  to: string;
  dayPrice: number;
  nightPrice: number;
}

export const PREDEFINED_ROUTES: PredefinedRoute[] = [
  { id: '1', from: 'Local', to: 'Local', dayPrice: 40, nightPrice: 40 },
  { id: '2', from: 'Mohlakeng', to: 'Randfontein', dayPrice: 70, nightPrice: 100 },
  { id: '3', from: 'Mohlakeng', to: 'Finsbury', dayPrice: 70, nightPrice: 180 },
  { id: '4', from: 'Mohlakeng', to: 'Toekomsrus', dayPrice: 50, nightPrice: 70 },
  { id: '5', from: 'Mohlakeng', to: 'Bekkersdal', dayPrice: 70, nightPrice: 250 },
  { id: '6', from: 'Mohlakeng', to: 'Rietvallei', dayPrice: 120, nightPrice: 150 },
  { id: '7', from: 'Mohlakeng', to: 'Kagiso', dayPrice: 160, nightPrice: 200 },
  { id: '8', from: 'Mohlakeng', to: 'Krugersdorp CBD', dayPrice: 160, nightPrice: 200 },
  { id: '9', from: 'Mohlakeng', to: 'Munsieville', dayPrice: 200, nightPrice: 200 },
  { id: '10', from: 'Mohlakeng', to: 'Westonaria', dayPrice: 120, nightPrice: 250 },
  { id: '11', from: 'Mohlakeng', to: 'Hillshaven', dayPrice: 160, nightPrice: 200 },
  { id: '12', from: 'Mohlakeng', to: 'Glenharvie', dayPrice: 200, nightPrice: 250 },
  { id: '13', from: 'Randfontein', to: 'Rietvallei', dayPrice: 70, nightPrice: 100 },
  { id: '14', from: 'Randfontein', to: 'Kagiso', dayPrice: 80, nightPrice: 100 },
  { id: '15', from: 'Westonaria', to: 'Kagiso', dayPrice: 200, nightPrice: 250 },
  { id: '16', from: 'Westonaria', to: 'Randfontein', dayPrice: 160, nightPrice: 200 },
  { id: '17', from: 'Westonaria', to: 'Krugersdorp', dayPrice: 250, nightPrice: 300 },
  // Night shift specific from image (Kagiso as base)
  { id: 'n1', from: 'Kagiso', to: 'Azaadville/Chamdor/Lewisham/Sinqobile', dayPrice: 50, nightPrice: 60 },
  { id: 'n2', from: 'Kagiso', to: 'Swanneville', dayPrice: 80, nightPrice: 100 },
  { id: 'n3', from: 'Kagiso', to: 'Witpoortjie', dayPrice: 100, nightPrice: 120 },
  { id: 'n4', from: 'Kagiso', to: 'Krugersdorp/West/North', dayPrice: 120, nightPrice: 150 },
  { id: 'n5', from: 'Kagiso', to: 'Silverstar casino/Cradlestone', dayPrice: 160, nightPrice: 200 },
  { id: 'n6', from: 'Kagiso', to: 'Randfontein', dayPrice: 80, nightPrice: 100 },
  { id: 'n7', from: 'Kagiso', to: 'Finsbury/Dantlome', dayPrice: 140, nightPrice: 180 },
  { id: 'n8', from: 'Kagiso', to: 'Munsieville', dayPrice: 160, nightPrice: 200 },
  { id: 'n9', from: 'Kagiso', to: 'Mohlakeng', dayPrice: 160, nightPrice: 200 },
  { id: 'n10', from: 'Kagiso', to: 'Westonaria', dayPrice: 200, nightPrice: 250 },
  { id: 'n11', from: 'Kagiso', to: 'Bekkersdal/Semunye', dayPrice: 200, nightPrice: 250 },
  { id: 'n12', from: 'Kagiso', to: 'Roodepoort', dayPrice: 160, nightPrice: 200 },
  { id: 'n13', from: 'Kagiso', to: 'Florida', dayPrice: 200, nightPrice: 250 },
  { id: 'n14', from: 'Kagiso', to: 'Johannesburg CBD', dayPrice: 350, nightPrice: 450 },
];

export const FALLBACK_KM_PRICE = 10;

export function getPriceForRoute(routeId: string | null, distanceKm: number): number {
  const now = new Date();
  const hour = now.getHours();
  const isNight = hour >= 20 || hour < 5;

  if (routeId) {
    const route = PREDEFINED_ROUTES.find(r => r.id === routeId);
    if (route) {
      return isNight ? route.nightPrice : route.dayPrice;
    }
  }

  // Fallback: R10 per km
  return Math.round(distanceKm * FALLBACK_KM_PRICE);
}
