import type { NfeValidation } from '../types/validation.ts';
import type { AppConfig } from '../types/config.ts';
import type { CenarioConfig } from '../types/cenario.ts';
import { bcIntegral } from '../utils/formatters.ts';
import { isCobreAco } from '../data/cobreAco.ts';
import { isItemCAMEX, isDestinatarioCamex210 } from '../engine/camex210.ts';

export interface AliquotaGroup {
  label: string;
  itens: number;
  totalBC: number;
  totalICMSDestacado: number;
  cargaPct: number;
  icmsRecolher: number;
  fundos: number;
  total: number;
}

interface AccGroup {
  itens: number;
  bc: number;
  icms: number;
  recolher: number;
  fundos: number;
  carga: number;
}

function resolverGrupoECarga(params: {
  pICMS: number;
  isCamex: boolean;
  isAcoCobre: boolean;
  aplicaCamex210: boolean;
}): { groupKey: string; carga: number } {
  const { pICMS, isCamex, isAcoCobre, aplicaCamex210 } = params;

  if (aplicaCamex210) {
    const aliquotaLabel = Math.abs(pICMS - 12) < 0.01 ? '12%' : `${pICMS}%`;
    return { groupKey: `${aliquotaLabel} CAMEX (2,1%)`, carga: 2.1 };
  }

  if (Math.abs(pICMS - 4) < 0.01) {
    if (isAcoCobre) return { groupKey: '4% Aço/Cobre', carga: 0.6 };
    return { groupKey: '4%', carga: 1.0 };
  }
  if (Math.abs(pICMS - 10) < 0.01) return { groupKey: '10%', carga: 3.6 };
  if (Math.abs(pICMS - 12) < 0.01) return { groupKey: isCamex ? '12% CAMEX' : '12%', carga: 3.6 };
  if (Math.abs(pICMS - 17) < 0.01) return { groupKey: '17%', carga: 3.6 };
  if (Math.abs(pICMS - 7) < 0.01) return { groupKey: '7%', carga: 3.6 };
  if (Math.abs(pICMS - 25) < 0.01) return { groupKey: '25%', carga: 3.6 };
  if (pICMS === 0) return { groupKey: '0% (Diferimento/Transf.)', carga: 0 };
  return { groupKey: `${pICMS}%`, carga: 3.6 };
}

export function buildDashboardGroups(
  results: NfeValidation[],
  config: AppConfig,
  cenariosMap: Record<string, CenarioConfig>,
): {
  groups: AliquotaGroup[];
  grandTotal: { icmsRecolher: number; fundos: number; total: number };
} {
  const acc: Record<string, AccGroup> = {};

  for (const nv of results) {
    const destinatarioCamex210 = isDestinatarioCamex210(nv.nfe.dest.cnpj, config);

    for (const iv of nv.itensValidados) {
      const pICMS = iv.item.pICMS;
      const cenarioConfig = cenariosMap[iv.cenario];
      const isCamex = isItemCAMEX(iv.item, config, cenarioConfig);
      const isAcoCobre = Math.abs(pICMS - 4) < 0.01 && isCobreAco(iv.item.ncm, config.listaCobreAco);
      const fundosPct = cenarioConfig?.fundos ?? 0;
      const bc = bcIntegral(iv.item.vBC, iv.item.pRedBC);
      const fundosVal = fundosPct > 0 ? bc * (fundosPct / 100) : 0;
      const aplicaCamex210 = isCamex && pICMS >= 7 && destinatarioCamex210;
      const { groupKey, carga } = resolverGrupoECarga({ pICMS, isCamex, isAcoCobre, aplicaCamex210 });
      const recolher = carga > 0 ? bc * (carga / 100) : 0;

      if (!acc[groupKey]) acc[groupKey] = { itens: 0, bc: 0, icms: 0, recolher: 0, fundos: 0, carga };
      acc[groupKey].itens++;
      acc[groupKey].bc += bc;
      acc[groupKey].icms += iv.item.vICMS;
      acc[groupKey].recolher += recolher;
      acc[groupKey].fundos += fundosVal;
    }
  }

  const sortOrder = [
    '4% Aço/Cobre',
    '4%',
    '7% CAMEX (2,1%)',
    '7%',
    '10%',
    '12% CAMEX (2,1%)',
    '12% CAMEX',
    '12%',
    '17%',
    '25%',
  ];

  const groups = Object.entries(acc)
    .sort(([a], [b]) => {
      const ia = sortOrder.indexOf(a);
      const ib = sortOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    })
    .map(([label, v]) => ({
      label,
      itens: v.itens,
      totalBC: v.bc,
      totalICMSDestacado: v.icms,
      cargaPct: v.carga,
      icmsRecolher: v.recolher,
      fundos: v.fundos,
      total: v.recolher + v.fundos,
    }));

  const grandTotal = {
    icmsRecolher: groups.reduce((s, g) => s + g.icmsRecolher, 0),
    fundos: groups.reduce((s, g) => s + g.fundos, 0),
    total: groups.reduce((s, g) => s + g.total, 0),
  };

  return { groups, grandTotal };
}
