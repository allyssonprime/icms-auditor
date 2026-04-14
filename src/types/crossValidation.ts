export type MatchStatus = 'matched' | 'only_xml' | 'only_efd' | 'value_divergent';

export interface NfCrossMatch {
  numDoc: string;
  serie: string;
  chaveAcesso?: string;
  matchStatus: MatchStatus;
  // XML values (undefined if only_efd)
  xmlVlBcIcms?: number;
  xmlVlIcms?: number;
  xmlCancelada?: boolean;
  xmlHasTtd?: boolean;
  xmlEstornada?: boolean;
  // EFD values (undefined if only_xml)
  efdVlBcIcms?: number;
  efdVlIcms?: number;
  efdCancelado?: boolean;
  efdHasTtd?: boolean;
  efdEstornada?: boolean;
  // Divergence details
  diffBcIcms?: number;
  diffIcms?: number;
  flagDivergences: string[];
}

export interface CrossValidationResult {
  competencia: string;
  totalXml: number;
  totalEfd: number;
  matched: number;
  onlyXml: number;
  onlyEfd: number;
  valueDivergent: number;
  matches: NfCrossMatch[];
  xmlTotalDebitos: number;
  efdTotalDebitos: number;
  diffTotalDebitos: number;
  isConsistent: boolean;
}
