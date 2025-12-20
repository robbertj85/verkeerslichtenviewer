'use client';

import { useEffect, useRef } from 'react';
import { PRIORITY_INFO, PriorityCategory } from '@/types/traffic-lights';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="backdrop:bg-black/50 rounded-lg shadow-xl max-w-lg w-full p-0 overflow-hidden"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Over Verkeerslichtenviewer</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Sluiten"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 text-sm text-gray-600">
          <p>
            Deze viewer toont alle <strong>intelligente verkeerslichten (iVRI&apos;s)</strong> die
            aangesloten zijn op het UDAP (Urban Data Access Platform) netwerk in Nederland.
          </p>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Prioriteitsklassen</h3>
            <p className="mb-2">
              iVRI&apos;s kunnen prioriteit geven aan verschillende verkeersdeelnemers:
            </p>
            <ul className="space-y-1.5">
              {([
                ['emergency', 'Ambulance, brandweer'],
                ['road_operator', 'Weginspecteurs, bergingsvoertuigen'],
                ['public_transport', 'Bussen, trams'],
                ['logistics', 'Logistiek transport'],
                ['agriculture', 'Tractoren, landbouwmachines'],
              ] as [PriorityCategory, string][]).map(([key, description]) => {
                const info = PRIORITY_INFO[key];
                return (
                  <li key={key} className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 flex-shrink-0"
                      fill="none"
                      stroke={info.color}
                      strokeWidth={1.5}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={info.svgPath} />
                    </svg>
                    <span><strong>{info.name}</strong> - {description}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Databronnen</h3>
            <ul className="space-y-1">
              <li>
                <a
                  href="https://map.udap.nl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  UDAP Viewer (map.udap.nl)
                </a>
                {' '}- Officiële UDAP kaart
              </li>
              <li>
                <a
                  href="https://www.talking-traffic.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Talking Traffic
                </a>
                {' '}- Samenwerkingsverband
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Licentie</h3>
            <p className="mb-2">
              Deze software is beschikbaar onder de{' '}
              <a
                href="https://opensource.org/licenses/MIT"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                MIT-licentie
              </a>.
            </p>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2">
              <strong>Disclaimer:</strong> De berekeningen en schattingen in deze tool zijn uitsluitend
              bedoeld ter indicatie en zijn gebaseerd op openbaar beschikbaar onderzoek.
              Gebruik is geheel op eigen risico.
            </p>
            <p className="text-xs text-gray-400">
              Dit is een onofficiële viewer. Data wordt opgehaald van de publieke UDAP API.
              <br />
              © {new Date().getFullYear()} Transport Beat BV
            </p>
          </div>
        </div>
      </div>
    </dialog>
  );
}
