import { describe, expect, it } from 'vitest';
import { buildCompanySuggestionLabel, findExactCompanyByRazao, getRazaoSuggestions, type CompanyLookupEntry } from '../companyLookup.ts';

const options: CompanyLookupEntry[] = [
  { cnpj: '11111111000111', razaoSocial: 'Acucar e Acai LTDA' },
  { cnpj: '22222222000122', razaoSocial: 'Metalurgica Silva S/A' },
  { cnpj: '99999999000199', razaoSocial: 'Metalurgica Silva S/A' },
  { cnpj: '44444444000144', razaoSocial: 'Atacado Comercio Catarinense' },
  { cnpj: '33333333000133', razaoSocial: 'Comercio Geral do Sul' },
];

describe('companyLookup', () => {
  it('finds exact razao social ignoring case and accents', () => {
    expect(findExactCompanyByRazao(options, 'AÇÚCAR E AÇAÍ LTDA')?.cnpj).toBe('11111111000111');
  });

  it('returns starts-with suggestions before includes matches', () => {
    const result = getRazaoSuggestions(options, 'co');
    expect(result.map(r => r.cnpj)).toEqual(['33333333000133', '44444444000144']);
  });

  it('does not auto-match ambiguous razao social without CNPJ', () => {
    expect(findExactCompanyByRazao(options, 'Metalurgica Silva S/A')).toBeUndefined();
  });

  it('matches an exact suggestion label containing CNPJ', () => {
    const option = options.find(o => o.cnpj === '99999999000199');
    expect(option).toBeDefined();

    const label = buildCompanySuggestionLabel(option!);
    expect(findExactCompanyByRazao(options, label)?.cnpj).toBe('99999999000199');
  });
});
