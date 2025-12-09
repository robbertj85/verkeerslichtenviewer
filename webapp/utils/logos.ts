/**
 * Logo utilities for road authorities and TLC organizations
 *
 * Uses multiple sources:
 * - Clearbit Logo API for companies
 * - Wikipedia for municipality coats of arms
 * - Direct URLs for known organizations
 */

// TLC Organization logos - direct mappings to company websites
export const TLC_LOGOS: Record<string, string> = {
  'Vialis': 'https://logo.clearbit.com/vialis.nl',
  'Swarco': 'https://logo.clearbit.com/swarco.com',
  'Swarco - Peek Traffic': 'https://logo.clearbit.com/swarco.com',
  'Ko Hartog': 'https://logo.clearbit.com/kohartog.nl',
};

// Province logos - using Wikipedia coat of arms
export const PROVINCE_LOGOS: Record<string, string> = {
  'Provincie Drenthe': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Drenthe_wapen.svg/80px-Drenthe_wapen.svg.png',
  'Provincie Gelderland': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Gelderland_wapen.svg/80px-Gelderland_wapen.svg.png',
  'Provincie Groningen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Groningen_wapen.svg/80px-Groningen_wapen.svg.png',
  'Provincie Limburg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Limburg_%28Nederland%29_wapen.svg/80px-Limburg_%28Nederland%29_wapen.svg.png',
  'Provincie Noord-Brabant': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Noord-Brabant_wapen.svg/80px-Noord-Brabant_wapen.svg.png',
  'Provincie Overijssel': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Overijssel_wapen.svg/80px-Overijssel_wapen.svg.png',
  'Provincie Utrecht': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Utrecht_%28provincie%29_wapen.svg/80px-Utrecht_%28provincie%29_wapen.svg.png',
  'Provincie Zeeland': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Zeeland_wapen.svg/80px-Zeeland_wapen.svg.png',
  'Provincie Zuid-Holland': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Zuid-Holland_wapen.svg/80px-Zuid-Holland_wapen.svg.png',
};

// Rijkswaterstaat logo
const RWS_LOGO = 'https://logo.clearbit.com/rijkswaterstaat.nl';

// Municipality coat of arms from Wikipedia
// Format: https://upload.wikimedia.org/wikipedia/commons/thumb/{path}/{size}px-{filename}
export const MUNICIPALITY_LOGOS: Record<string, string> = {
  'Alkmaar': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Alkmaar_wapen.svg/80px-Alkmaar_wapen.svg.png',
  'Almelo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Almelo_wapen.svg/80px-Almelo_wapen.svg.png',
  'Almere': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Almere_wapen.svg/80px-Almere_wapen.svg.png',
  'Alphen aan den Rijn': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Alphen_aan_den_Rijn_wapen.svg/80px-Alphen_aan_den_Rijn_wapen.svg.png',
  'Amersfoort': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Amersfoort_wapen.svg/80px-Amersfoort_wapen.svg.png',
  'Amstelveen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Amstelveen_wapen.svg/80px-Amstelveen_wapen.svg.png',
  'Apeldoorn': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Apeldoorn_wapen.svg/80px-Apeldoorn_wapen.svg.png',
  'Arnhem': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Arnhem_wapen.svg/80px-Arnhem_wapen.svg.png',
  'Breda': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Breda_wapen.svg/80px-Breda_wapen.svg.png',
  'Capelle aan den IJssel': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Capelle_aan_den_IJssel_wapen.svg/80px-Capelle_aan_den_IJssel_wapen.svg.png',
  'Delft': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Delft_wapen.svg/80px-Delft_wapen.svg.png',
  'Den Haag': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/%27s-Gravenhage_wapen.svg/80px-%27s-Gravenhage_wapen.svg.png',
  'Deventer': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Deventer_wapen.svg/80px-Deventer_wapen.svg.png',
  'Dordrecht': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Dordrecht_wapen.svg/80px-Dordrecht_wapen.svg.png',
  'Eindhoven': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Eindhoven_wapen.svg/80px-Eindhoven_wapen.svg.png',
  'Emmen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Emmen_wapen.svg/80px-Emmen_wapen.svg.png',
  'Enschede': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Enschede_wapen.svg/80px-Enschede_wapen.svg.png',
  'Gouda': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Gouda_wapen.svg/80px-Gouda_wapen.svg.png',
  'Groningen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Groningen_stad_wapen.svg/80px-Groningen_stad_wapen.svg.png',
  'Haarlemmermeer': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Haarlemmermeer_wapen.svg/80px-Haarlemmermeer_wapen.svg.png',
  'Helmond': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Helmond_wapen.svg/80px-Helmond_wapen.svg.png',
  'Hengelo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Hengelo_wapen.svg/80px-Hengelo_wapen.svg.png',
  'Hilversum': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Hilversum_wapen.svg/80px-Hilversum_wapen.svg.png',
  'Leeuwarden': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Leeuwarden_wapen.svg/80px-Leeuwarden_wapen.svg.png',
  'Leiden': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Leiden_wapen.svg/80px-Leiden_wapen.svg.png',
  'Leidschendam-Voorburg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Leidschendam-Voorburg_wapen.svg/80px-Leidschendam-Voorburg_wapen.svg.png',
  'Leusden': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Leusden_wapen.svg/80px-Leusden_wapen.svg.png',
  'Maastricht': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Maastricht_wapen.svg/80px-Maastricht_wapen.svg.png',
  'Nieuwegein': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Nieuwegein_wapen.svg/80px-Nieuwegein_wapen.svg.png',
  'Nijmegen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Nijmegen_wapen.svg/80px-Nijmegen_wapen.svg.png',
  'Nissewaard': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Nissewaard_wapen.svg/80px-Nissewaard_wapen.svg.png',
  'Oosterhout': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Oosterhout_wapen.svg/80px-Oosterhout_wapen.svg.png',
  'Pijnacker-Nootdorp': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Pijnacker-Nootdorp_wapen.svg/80px-Pijnacker-Nootdorp_wapen.svg.png',
  'Rheden': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Rheden_wapen.svg/80px-Rheden_wapen.svg.png',
  'Rijswijk': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Rijswijk_wapen.svg/80px-Rijswijk_wapen.svg.png',
  'Rotterdam': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Rotterdam_wapen.svg/80px-Rotterdam_wapen.svg.png',
  'Schiedam': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Schiedam_wapen.svg/80px-Schiedam_wapen.svg.png',
  'Soest': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Soest_wapen.svg/80px-Soest_wapen.svg.png',
  'Terneuzen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Terneuzen_wapen.svg/80px-Terneuzen_wapen.svg.png',
  'Teylingen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Teylingen_wapen.svg/80px-Teylingen_wapen.svg.png',
  'Tilburg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Tilburg_wapen.svg/80px-Tilburg_wapen.svg.png',
  'Utrecht': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Utrecht_wapen.svg/80px-Utrecht_wapen.svg.png',
  'Valkenswaard': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Valkenswaard_wapen.svg/80px-Valkenswaard_wapen.svg.png',
  'Veldhoven': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Veldhoven_wapen.svg/80px-Veldhoven_wapen.svg.png',
  'Velsen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Velsen_wapen.svg/80px-Velsen_wapen.svg.png',
  'Venlo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Venlo_wapen.svg/80px-Venlo_wapen.svg.png',
  'Vlaardingen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Vlaardingen_wapen.svg/80px-Vlaardingen_wapen.svg.png',
  'Waalre': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Waalre_wapen.svg/80px-Waalre_wapen.svg.png',
  'Wassenaar': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Wassenaar_wapen.svg/80px-Wassenaar_wapen.svg.png',
  'Westland': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Westland_wapen.svg/80px-Westland_wapen.svg.png',
  'Woerden': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Woerden_wapen.svg/80px-Woerden_wapen.svg.png',
  'Zaanstad': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Zaanstad_wapen.svg/80px-Zaanstad_wapen.svg.png',
  'Zeist': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Zeist_wapen.svg/80px-Zeist_wapen.svg.png',
  'Zoetermeer': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Zoetermeer_wapen.svg/80px-Zoetermeer_wapen.svg.png',
  'Zutphen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Zutphen_wapen.svg/80px-Zutphen_wapen.svg.png',
  'Zwolle': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Zwolle_wapen.svg/80px-Zwolle_wapen.svg.png',
  's-Hertogenbosch': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/%27s-Hertogenbosch_wapen.svg/80px-%27s-Hertogenbosch_wapen.svg.png',
  'Port of Moerdijk': 'https://logo.clearbit.com/portofmoerdijk.nl',
};

/**
 * Get logo URL for a road authority
 */
export function getAuthorityLogo(authorityName: string): string | null {
  // Check municipality logos first
  if (MUNICIPALITY_LOGOS[authorityName]) {
    return MUNICIPALITY_LOGOS[authorityName];
  }

  // Check province logos
  if (PROVINCE_LOGOS[authorityName]) {
    return PROVINCE_LOGOS[authorityName];
  }

  // Check for Rijkswaterstaat
  if (authorityName.startsWith('RWS ')) {
    return RWS_LOGO;
  }

  return null;
}

/**
 * Get logo URL for a TLC organization
 */
export function getTlcLogo(tlcOrg: string): string | null {
  return TLC_LOGOS[tlcOrg] || null;
}

/**
 * Generate initials from a name for fallback display
 */
export function getInitials(name: string): string {
  if (!name) return '?';

  // Handle special cases
  if (name.startsWith('RWS ')) return 'RWS';
  if (name.startsWith('Provincie ')) {
    const provName = name.replace('Provincie ', '');
    return provName.substring(0, 2).toUpperCase();
  }

  // Get first letters of each word, max 2
  const words = name.split(/[\s-]+/).filter(w => w.length > 0);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words.slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

/**
 * Get a color for an authority based on its name (for fallback)
 */
export function getAuthorityColor(authorityName: string): string {
  // Use consistent colors based on name hash
  let hash = 0;
  for (let i = 0; i < authorityName.length; i++) {
    hash = authorityName.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate HSL color with fixed saturation and lightness
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 45%)`;
}
