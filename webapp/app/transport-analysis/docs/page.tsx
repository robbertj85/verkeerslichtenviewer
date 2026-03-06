import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Upload formaten - Transport Analyse | Verkeerslichtenviewer',
  description:
    'Documentatie voor het uploaden van ritgegevens voor bulk analyse. Ondersteunde formaten: CSV, OTM v5 (JSON), CBS Wegvervoer XML.',
};

export default function TransportAnalysisDocsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/transport-analysis"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Terug naar analyse</span>
          </Link>
          <div className="h-6 w-px bg-gray-300" />
          <h1 className="text-lg font-semibold text-gray-900">Upload formaten</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        {/* Intro */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Bulk analyse upload formaten</h2>
          <p className="text-gray-600 leading-relaxed">
            De transport analyse tool accepteert drie bestandsformaten voor het uploaden van ritgegevens.
            Hieronder vindt u per formaat een gedetailleerde beschrijving van de structuur, vereiste velden
            en voorbeelden.
          </p>
        </section>

        {/* CSV */}
        <section id="csv" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSV / Excel (.csv, .txt, .xlsx)
            </h3>
          </div>
          <div className="p-6 space-y-5">
            <p className="text-gray-600">
              Comma-, puntkomma- of tab-gescheiden bestand met een headerrij. De parser herkent kolomnamen automatisch
              op basis van Nederlandse en Engelse varianten.
            </p>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Ondersteunde kolommen</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 border border-gray-200 font-medium">Veld</th>
                      <th className="text-left px-3 py-2 border border-gray-200 font-medium">Herkende kolomnamen</th>
                      <th className="text-left px-3 py-2 border border-gray-200 font-medium">Verplicht</th>
                      <th className="text-left px-3 py-2 border border-gray-200 font-medium">Beschrijving</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600">
                    <tr>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">herkomst</td>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">origin, herkomst, van, from, start</td>
                      <td className="px-3 py-2 border border-gray-200">Ja*</td>
                      <td className="px-3 py-2 border border-gray-200">Adres of plaatsnaam van de herkomst</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">bestemming</td>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">destination, bestemming, naar, to, end, eind</td>
                      <td className="px-3 py-2 border border-gray-200">Ja*</td>
                      <td className="px-3 py-2 border border-gray-200">Adres of plaatsnaam van de bestemming</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">origin_lat</td>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">origin_lat, herkomst_lat, start_lat, van_lat</td>
                      <td className="px-3 py-2 border border-gray-200">Optioneel</td>
                      <td className="px-3 py-2 border border-gray-200">Breedtegraad herkomst (WGS84)</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">origin_lng</td>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">origin_lng, origin_lon, herkomst_lng, start_lng</td>
                      <td className="px-3 py-2 border border-gray-200">Optioneel</td>
                      <td className="px-3 py-2 border border-gray-200">Lengtegraad herkomst (WGS84)</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">dest_lat</td>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">dest_lat, destination_lat, bestemming_lat, end_lat</td>
                      <td className="px-3 py-2 border border-gray-200">Optioneel</td>
                      <td className="px-3 py-2 border border-gray-200">Breedtegraad bestemming (WGS84)</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">dest_lng</td>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">dest_lng, dest_lon, destination_lng, end_lng</td>
                      <td className="px-3 py-2 border border-gray-200">Optioneel</td>
                      <td className="px-3 py-2 border border-gray-200">Lengtegraad bestemming (WGS84)</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">origin_postal</td>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">origin_postal, herkomst_postcode, van_postcode, origin_zip</td>
                      <td className="px-3 py-2 border border-gray-200">Optioneel</td>
                      <td className="px-3 py-2 border border-gray-200">Postcode herkomst (Nederlandse postcode is zeer nauwkeurig)</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">dest_postal</td>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">dest_postal, destination_postal, bestemming_postcode, naar_postcode, dest_zip</td>
                      <td className="px-3 py-2 border border-gray-200">Optioneel</td>
                      <td className="px-3 py-2 border border-gray-200">Postcode bestemming</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">voertuigtype</td>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">vehicle, voertuig, voertuigtype, vehicle_type, type</td>
                      <td className="px-3 py-2 border border-gray-200">Optioneel</td>
                      <td className="px-3 py-2 border border-gray-200"><code className="bg-gray-100 px-1 rounded">heavy</code> of <code className="bg-gray-100 px-1 rounded">light</code> (standaard: heavy)</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">ritten_per_dag</td>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">trips, ritten, trips_per_day, ritten_per_dag, aantal</td>
                      <td className="px-3 py-2 border border-gray-200">Optioneel</td>
                      <td className="px-3 py-2 border border-gray-200">Aantal ritten per dag (standaard: 1)</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">kenteken</td>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">license, kenteken, license_number, plate, nummerplaat</td>
                      <td className="px-3 py-2 border border-gray-200">Optioneel</td>
                      <td className="px-3 py-2 border border-gray-200">Nederlands kenteken (voor automatische RDW voertuigclassificatie)</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">datum</td>
                      <td className="px-3 py-2 border border-gray-200 font-mono text-xs">timestamp, datum, date, datetime, tijd</td>
                      <td className="px-3 py-2 border border-gray-200">Optioneel</td>
                      <td className="px-3 py-2 border border-gray-200">Datum/tijd van de rit</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                * Minimaal herkomst + bestemming via adres, postcode of coordinaten.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Locatiebepaling prioriteit</h4>
              <p className="text-gray-600 text-sm mb-2">
                De parser probeert locaties in deze volgorde te bepalen:
              </p>
              <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1 ml-2">
                <li>Coordinaten (lat/lng) &mdash; geen geocoding nodig, snelst</li>
                <li>Postcode &mdash; zeer nauwkeurig voor Nederlandse postcodes via PDOK</li>
                <li>Adres/plaatsnaam &mdash; geocoding via PDOK Locatieserver</li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Voorbeelden</h4>

              <p className="text-sm text-gray-500 mb-1">Met header en puntkomma:</p>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto"><code>{`herkomst;bestemming;voertuigtype;ritten_per_dag
Rotterdam;Amsterdam;heavy;2
Utrecht;Eindhoven;light;4
Den Haag;Breda;heavy;1`}</code></pre>

              <p className="text-sm text-gray-500 mb-1 mt-4">Met coordinaten:</p>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto"><code>{`origin_lat;origin_lng;dest_lat;dest_lng;vehicle;trips
51.9225;4.4792;52.3676;4.9041;heavy;2
52.0907;5.1214;51.4416;5.4697;light;3`}</code></pre>

              <p className="text-sm text-gray-500 mb-1 mt-4">Met postcodes en kenteken:</p>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto"><code>{`herkomst_postcode;bestemming_postcode;kenteken;ritten_per_dag
3011AA;1012AB;BX-TP-56;2
5611AA;6811AA;VN-123-B;1`}</code></pre>

              <p className="text-sm text-gray-500 mb-1 mt-4">Simpel formaat (zonder header):</p>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto"><code>{`herkomst;bestemming
Rotterdam;Amsterdam
Utrecht;Eindhoven`}</code></pre>
            </div>
          </div>
        </section>

        {/* OTM v5 */}
        <section id="otm" className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
          <div className="bg-green-50 px-6 py-4 border-b border-green-200">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              </svg>
              OTM v5 &mdash; Open Trip Model (.json)
            </h3>
          </div>
          <div className="p-6 space-y-5">
            <p className="text-gray-600">
              Het{' '}
              <a href="https://opentripmodel.org" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                Open Trip Model (OTM)
              </a>{' '}
              is een open standaard voor het uitwisselen van logistieke ritgegevens. De parser ondersteunt
              OTM v5 trips en consignments in JSON formaat.
            </p>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Ondersteunde structuren</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold mt-0.5">1.</span>
                  <div>
                    <strong>Trip met stops</strong> &mdash; De eerste stop is de herkomst, de laatste stop de bestemming.
                    Elke stop moet een <code className="bg-gray-100 px-1 rounded text-xs">location</code> bevatten met coordinaten of adresgegevens.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold mt-0.5">2.</span>
                  <div>
                    <strong>Consignment</strong> &mdash; Herkomst wordt bepaald uit <code className="bg-gray-100 px-1 rounded text-xs">loadingLocation</code> of{' '}
                    <code className="bg-gray-100 px-1 rounded text-xs">consignor.location</code>, bestemming uit{' '}
                    <code className="bg-gray-100 px-1 rounded text-xs">unloadingLocation</code> of <code className="bg-gray-100 px-1 rounded text-xs">consignee.location</code>.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold mt-0.5">3.</span>
                  <div>
                    <strong>Array</strong> &mdash; Een JSON array van trips of consignments.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold mt-0.5">4.</span>
                  <div>
                    <strong>Container</strong> &mdash; Object met <code className="bg-gray-100 px-1 rounded text-xs">trips</code> of{' '}
                    <code className="bg-gray-100 px-1 rounded text-xs">consignments</code> array.
                  </div>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Locatie formaten</h4>
              <p className="text-sm text-gray-600 mb-2">Locaties worden herkend in de volgende formaten:</p>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                <li>GeoJSON Point: <code className="bg-gray-100 px-1 rounded text-xs">{`{ "type": "Point", "coordinates": [lng, lat] }`}</code></li>
                <li>Direct: <code className="bg-gray-100 px-1 rounded text-xs">{`{ "latitude": 52.37, "longitude": 4.89 }`}</code></li>
                <li>Adres: <code className="bg-gray-100 px-1 rounded text-xs">{`{ "street": "...", "city": "...", "postalCode": "..." }`}</code></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Voertuig informatie</h4>
              <p className="text-sm text-gray-600">
                Als een trip een <code className="bg-gray-100 px-1 rounded text-xs">vehicle</code> object bevat, worden de volgende velden gebruikt:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2 mt-1">
                <li><code className="bg-gray-100 px-1 rounded text-xs">licensePlate</code> &mdash; voor automatische RDW classificatie</li>
                <li><code className="bg-gray-100 px-1 rounded text-xs">grossVehicleWeight</code> &mdash; &le; 3500 kg = light, daarboven = heavy</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Voorbeeld: Trip met stops</h4>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto"><code>{`[
  {
    "id": "trip-001",
    "vehicle": {
      "licensePlate": "BX-TP-56"
    },
    "stops": [
      {
        "location": {
          "name": "DC Rotterdam",
          "geoReference": {
            "type": "Point",
            "coordinates": [4.4792, 51.9225]
          },
          "administrativeReference": {
            "postalCode": "3011AA",
            "city": "Rotterdam"
          }
        },
        "departureTime": "2025-03-06T08:00:00Z"
      },
      {
        "location": {
          "name": "Hub Amsterdam",
          "geoReference": {
            "type": "Point",
            "coordinates": [4.9041, 52.3676]
          },
          "administrativeReference": {
            "postalCode": "1012AB",
            "city": "Amsterdam"
          }
        },
        "arrivalTime": "2025-03-06T09:15:00Z"
      }
    ]
  }
]`}</code></pre>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Voorbeeld: Consignments</h4>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto"><code>{`{
  "consignments": [
    {
      "loadingLocation": {
        "name": "Magazijn Utrecht",
        "geoReference": {
          "type": "Point",
          "coordinates": [5.1214, 52.0907]
        }
      },
      "unloadingLocation": {
        "name": "Klant Eindhoven",
        "administrativeReference": {
          "postalCode": "5611AA",
          "city": "Eindhoven"
        }
      }
    }
  ]
}`}</code></pre>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Voorbeeld: Minimaal (alleen adressen)</h4>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto"><code>{`[
  {
    "stops": [
      {
        "location": {
          "administrativeReference": {
            "postalCode": "3011AA"
          }
        }
      },
      {
        "location": {
          "administrativeReference": {
            "postalCode": "1012AB"
          }
        }
      }
    ]
  }
]`}</code></pre>
            </div>
          </div>
        </section>

        {/* CBS XML */}
        <section id="cbs" className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden">
          <div className="bg-blue-50 px-6 py-4 border-b border-blue-200">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25m-2.25 0V5.625c0-.621-.504-1.125-1.125-1.125H5.25c-.621 0-1.125.504-1.125 1.125v12m10.125-12h2.25c.621 0 1.152.416 1.32 1.007l1.68 5.93m0 0H14.25m2.25-6.937V9" />
              </svg>
              CBS Wegvervoer XML (.xml)
            </h3>
          </div>
          <div className="p-6 space-y-5">
            <p className="text-gray-600">
              XML export vanuit een Transport Management Systeem (TMS) volgens het{' '}
              <a
                href="https://www.cbs.nl/nl-nl/deelnemers-enquetes/deelnemers-enquetes/bedrijven/onderzoek/wegvervoer"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                CBS Wegvervoer
              </a>{' '}
              schema. Dit formaat wordt gebruikt voor de CBS-enquete over goederenvervoer over de weg.
            </p>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Hoe het werkt</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
                <li>Elk <code className="bg-gray-100 px-1 rounded text-xs">&lt;motorVehicle&gt;</code> kan meerdere <code className="bg-gray-100 px-1 rounded text-xs">&lt;journey&gt;</code> elementen bevatten</li>
                <li>Per journey wordt <code className="bg-gray-100 px-1 rounded text-xs">&lt;startJourney&gt;</code> als herkomst en <code className="bg-gray-100 px-1 rounded text-xs">&lt;endJourney&gt;</code> als bestemming gebruikt</li>
                <li>Locaties worden bepaald via <code className="bg-gray-100 px-1 rounded text-xs">locationName</code>, <code className="bg-gray-100 px-1 rounded text-xs">postalCode</code> of <code className="bg-gray-100 px-1 rounded text-xs">locationLatitude</code>/<code className="bg-gray-100 px-1 rounded text-xs">locationLongitude</code></li>
                <li>Het kenteken (<code className="bg-gray-100 px-1 rounded text-xs">licenseNumber</code>) wordt gebruikt voor een RDW lookup om het voertuigtype automatisch te bepalen</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Voertuigtype classificatie</h4>
              <p className="text-sm text-gray-600 mb-2">
                Het voertuigtype (heavy/light) wordt automatisch bepaald op basis van:
              </p>
              <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1 ml-2">
                <li><strong>RDW data</strong> &mdash; EU voertuigcategorie (N2/N3 = heavy, N1 = light)</li>
                <li><strong>Laadvermogen trailer</strong> &mdash; uit <code className="bg-gray-100 px-1 rounded text-xs">&lt;loadingCapacity&gt;</code></li>
                <li><strong>Brutogewicht lading</strong> &mdash; optelsom van <code className="bg-gray-100 px-1 rounded text-xs">&lt;grossWeight&gt;</code> per shipment</li>
                <li><strong>Standaard</strong> &mdash; heavy (CBS Wegvervoer richt zich op beroepsgoederenvervoer)</li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Voorbeeld</h4>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto"><code>{`<?xml version="1.0" encoding="UTF-8"?>
<roadFreightSurvey>
  <motorVehicle>
    <licenseNumber>BX-TP-56</licenseNumber>
    <countryCode>NL</countryCode>
    <vehicleActivity>1</vehicleActivity>
    <trailer>
      <emptyWeight>7500</emptyWeight>
      <loadingCapacity>25000</loadingCapacity>
    </trailer>
    <journey>
      <typeOfTransport>1</typeOfTransport>
      <startDateTimeJourney>2025-03-06T08:00:00</startDateTimeJourney>
      <startJourney>
        <locationName>Rotterdam</locationName>
        <postalCode>3011AA</postalCode>
        <countryCode>NL</countryCode>
        <locationLatitude>51.9225</locationLatitude>
        <locationLongitude>4.4792</locationLongitude>
      </startJourney>
      <endDateTimeJourney>2025-03-06T09:15:00</endDateTimeJourney>
      <endJourney>
        <locationName>Amsterdam</locationName>
        <postalCode>1012AB</postalCode>
        <countryCode>NL</countryCode>
        <locationLatitude>52.3676</locationLatitude>
        <locationLongitude>4.9041</locationLongitude>
      </endJourney>
      <journeyDistance>78</journeyDistance>
      <shipment>
        <grossWeight>18000</grossWeight>
        <shipmentDistance>78</shipmentDistance>
        <loadingLocation>
          <locationName>Rotterdam</locationName>
        </loadingLocation>
        <unloadingLocation>
          <locationName>Amsterdam</locationName>
        </unloadingLocation>
      </shipment>
    </journey>
  </motorVehicle>
</roadFreightSurvey>`}</code></pre>
            </div>
          </div>
        </section>

        {/* Tips */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Tips</h3>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-3">
              <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
              <div>
                <strong>Coordinaten zijn het snelst.</strong> Als u coordinaten heeft, gebruik die. Dit vermijdt geocoding en is aanzienlijk sneller bij grote aantallen ritten.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
              <div>
                <strong>Nederlandse postcodes zijn zeer nauwkeurig.</strong> Een 6-cijferige postcode (bijv. 3011AA) is voldoende voor een accurate analyse.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
              <div>
                <strong>Kentekens worden automatisch opgezocht.</strong> Bij het meegeven van een Nederlands kenteken wordt het voertuigtype automatisch bepaald via de RDW Open Data API.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</span>
              <div>
                <strong>Meerdere bestanden tegelijk.</strong> U kunt meerdere bestanden selecteren of slepen. Ritten uit alle bestanden worden samengevoegd.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-100 text-blue-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">5</span>
              <div>
                <strong>Formaten mixen.</strong> U kunt een CSV en een XML bestand tegelijk uploaden. De parser detecteert het formaat per bestand.
              </div>
            </li>
          </ul>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-gray-400 pb-8">
          <p>
            Hulp nodig?{' '}
            <a href="https://calendly.com/robbertjanssen" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              Neem contact op
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
