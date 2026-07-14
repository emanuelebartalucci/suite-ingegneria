export interface CableFormation {
  formation: string;
  diameter: number; // mm
  weight: number;    // kg/m
}

export interface CableProduct {
  id: string;
  name: string;
  description: string;
  type: 'cavo';
  formations: CableFormation[];
}

export interface ContainerSize {
  code: string;
  label: string;
  width?: number;          // mm (per rettangolari)
  height?: number;         // mm (per rettangolari)
  outerDiameter?: number;  // mm (per circolari)
  innerDiameter?: number;  // mm (per circolari)
  weight: number;          // kg/m (condotto vuoto)
  coverWeight?: number;    // kg/m (opzionale, solo canali)
}

export interface ContainerFamily {
  id: string;
  name: string;
  description: string;
  type: 'contenitore';
  sectionType: 'rettangolare' | 'circolare';
  installationType: 'vista' | 'cavidotto' | 'tazze';
  sizes: ContainerSize[];
}

export const INITIAL_CABLES: CableProduct[] = [
  {
    id: 'fs17',
    name: 'FS17 450/750 V',
    description: 'Cavo unipolare energia isolato in PVC di qualità S17, antifiamma CPR Cca-s3,d1,a3.',
    type: 'cavo',
    formations: [
      { formation: '1x1', diameter: 2.7, weight: 0.015 },
      { formation: '1x1.5', diameter: 2.9, weight: 0.020 },
      { formation: '1x2.5', diameter: 3.6, weight: 0.031 },
      { formation: '1x4', diameter: 4.2, weight: 0.045 },
      { formation: '1x6', diameter: 4.6, weight: 0.063 },
      { formation: '1x10', diameter: 6.0, weight: 0.109 },
      { formation: '1x16', diameter: 7.0, weight: 0.160 },
      { formation: '1x25', diameter: 8.6, weight: 0.244 },
      { formation: '1x35', diameter: 10.0, weight: 0.332 },
      { formation: '1x50', diameter: 11.7, weight: 0.474 },
      { formation: '1x70', diameter: 13.3, weight: 0.655 },
      { formation: '1x95', diameter: 15.1, weight: 0.864 },
      { formation: '1x120', diameter: 16.9, weight: 1.098 },
      { formation: '1x150', diameter: 18.6, weight: 1.380 },
      { formation: '1x185', diameter: 20.5, weight: 1.690 },
      { formation: '1x240', diameter: 23.9, weight: 2.210 },
      { formation: '1x300', diameter: 27.2, weight: 2.794 }
    ]
  },
  {
    id: 'fg17',
    name: 'FG17 450/750 V',
    description: 'Cavo unipolare flessibile isolato in mescola elastomerica G17 LS0H, antifiamma CPR Cca-s1b,d1,a1.',
    type: 'cavo',
    formations: [
      { formation: '1x1', diameter: 2.7, weight: 0.015 },
      { formation: '1x1.5', diameter: 2.9, weight: 0.020 },
      { formation: '1x2.5', diameter: 3.5, weight: 0.031 },
      { formation: '1x4', diameter: 4.1, weight: 0.045 },
      { formation: '1x6', diameter: 4.6, weight: 0.063 },
      { formation: '1x10', diameter: 6.0, weight: 0.107 },
      { formation: '1x16', diameter: 7.0, weight: 0.160 },
      { formation: '1x25', diameter: 8.6, weight: 0.247 },
      { formation: '1x35', diameter: 10.0, weight: 0.330 },
      { formation: '1x50', diameter: 11.7, weight: 0.481 },
      { formation: '1x70', diameter: 13.3, weight: 0.684 },
      { formation: '1x95', diameter: 15.1, weight: 0.873 },
      { formation: '1x120', diameter: 16.9, weight: 1.088 },
      { formation: '1x150', diameter: 18.6, weight: 1.380 },
      { formation: '1x185', diameter: 20.5, weight: 1.693 },
      { formation: '1x240', diameter: 23.9, weight: 2.222 },
      { formation: '1x300', diameter: 27.2, weight: 2.780 }
    ]
  },
  {
    id: 'h1z2z2_k',
    name: 'H1Z2Z2-K Solar',
    description: 'Cavo unipolare armonizzato per impianti fotovoltaici, isolamento reticolato LS0H, CPR Dca.',
    type: 'cavo',
    formations: [
      { formation: '1x1.5', diameter: 5.4, weight: 0.032 },
      { formation: '1x2.5', diameter: 5.9, weight: 0.043 },
      { formation: '1x4', diameter: 6.6, weight: 0.060 },
      { formation: '1x6', diameter: 7.4, weight: 0.082 },
      { formation: '1x10', diameter: 8.8, weight: 0.125 },
      { formation: '1x16', diameter: 10.1, weight: 0.185 },
      { formation: '1x25', diameter: 12.5, weight: 0.280 },
      { formation: '1x35', diameter: 14.0, weight: 0.370 },
      { formation: '1x50', diameter: 16.3, weight: 0.520 },
      { formation: '1x70', diameter: 18.7, weight: 0.720 },
      { formation: '1x95', diameter: 20.8, weight: 0.930 },
      { formation: '1x120', diameter: 22.8, weight: 1.160 },
      { formation: '1x150', diameter: 25.5, weight: 1.437 },
      { formation: '1x185', diameter: 28.5, weight: 1.750 },
      { formation: '1x240', diameter: 32.1, weight: 2.273 }
    ]
  },
  {
    id: 'sf225rz',
    name: 'SF225RZ',
    description: 'Cavo schermato a spirale per sistemi fissi antincendio, isolato in silicone CPR Cca-s1b,d1,a1.',
    type: 'cavo',
    formations: [
      { formation: '2x2.5', diameter: 8.7, weight: 0.100 }
    ]
  },
  {
    id: '12s1yvi',
    name: '12S1YVI',
    description: 'Cavo di rete schermato S/FTP Profibus DP con conduttori AWG22 solidi in rame, guaina LSZH.',
    type: 'cavo',
    formations: [
      { formation: '1x2xAWG22', diameter: 8.0, weight: 0.066 }
    ]
  },
  {
    id: 'futp_cat6',
    name: 'F-UTP Cat. 6',
    description: 'Cavo di rete dati schermato F/UTP in Categoria 6, conduttori AWG24 solidi, guaina LSZH CPR Dca.',
    type: 'cavo',
    formations: [
      { formation: '4x2xAWG24', diameter: 7.2, weight: 0.048 }
    ]
  },
  {
    id: 'futp_cat6a',
    name: 'F-UTP Cat. 6A',
    description: 'Cavo di rete dati schermato F/UTP in Categoria 6A, conduttori AWG23 solidi, guaina LSZH CPR Dca.',
    type: 'cavo',
    formations: [
      { formation: '4x2xAWG23', diameter: 7.8, weight: 0.058 }
    ]
  },
  {
    id: 'fg16or16',
    name: 'FG16OR16 0.6/1 kV',
    description: 'Cavo multipolare energia isolato in HEPR e guaina in PVC, non propagante CPR Cca-s3,d1,a3.',
    type: 'cavo',
    formations: [
      // 2x...
      { formation: '2x1.5', diameter: 9.4, weight: 0.127 },
      { formation: '2x2.5', diameter: 10.3, weight: 0.160 },
      { formation: '2x4', diameter: 11.3, weight: 0.207 },
      { formation: '2x6', diameter: 12.5, weight: 0.266 },
      { formation: '2x10', diameter: 14.4, weight: 0.388 },
      { formation: '2x16', diameter: 16.6, weight: 0.542 },
      { formation: '2x25', diameter: 20.8, weight: 0.827 },
      { formation: '2x35', diameter: 23.0, weight: 1.073 },
      { formation: '2x50', diameter: 27.0, weight: 1.498 },
      { formation: '2x70', diameter: 29.9, weight: 1.975 },
      { formation: '2x95', diameter: 33.7, weight: 2.560 },
      { formation: '2x120', diameter: 37.8, weight: 3.280 },
      { formation: '2x150', diameter: 42.4, weight: 4.130 },
      // 3x...
      { formation: '3x1.5', diameter: 9.9, weight: 0.141 },
      { formation: '3x2.5', diameter: 10.8, weight: 0.182 },
      { formation: '3x4', diameter: 11.9, weight: 0.242 },
      { formation: '3x6', diameter: 13.2, weight: 0.316 },
      { formation: '3x10', diameter: 15.3, weight: 0.472 },
      { formation: '3x16', diameter: 17.6, weight: 0.666 },
      { formation: '3x25', diameter: 22.1, weight: 1.023 },
      { formation: '3x35', diameter: 24.5, weight: 1.373 },
      { formation: '3x50', diameter: 28.1, weight: 1.904 },
      { formation: '3x70', diameter: 32.1, weight: 2.530 },
      { formation: '3x95', diameter: 36.6, weight: 3.340 },
      { formation: '3x120', diameter: 39.8, weight: 4.205 },
      { formation: '3x150', diameter: 44.4, weight: 5.257 },
      { formation: '3x185', diameter: 51.2, weight: 6.587 },
      { formation: '3x240', diameter: 58.5, weight: 8.570 },
      { formation: '3x300', diameter: 66.1, weight: 10.800 },
      // 4x...
      { formation: '4x1.5', diameter: 11.2, weight: 0.182 },
      { formation: '4x2.5', diameter: 12.3, weight: 0.234 },
      { formation: '4x4', diameter: 12.9, weight: 0.288 },
      { formation: '4x6', diameter: 14.4, weight: 0.381 },
      { formation: '4x10', diameter: 16.7, weight: 0.576 },
      { formation: '4x16', diameter: 19.2, weight: 0.820 },
      { formation: '4x25', diameter: 24.1, weight: 1.260 },
      { formation: '4x35', diameter: 26.8, weight: 1.670 },
      { formation: '4x50', diameter: 32.0, weight: 2.290 },
      { formation: '4x70', diameter: 36.0, weight: 3.090 },
      { formation: '4x95', diameter: 40.7, weight: 4.240 },
      { formation: '4x120', diameter: 45.1, weight: 5.380 },
      { formation: '4x150', diameter: 49.4, weight: 6.655 },
      { formation: '4x185', diameter: 56.7, weight: 8.285 },
      { formation: '4x240', diameter: 64.1, weight: 10.780 },
      // 3x... + ... (ridotto)
      { formation: '3x35+25', diameter: 24.9, weight: 1.553 },
      { formation: '3x50+25', diameter: 30.1, weight: 2.092 },
      { formation: '3x70+35', diameter: 33.6, weight: 2.806 },
      { formation: '3x95+50', diameter: 38.7, weight: 3.767 },
      { formation: '3x120+70', diameter: 42.8, weight: 4.833 },
      { formation: '3x150+95', diameter: 47.8, weight: 6.080 },
      { formation: '3x185+95', diameter: 53.0, weight: 7.296 },
      { formation: '3x240+150', diameter: 60.2, weight: 9.443 },
      { formation: '3x300+150', diameter: 69.5, weight: 11.996 },
      // 5x...
      { formation: '5x1.5', diameter: 12.0, weight: 0.207 },
      { formation: '5x2.5', diameter: 13.2, weight: 0.270 },
      { formation: '5x4', diameter: 14.0, weight: 0.338 },
      { formation: '5x6', diameter: 15.6, weight: 0.450 },
      { formation: '5x10', diameter: 18.1, weight: 0.685 },
      { formation: '5x16', diameter: 21.1, weight: 0.981 },
      { formation: '5x25', diameter: 26.5, weight: 1.513 },
      { formation: '5x35', diameter: 29.5, weight: 2.015 },
      { formation: '5x50', diameter: 36.3, weight: 2.965 },
      { formation: '5x70', diameter: 40.8, weight: 4.022 },
      { formation: '5x95', diameter: 45.6, weight: 5.195 },
      { formation: '5x120', diameter: 50.3, weight: 6.573 },
      { formation: '5x150', diameter: 56.5, weight: 8.275 },
      { formation: '5x185', diameter: 63.6, weight: 10.215 },
      { formation: '5x240', diameter: 72.8, weight: 13.120 }
    ]
  },
  {
    id: 'fg16om16',
    name: 'FG16OM16 0.6/1 kV',
    description: 'Cavo multipolare energia isolato in HEPR e guaina LSZH, antifiamma CPR Cca-s1b,d1,a1.',
    type: 'cavo',
    formations: [
      // 2x...
      { formation: '2x1.5', diameter: 9.9, weight: 0.140 },
      { formation: '2x2.5', diameter: 10.8, weight: 0.177 },
      { formation: '2x4', diameter: 11.8, weight: 0.223 },
      { formation: '2x6', diameter: 13.0, weight: 0.286 },
      { formation: '2x10', diameter: 14.9, weight: 0.405 },
      { formation: '2x16', diameter: 17.1, weight: 0.566 },
      { formation: '2x25', diameter: 20.7, weight: 0.845 },
      { formation: '2x35', diameter: 22.9, weight: 1.090 },
      { formation: '2x50', diameter: 27.2, weight: 1.553 },
      { formation: '2x70', diameter: 29.8, weight: 2.015 },
      { formation: '2x95', diameter: 33.6, weight: 2.613 },
      { formation: '2x120', diameter: 38.3, weight: 3.393 },
      { formation: '2x150', diameter: 42.3, weight: 4.222 },
      // 3x...
      { formation: '3x1.5', diameter: 10.4, weight: 0.156 },
      { formation: '3x2.5', diameter: 11.3, weight: 0.200 },
      { formation: '3x4', diameter: 12.4, weight: 0.259 },
      { formation: '3x6', diameter: 13.7, weight: 0.335 },
      { formation: '3x10', diameter: 15.7, weight: 0.488 },
      { formation: '3x16', diameter: 18.1, weight: 0.692 },
      { formation: '3x25', diameter: 22.0, weight: 1.040 },
      { formation: '3x35', diameter: 24.4, weight: 1.355 },
      { formation: '3x50', diameter: 29.0, weight: 1.934 },
      { formation: '3x70', diameter: 32.0, weight: 2.562 },
      { formation: '3x95', diameter: 36.5, weight: 3.390 },
      { formation: '3x120', diameter: 41.5, weight: 4.362 },
      { formation: '3x150', diameter: 45.3, weight: 5.388 },
      { formation: '3x185', diameter: 51.1, weight: 6.692 },
      { formation: '3x240', diameter: 58.4, weight: 8.700 },
      { formation: '3x300', diameter: 65.8, weight: 10.965 },
      // 4x...
      { formation: '4x1.5', diameter: 11.8, weight: 0.193 },
      { formation: '4x2.5', diameter: 13.0, weight: 0.250 },
      { formation: '4x4', diameter: 14.0, weight: 0.305 },
      { formation: '4x6', diameter: 15.1, weight: 0.402 },
      { formation: '4x10', diameter: 17.7, weight: 0.594 },
      { formation: '4x16', diameter: 19.9, weight: 0.848 },
      { formation: '4x25', diameter: 24.1, weight: 1.275 },
      { formation: '4x35', diameter: 26.6, weight: 1.673 },
      { formation: '4x50', diameter: 32.0, weight: 2.328 },
      { formation: '4x70', diameter: 36.2, weight: 3.292 },
      { formation: '4x95', diameter: 41.1, weight: 4.200 },
      { formation: '4x120', diameter: 46.2, weight: 5.485 },
      { formation: '4x150', diameter: 50.6, weight: 6.592 },
      { formation: '4x185', diameter: 60.4, weight: 8.250 },
      { formation: '4x240', diameter: 65.1, weight: 10.773 },
      // 3x... + ... (ridotto)
      { formation: '3x35+25', diameter: 25.6, weight: 1.563 },
      { formation: '3x50+25', diameter: 29.7, weight: 2.108 },
      { formation: '3x70+35', diameter: 33.9, weight: 2.830 },
      { formation: '3x95+50', diameter: 39.2, weight: 3.805 },
      { formation: '3x120+70', diameter: 43.6, weight: 4.910 },
      { formation: '3x150+95', diameter: 47.8, weight: 6.140 },
      { formation: '3x185+95', diameter: 53.0, weight: 7.370 },
      { formation: '3x240+150', diameter: 62.1, weight: 9.930 },
      { formation: '3x300+150', diameter: 69.5, weight: 12.200 },
      // 5x...
      { formation: '5x1.5', diameter: 12.7, weight: 0.218 },
      { formation: '5x2.5', diameter: 14.0, weight: 0.284 },
      { formation: '5x4', diameter: 15.1, weight: 0.354 },
      { formation: '5x6', diameter: 16.4, weight: 0.470 },
      { formation: '5x10', diameter: 19.3, weight: 0.703 },
      { formation: '5x16', diameter: 21.9, weight: 1.012 },
      { formation: '5x25', diameter: 26.5, weight: 1.530 },
      { formation: '5x35', diameter: 29.5, weight: 2.020 },
      { formation: '5x50', diameter: 36.3, weight: 3.000 },
      { formation: '5x70', diameter: 40.8, weight: 4.150 },
      { formation: '5x95', diameter: 45.6, weight: 5.372 },
      { formation: '5x120', diameter: 51.1, weight: 6.780 },
      { formation: '5x150', diameter: 56.5, weight: 8.642 },
      { formation: '5x185', diameter: 63.6, weight: 10.600 }
    ]
  },
  {
    id: 'fg16oh2r16',
    name: 'FG16OH2R16 0.6/1 kV',
    description: 'Cavo multipolare energia armato in piattina d\'acciaio, isolamento HEPR, CPR Cca-s3,d1,a3.',
    type: 'cavo',
    formations: [
      { formation: '2x1.5', diameter: 11.0, weight: 0.175 },
      { formation: '2x2.5', diameter: 12.0, weight: 0.217 },
      { formation: '2x4', diameter: 13.1, weight: 0.269 },
      { formation: '2x6', diameter: 14.4, weight: 0.342 },
      { formation: '2x10', diameter: 16.7, weight: 0.490 },
      { formation: '2x16', diameter: 18.7, weight: 0.656 },
      { formation: '2x25', diameter: 22.5, weight: 0.956 },
      { formation: '2x35', diameter: 24.9, weight: 1.242 },
      { formation: '3x1.5', diameter: 11.5, weight: 0.193 },
      { formation: '3x2.5', diameter: 12.6, weight: 0.242 },
      { formation: '3x4', diameter: 13.7, weight: 0.306 },
      { formation: '3x6', diameter: 15.1, weight: 0.396 },
      { formation: '3x10', diameter: 17.5, weight: 0.577 },
      { formation: '3x16', diameter: 19.7, weight: 0.786 },
      { formation: '3x25', diameter: 23.7, weight: 1.160 },
      { formation: '4x1.5', diameter: 12.2, weight: 0.220 },
      { formation: '4x2.5', diameter: 13.7, weight: 0.293 },
      { formation: '4x4', diameter: 15.0, weight: 0.373 },
      { formation: '4x6', diameter: 16.4, weight: 0.477 },
      { formation: '4x10', diameter: 19.2, weight: 0.706 },
      { formation: '4x16', diameter: 21.7, weight: 0.975 },
      { formation: '3x35+25', diameter: 24.9, weight: 1.553 },
      { formation: '3x50+25', diameter: 30.1, weight: 2.092 },
      { formation: '3x70+35', diameter: 33.6, weight: 2.806 },
      { formation: '3x95+50', diameter: 38.7, weight: 3.767 },
      { formation: '3x120+70', diameter: 42.8, weight: 4.833 },
      { formation: '3x150+95', diameter: 47.8, weight: 6.080 },
      { formation: '3x185+95', diameter: 53.0, weight: 7.296 },
      { formation: '3x240+150', diameter: 60.2, weight: 9.443 },
      { formation: '3x300+150', diameter: 69.5, weight: 11.996 },
      { formation: '5x1.5', diameter: 12.0, weight: 0.207 },
      { formation: '5x2.5', diameter: 13.2, weight: 0.270 },
      { formation: '5x4', diameter: 14.0, weight: 0.338 },
      { formation: '5x6', diameter: 15.6, weight: 0.450 },
      { formation: '5x10', diameter: 18.1, weight: 0.685 },
      { formation: '5x16', diameter: 21.1, weight: 0.981 },
      { formation: '5x25', diameter: 26.5, weight: 1.513 },
      { formation: '5x35', diameter: 29.5, weight: 2.015 },
      { formation: '5x50', diameter: 36.3, weight: 2.965 },
      { formation: '5x70', diameter: 40.8, weight: 4.022 }
    ]
  },
  {
    id: 'fs18or18',
    name: 'FS18OR18 300/500 V',
    description: 'Cavo multipolare comando/segnalamento isolato in PVC speciale, CPR Cca-s3,d1,a3.',
    type: 'cavo',
    formations: [
      { formation: '2x0.5', diameter: 4.8, weight: 0.033 },
      { formation: '2x0.75', diameter: 5.2, weight: 0.041 },
      { formation: '2x1', diameter: 5.6, weight: 0.048 },
      { formation: '2x1.5', diameter: 6.6, weight: 0.069 },
      { formation: '2x2.5', diameter: 7.8, weight: 0.102 },
      { formation: '3G0.5', diameter: 5.1, weight: 0.039 },
      { formation: '3G0.75', diameter: 5.5, weight: 0.049 },
      { formation: '3G1', diameter: 6.0, weight: 0.058 },
      { formation: '3G1.5', diameter: 7.0, weight: 0.084 },
      { formation: '3G2.5', diameter: 8.5, weight: 0.130 },
      { formation: '4G0.5', diameter: 5.5, weight: 0.047 },
      { formation: '4G0.75', diameter: 6.0, weight: 0.060 },
      { formation: '4G1', diameter: 6.7, weight: 0.073 },
      { formation: '4G1.5', diameter: 7.6, weight: 0.102 },
      { formation: '4G2.5', diameter: 9.2, weight: 0.158 },
      { formation: '5G0.5', diameter: 6.0, weight: 0.058 },
      { formation: '5G0.75', diameter: 6.8, weight: 0.076 },
      { formation: '5G1', diameter: 7.3, weight: 0.089 },
      { formation: '5G1.5', diameter: 8.4, weight: 0.125 },
      { formation: '5G2.5', diameter: 10.3, weight: 0.194 },
      // 7G...
      { formation: '7G0.5', diameter: 6.7, weight: 0.084 },
      { formation: '7G0.75', diameter: 7.3, weight: 0.107 },
      { formation: '7G1', diameter: 8.1, weight: 0.129 },
      { formation: '7G1.5', diameter: 8.7, weight: 0.168 },
      { formation: '7G2.5', diameter: 10.9, weight: 0.271 },
      // 10G...
      { formation: '10G0.5', diameter: 8.6, weight: 0.108 },
      { formation: '10G0.75', diameter: 9.6, weight: 0.143 },
      { formation: '10G1', diameter: 10.4, weight: 0.168 },
      { formation: '10G1.5', diameter: 11.4, weight: 0.224 },
      { formation: '10G2.5', diameter: 14.2, weight: 0.359 },
      // 12G...
      { formation: '12G0.5', diameter: 8.9, weight: 0.126 },
      { formation: '12G0.75', diameter: 9.9, weight: 0.166 },
      { formation: '12G1', diameter: 10.8, weight: 0.195 },
      { formation: '12G1.5', diameter: 11.8, weight: 0.262 },
      { formation: '12G2.5', diameter: 14.7, weight: 0.420 },
      // 14G...
      { formation: '14G0.5', diameter: 9.5, weight: 0.145 },
      { formation: '14G0.75', diameter: 10.4, weight: 0.187 },
      { formation: '14G1', diameter: 11.3, weight: 0.226 },
      { formation: '14G1.5', diameter: 12.6, weight: 0.302 },
      { formation: '14G2.5', diameter: 15.6, weight: 0.484 },
      // 16G...
      { formation: '16G0.5', diameter: 10.1, weight: 0.165 },
      { formation: '16G0.75', diameter: 11.2, weight: 0.216 },
      { formation: '16G1', diameter: 11.9, weight: 0.255 },
      { formation: '16G1.5', diameter: 13.2, weight: 0.340 },
      { formation: '16G2.5', diameter: 16.7, weight: 0.555 },
      // 19G...
      { formation: '19G0.5', diameter: 10.1, weight: 0.182 },
      { formation: '19G0.75', diameter: 11.7, weight: 0.240 },
      { formation: '19G1', diameter: 12.9, weight: 0.288 },
      { formation: '19G1.5', diameter: 14.1, weight: 0.386 },
      { formation: '19G2.5', diameter: 17.5, weight: 0.619 },
      // 24G...
      { formation: '24G0.5', diameter: 12.6, weight: 0.245 },
      { formation: '24G0.75', diameter: 14.3, weight: 0.321 },
      { formation: '24G1', diameter: 15.0, weight: 0.380 },
      { formation: '24G1.5', diameter: 16.8, weight: 0.514 },
      { formation: '24G2.5', diameter: 20.8, weight: 0.819 },
      // 27G...
      { formation: '27G0.5', diameter: 12.9, weight: 0.265 },
      { formation: '27G0.75', diameter: 14.3, weight: 0.349 },
      { formation: '27G1', diameter: 15.6, weight: 0.413 },
      { formation: '27G1.5', diameter: 17.3, weight: 0.560 },
      { formation: '27G2.5', diameter: 21.5, weight: 0.905 }
    ]
  },
  {
    id: 'fte29ohm16',
    name: 'FTE29OHM16',
    description: 'Cavo antincendio schermato LS0H per sistemi di allarme, CPR Cca-s1b,d1,a1.',
    type: 'cavo',
    formations: [
      { formation: '2x0.50', diameter: 6.6, weight: 0.056 },
      { formation: '2x0.75', diameter: 7.0, weight: 0.065 },
      { formation: '2x1', diameter: 7.4, weight: 0.073 },
      { formation: '2x1.5', diameter: 8.4, weight: 0.096 },
      { formation: '2x2.5', diameter: 10.0, weight: 0.137 }
    ]
  },
  {
    id: 'ftg18om16',
    name: 'FTG18OM16 0.6/1 kV',
    description: 'Cavo per energia e segnalazione resistente al fuoco, isolamento in mica/elastomero LS0H, CPR Cca-s1b,d1,a1.',
    type: 'cavo',
    formations: [
      { formation: '7x1.5', diameter: 18.9, weight: 0.463 },
      { formation: '7x2.5', diameter: 20.3, weight: 0.565 },
      { formation: '10x1.5', diameter: 22.9, weight: 0.642 },
      { formation: '10x2.5', diameter: 24.7, weight: 0.793 },
      { formation: '12x1.5', diameter: 22.9, weight: 0.659 },
      { formation: '12x2.5', diameter: 24.7, weight: 0.820 },
      { formation: '14x1.5', diameter: 23.9, weight: 0.737 },
      { formation: '14x2.5', diameter: 25.8, weight: 0.920 },
      { formation: '16x1.5', diameter: 25.7, weight: 0.820 },
      { formation: '16x2.5', diameter: 27.8, weight: 1.028 },
      { formation: '19x1.5', diameter: 26.9, weight: 0.914 },
      { formation: '19x2.5', diameter: 29.1, weight: 1.152 },
      { formation: '24x1.5', diameter: 30.9, weight: 1.230 },
      { formation: '24x2.5', diameter: 33.5, weight: 1.547 },
      { formation: '27x1.5', diameter: 31.4, weight: 1.259 },
      { formation: '27x2.5', diameter: 34.2, weight: 1.601 }
    ]
  },
  {
    id: 'fts29om16',
    name: 'FTS29OM16 Antincendio Evac',
    description: 'Cavo antincendio ed evacuazione vocale (EVAC) resistente al fuoco LS0H, CPR Cca-s1b,d1,a1.',
    type: 'cavo',
    formations: [
      { formation: '2x1', diameter: 8.0, weight: 0.091 },
      { formation: '2x1.5', diameter: 8.6, weight: 0.115 },
      { formation: '2x2.5', diameter: 9.8, weight: 0.150 },
      { formation: '2x4', diameter: 11.0, weight: 0.205 },
      { formation: '2x6', diameter: 12.4, weight: 0.250 }
    ]
  },
  {
    id: 'fg16r16',
    name: 'FG16R16 0.6/1 kV',
    description: 'Cavo unipolare per energia isolato in gomma G16, sotto guaina di PVC R16, CPR Cca-s3,d1,a3.',
    type: 'cavo',
    formations: [
      { formation: '1x1.5', diameter: 6.6, weight: 0.060 },
      { formation: '1x2.5', diameter: 7.0, weight: 0.072 },
      { formation: '1x4', diameter: 7.6, weight: 0.091 },
      { formation: '1x6', diameter: 8.2, weight: 0.113 },
      { formation: '1x10', diameter: 9.1, weight: 0.160 },
      { formation: '1x16', diameter: 10.2, weight: 0.217 },
      { formation: '1x25', diameter: 11.9, weight: 0.311 },
      { formation: '1x35', diameter: 13.0, weight: 0.407 },
      { formation: '1x50', diameter: 15.0, weight: 0.558 },
      { formation: '1x70', diameter: 16.7, weight: 0.756 },
      { formation: '1x95', diameter: 18.6, weight: 0.976 },
      { formation: '1x120', diameter: 20.2, weight: 1.222 },
      { formation: '1x150', diameter: 22.4, weight: 1.521 },
      { formation: '1x185', diameter: 25.0, weight: 1.861 },
      { formation: '1x240', diameter: 28.4, weight: 2.405 },
      { formation: '1x300', diameter: 31.6, weight: 2.990 },
      { formation: '1x400', diameter: 34.4, weight: 3.862 },
      { formation: '1x500', diameter: 39.8, weight: 5.055 },
      { formation: '1x630', diameter: 46.2, weight: 6.418 }
    ]
  },
  {
    id: 'fg16m16',
    name: 'FG16M16 0.6/1 kV',
    description: 'Cavo unipolare per energia isolato in gomma G16 sotto guaina termoplastica M16 LS0H, CPR Cca-s1b,d1,a1.',
    type: 'cavo',
    formations: [
      { formation: '1x6', diameter: 8.8, weight: 0.129 },
      { formation: '1x10', diameter: 9.3, weight: 0.167 },
      { formation: '1x16', diameter: 10.4, weight: 0.228 },
      { formation: '1x25', diameter: 12.1, weight: 0.323 },
      { formation: '1x35', diameter: 13.2, weight: 0.416 },
      { formation: '1x50', diameter: 15.2, weight: 0.573 },
      { formation: '1x70', diameter: 16.5, weight: 0.755 },
      { formation: '1x95', diameter: 18.4, weight: 0.975 },
      { formation: '1x120', diameter: 20.5, weight: 1.237 },
      { formation: '1x150', diameter: 22.4, weight: 1.533 },
      { formation: '1x185', diameter: 25.0, weight: 1.875 },
      { formation: '1x240', diameter: 28.4, weight: 2.420 },
      { formation: '1x300', diameter: 31.6, weight: 3.008 },
      { formation: '1x400', diameter: 34.2, weight: 3.865 },
      { formation: '1x500', diameter: 41.2, weight: 5.080 },
      { formation: '1x630', diameter: 46.2, weight: 6.560 }
    ]
  }
];

export const INITIAL_CONTAINERS: ContainerFamily[] = [
  {
    id: 'canala_met_chiusa',
    name: 'Canale metallico chiuso',
    description: 'Passerella blindata zincata in continuo (Sendzimir) per installazione a vista.',
    type: 'contenitore',
    sectionType: 'rettangolare',
    installationType: 'vista',
    sizes: [
      // H75
      { code: 'R3075Z', label: '75x75', width: 75, height: 75, weight: 1.22, coverWeight: 0.46 },
      { code: 'R3100Z', label: '75x100', width: 100, height: 75, weight: 1.33, coverWeight: 0.55 },
      { code: 'R3150Z', label: '75x150', width: 150, height: 75, weight: 1.60, coverWeight: 0.75 },
      { code: 'R3200Z', label: '75x200', width: 200, height: 75, weight: 2.26, coverWeight: 0.94 },
      { code: 'R3300Z', label: '75x300', width: 300, height: 75, weight: 2.90, coverWeight: 1.60 },
      { code: 'R3400Z', label: '75x400', width: 400, height: 75, weight: 4.10, coverWeight: 2.59 },
      { code: 'R3500Z', label: '75x500', width: 500, height: 75, weight: 4.80, coverWeight: 3.18 },
      { code: 'R3600Z', label: '75x600', width: 600, height: 75, weight: 5.50, coverWeight: 3.77 },
      // H100
      { code: 'R10100Z', label: '100x100', width: 100, height: 100, weight: 1.55, coverWeight: 0.55 },
      { code: 'R10150Z', label: '100x150', width: 150, height: 100, weight: 1.79, coverWeight: 0.75 },
      { code: 'R10200Z', label: '100x200', width: 200, height: 100, weight: 3.03, coverWeight: 0.94 },
      { code: 'R10300Z', label: '100x300', width: 300, height: 100, weight: 3.74, coverWeight: 1.60 },
      { code: 'R10400Z', label: '100x400', width: 400, height: 100, weight: 4.44, coverWeight: 2.59 },
      { code: 'R10500Z', label: '100x500', width: 500, height: 100, weight: 5.15, coverWeight: 3.18 },
      { code: 'R10600Z', label: '100x600', width: 600, height: 100, weight: 5.40, coverWeight: 3.77 }
    ]
  },
  {
    id: 'canala_met_asolata',
    name: 'Canale metallico asolato',
    description: 'Passerella asolata zincata Sendzimir per posa cavi a vista con dissipazione termica.',
    type: 'contenitore',
    sectionType: 'rettangolare',
    installationType: 'vista',
    sizes: [
      // H75
      { code: 'S3075Z', label: '75x75', width: 75, height: 75, weight: 1.08, coverWeight: 0.46 },
      { code: 'S3100Z', label: '75x100', width: 100, height: 75, weight: 1.19, coverWeight: 0.55 },
      { code: 'S3150Z', label: '75x150', width: 150, height: 75, weight: 1.45, coverWeight: 0.75 },
      { code: 'S3200Z', label: '75x200', width: 200, height: 75, weight: 2.05, coverWeight: 0.94 },
      { code: 'S3300Z', label: '75x300', width: 300, height: 75, weight: 2.70, coverWeight: 1.60 },
      { code: 'S3400Z', label: '75x400', width: 400, height: 75, weight: 3.75, coverWeight: 2.59 },
      { code: 'S3500Z', label: '75x500', width: 500, height: 75, weight: 4.30, coverWeight: 3.18 },
      { code: 'S3600Z', label: '75x600', width: 600, height: 75, weight: 4.90, coverWeight: 3.77 },
      // H100
      { code: 'S10100Z', label: '100x100', width: 100, height: 100, weight: 1.40, coverWeight: 0.55 },
      { code: 'S10150Z', label: '100x150', width: 150, height: 100, weight: 1.60, coverWeight: 0.75 },
      { code: 'S10200Z', label: '100x200', width: 200, height: 100, weight: 1.87, coverWeight: 0.94 },
      { code: 'S10300Z', label: '100x300', width: 300, height: 100, weight: 2.67, coverWeight: 1.60 },
      { code: 'S10400Z', label: '100x400', width: 400, height: 100, weight: 4.07, coverWeight: 2.59 },
      { code: 'S10500Z', label: '100x500', width: 500, height: 100, weight: 5.15, coverWeight: 3.18 },
      { code: 'S10600Z', label: '100x600', width: 600, height: 100, weight: 5.40, coverWeight: 3.77 }
    ]
  },
  {
    id: 'passerella_filo',
    name: 'Passerella a filo',
    description: 'Passerella a filo metallica per installazione a vista o sospesa.',
    type: 'contenitore',
    sectionType: 'rettangolare',
    installationType: 'vista',
    sizes: [
      // H54
      { code: 'CF54/50', label: '54x50', width: 50, height: 54, weight: 0.64 },
      { code: 'CF54/100', label: '54x100', width: 100, height: 54, weight: 0.79 },
      { code: 'CF54/150', label: '54x150', width: 150, height: 54, weight: 1.06 },
      { code: 'CF54/200', label: '54x200', width: 200, height: 54, weight: 1.35 },
      { code: 'CF54/300', label: '54x300', width: 300, height: 54, weight: 2.07 },
      { code: 'CF54/400', label: '54x400', width: 400, height: 54, weight: 3.08 },
      { code: 'CF54/450', label: '54x450', width: 450, height: 54, weight: 3.48 },
      { code: 'CF54/500', label: '54x500', width: 500, height: 54, weight: 3.50 },
      { code: 'CF54/600', label: '54x600', width: 600, height: 54, weight: 3.93 },
      // H105
      { code: 'CF105/100', label: '105x100', width: 100, height: 105, weight: 1.32 },
      { code: 'CF105/150', label: '105x150', width: 150, height: 105, weight: 1.69 },
      { code: 'CF105/200', label: '105x200', width: 200, height: 105, weight: 1.99 },
      { code: 'CF105/300', label: '105x300', width: 300, height: 105, weight: 2.96 },
      { code: 'CF105/400', label: '105x400', width: 400, height: 105, weight: 3.37 },
      { code: 'CF105/450', label: '105x450', width: 450, height: 105, weight: 3.60 },
      { code: 'CF105/500', label: '105x500', width: 500, height: 105, weight: 3.78 },
      { code: 'CF105/600', label: '105x600', width: 600, height: 105, weight: 4.19 },
      // H150
      { code: 'CF150/150', label: '150x150', width: 150, height: 150, weight: 2.38 },
      { code: 'CF150/200', label: '150x200', width: 200, height: 150, weight: 3.05 },
      { code: 'CF150/300', label: '150x300', width: 300, height: 150, weight: 3.50 },
      { code: 'CF150/400', label: '150x400', width: 400, height: 150, weight: 3.90 },
      { code: 'CF150/450', label: '150x450', width: 450, height: 150, weight: 4.10 },
      { code: 'CF150/500', label: '150x500', width: 500, height: 150, weight: 4.40 },
      { code: 'CF150/600', label: '150x600', width: 600, height: 150, weight: 4.73 },
      { code: 'CF150/900', label: '150x900', width: 900, height: 150, weight: 7.17 }
    ]
  },
  {
    id: 'canala_pvc',
    name: 'Canale portacavi in PVC',
    description: 'Canale e coperchio in PVC rigido autoestinguente per installazioni a vista industriali e civili.',
    type: 'contenitore',
    sectionType: 'rettangolare',
    installationType: 'vista',
    sizes: [
      { code: 'G16', label: '25x30', width: 25, height: 30, weight: 0.15 },
      { code: 'G23', label: '40x30', width: 40, height: 30, weight: 0.20 },
      { code: 'G24', label: '60x30', width: 60, height: 30, weight: 0.28 },
      { code: 'G8', label: '40x40', width: 40, height: 40, weight: 0.24 },
      { code: 'G4', label: '60x40', width: 60, height: 40, weight: 0.32 },
      { code: 'G26', label: '80x40', width: 80, height: 40, weight: 0.40 },
      { code: 'G27', label: '100x40', width: 100, height: 40, weight: 0.50 },
      { code: 'G28', label: '120x40', width: 120, height: 40, weight: 0.58 },
      { code: 'G9', label: '60x60', width: 60, height: 60, weight: 0.44 },
      { code: 'G6', label: '80x60', width: 80, height: 60, weight: 0.54 },
      { code: 'G17', label: '100x60', width: 100, height: 60, weight: 0.65 },
      { code: 'G10', label: '120x60', width: 120, height: 60, weight: 0.75 },
      { code: 'G30', label: '150x60', width: 150, height: 60, weight: 0.90 },
      { code: 'G31', label: '200x60', width: 200, height: 60, weight: 1.15 },
      { code: 'G12', label: '80x80', width: 80, height: 80, weight: 0.70 },
      { code: 'G19', label: '100x80', width: 100, height: 80, weight: 0.82 },
      { code: 'G32', label: '120x80', width: 120, height: 80, weight: 0.95 },
      { code: 'G33', label: '150x80', width: 150, height: 80, weight: 1.10 },
      { code: 'G48', label: '200x80', width: 200, height: 80, weight: 1.40 },
      { code: 'G37', label: '100x100', width: 100, height: 100, weight: 1.05 },
      { code: 'G40', label: '200x100', width: 200, height: 100, weight: 1.70 },
      { code: 'G50', label: '250x70', width: 250, height: 70, weight: 1.85 }
    ]
  },
  {
    id: 'cavidotto',
    name: 'Cavidotto doppia parete',
    description: 'Tubo corrugato in polietilene ad alta densità (HDPE), esterno corrugato ed interno liscio, per posa interrata.',
    type: 'contenitore',
    sectionType: 'circolare',
    installationType: 'cavidotto',
    sizes: [
      { code: 'CEFD040', label: 'Ø40 (Int. 34)', outerDiameter: 40, innerDiameter: 34, weight: 0.15 },
      { code: 'CEFD050', label: 'Ø50 (Int. 42)', outerDiameter: 50, innerDiameter: 42, weight: 0.18 },
      { code: 'CEFD063', label: 'Ø63 (Int. 52)', outerDiameter: 63, innerDiameter: 52, weight: 0.25 },
      { code: 'CEFD075', label: 'Ø75 (Int. 63)', outerDiameter: 75, innerDiameter: 63, weight: 0.32 },
      { code: 'CEFD090', label: 'Ø90 (Int. 77)', outerDiameter: 90, innerDiameter: 77, weight: 0.42 },
      { code: 'CEFD110', label: 'Ø110 (Int. 93)', outerDiameter: 110, innerDiameter: 93, weight: 0.58 },
      { code: 'CEFD125', label: 'Ø125 (Int. 107)', outerDiameter: 125, innerDiameter: 107, weight: 0.70 },
      { code: 'CEFD160', label: 'Ø160 (Int. 142)', outerDiameter: 160, innerDiameter: 142, weight: 1.05 },
      { code: 'CEFD200', label: 'Ø200 (Int. 180)', outerDiameter: 200, innerDiameter: 180, weight: 1.50 }
    ]
  },
  {
    id: 'taz',
    name: 'Tubo rigido in acciaio zincato TAZ',
    description: 'Tubo rigido in acciaio zincato a caldo per calate verticali e passaggi esposti ad alto impatto meccanico (Bticino).',
    type: 'contenitore',
    sectionType: 'circolare',
    installationType: 'tazze',
    sizes: [
      { code: 'TAZ-16N', label: 'TAZ 16 (Int. 14)', outerDiameter: 16, innerDiameter: 14, weight: 0.37 },
      { code: 'TAZ-20', label: 'TAZ 20 (Int. 18)', outerDiameter: 20, innerDiameter: 18, weight: 0.47 },
      { code: 'TAZ-25', label: 'TAZ 25 (Int. 23)', outerDiameter: 25, innerDiameter: 23, weight: 0.59 },
      { code: 'TAZ-32N', label: 'TAZ 32 (Int. 29.6)', outerDiameter: 32, innerDiameter: 29.6, weight: 0.91 },
      { code: 'TAZ-40', label: 'TAZ 40 (Int. 37.6)', outerDiameter: 40, innerDiameter: 37.6, weight: 1.15 },
      { code: 'TAZ-50', label: 'TAZ 50 (Int. 47.6)', outerDiameter: 50, innerDiameter: 47.6, weight: 1.44 },
      { code: 'TAZ-63N', label: 'TAZ 63 (Int. 60)', outerDiameter: 63, innerDiameter: 60, weight: 2.28 }
    ]
  },
  {
    id: 'tubo_flessibile',
    name: 'Tubo pieghevole corrugato PVC',
    description: 'Tubo corrugato flessibile in PVC per posa sotto traccia o a vista in ambito civile e industriale.',
    type: 'contenitore',
    sectionType: 'circolare',
    installationType: 'tazze',
    sizes: [
      { code: 'ECTC1520', label: 'Ø20 (Int. 14.1)', outerDiameter: 20, innerDiameter: 14.1, weight: 0.08 },
      { code: 'ECTC1525', label: 'Ø25 (Int. 18.2)', outerDiameter: 25, innerDiameter: 18.2, weight: 0.10 },
      { code: 'ECTC1532', label: 'Ø32 (Int. 24.2)', outerDiameter: 32, innerDiameter: 24.2, weight: 0.15 },
      { code: 'ECTC1540', label: 'Ø40 (Int. 31.5)', outerDiameter: 40, innerDiameter: 31.5, weight: 0.203 }
    ]
  }
];
