import { useState, useEffect, useCallback } from 'react';
import type { RegrasConfig, GrupoRegra, VedacaoRule, RegrasGlobal } from '../types/regras.ts';
import { getDefaultRegras } from '../data/defaultRegras.ts';
import {
  getRegrasFromFirestore,
  salvarGrupos,
  salvarVedacoes,
  salvarConfigGlobal,
  exportRegrasJSON,
  importRegrasJSON,
} from '../firebase/regrasService.ts';

export function useRegras() {
  const [regras, setRegras] = useState<RegrasConfig>(getDefaultRegras);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const fromFirestore = await getRegrasFromFirestore();
      if (fromFirestore) {
        setRegras(fromFirestore);
      }
      setIsLoading(false);
    })();
  }, []);

  const updateGrupos = useCallback(async (grupos: GrupoRegra[]) => {
    await salvarGrupos(grupos);
    setRegras(prev => ({ ...prev, grupos }));
  }, []);

  const updateVedacoes = useCallback(async (vedacoes: VedacaoRule[]) => {
    await salvarVedacoes(vedacoes);
    setRegras(prev => ({ ...prev, vedacoes }));
  }, []);

  const updateGlobal = useCallback(async (global: RegrasGlobal) => {
    await salvarConfigGlobal(global);
    setRegras(prev => ({ ...prev, global }));
  }, []);

  const exportJSON = useCallback(() => {
    return exportRegrasJSON(regras);
  }, [regras]);

  const importJSON = useCallback(async (json: string): Promise<RegrasConfig> => {
    const imported = importRegrasJSON(json);
    await Promise.all([
      salvarGrupos(imported.grupos),
      salvarVedacoes(imported.vedacoes),
      salvarConfigGlobal(imported.global),
    ]);
    setRegras(imported);
    return imported;
  }, []);

  const restaurarPadrao = useCallback(async () => {
    const defaults = getDefaultRegras();
    await Promise.all([
      salvarGrupos(defaults.grupos),
      salvarVedacoes(defaults.vedacoes),
      salvarConfigGlobal(defaults.global),
    ]);
    setRegras(defaults);
  }, []);

  return {
    regras,
    isLoading,
    updateGrupos,
    updateVedacoes,
    updateGlobal,
    exportJSON,
    importJSON,
    restaurarPadrao,
  };
}
