import { describe, it, expect } from 'vitest';
import { isIndustrialByCode, isIndustrialByDescription, checkIndustrial } from '../cnpjaClient.ts';

describe('isIndustrialByCode', () => {
  it('should detect manufacturing CNAE divisions (10-33)', () => {
    expect(isIndustrialByCode('1011201')).toBe(true);  // div 10 - alimentos
    expect(isIndustrialByCode('2822401')).toBe(true);  // div 28 - maquinas
    expect(isIndustrialByCode('3311200')).toBe(true);  // div 33 - reparacao
    expect(isIndustrialByCode('2599399')).toBe(true);  // div 25 - metalurgia
  });

  it('should detect extractive CNAE divisions (05-09)', () => {
    expect(isIndustrialByCode('0710301')).toBe(true);  // div 07 - mineracao
    expect(isIndustrialByCode('0500301')).toBe(true);  // div 05 - carvao
  });

  it('should handle formatted CNAE codes', () => {
    expect(isIndustrialByCode('28.22-4-01')).toBe(true);
    expect(isIndustrialByCode('10.11-2/01')).toBe(true);
  });

  it('should reject non-industrial CNAE divisions', () => {
    expect(isIndustrialByCode('4711301')).toBe(false); // div 47 - comercio varejista
    expect(isIndustrialByCode('6203100')).toBe(false); // div 62 - TI
    expect(isIndustrialByCode('3512300')).toBe(false); // div 35 - eletricidade
  });
});

describe('isIndustrialByDescription', () => {
  it('should match fabricacao keywords', () => {
    expect(isIndustrialByDescription('Fabricação de máquinas e equipamentos')).toBe(true);
    expect(isIndustrialByDescription('fabricacao de produtos metalicos')).toBe(true);
  });

  it('should match industria/industrial keywords', () => {
    expect(isIndustrialByDescription('Indústria química')).toBe(true);
    expect(isIndustrialByDescription('Atividades industriais diversas')).toBe(true);
  });

  it('should match metalurgia/siderurgia', () => {
    expect(isIndustrialByDescription('Metalurgia do aço')).toBe(true);
    expect(isIndustrialByDescription('Siderúrgica especial')).toBe(true);
  });

  it('should match other industrial keywords', () => {
    expect(isIndustrialByDescription('Usinagem de peças')).toBe(true);
    expect(isIndustrialByDescription('Laminação de chapas')).toBe(true);
    expect(isIndustrialByDescription('Beneficiamento de arroz')).toBe(true);
    expect(isIndustrialByDescription('Produção de alimentos')).toBe(true);
  });

  it('should not match non-industrial descriptions', () => {
    expect(isIndustrialByDescription('Comércio varejista de produtos')).toBe(false);
    expect(isIndustrialByDescription('Consultoria em TI')).toBe(false);
    expect(isIndustrialByDescription('Transporte rodoviário de cargas')).toBe(false);
  });
});

describe('checkIndustrial (primary CNAE only)', () => {
  it('should return true if primary CNAE code is industrial', () => {
    expect(checkIndustrial('2822401', 'Maquinas')).toBe(true);
  });

  it('should return true if primary description matches industrial keywords', () => {
    expect(checkIndustrial('4711301', 'Fabricação de pecas metalicas')).toBe(true);
  });

  it('should return false if primary code and description are non-industrial', () => {
    expect(checkIndustrial('4711301', 'Comercio varejista')).toBe(false);
  });

  it('should not flag comércio atacadista (CNAE 46) as industrial', () => {
    expect(checkIndustrial('4665600', 'Comércio atacadista de máquinas e equipamentos')).toBe(false);
  });

  it('should not flag serviços (CNAE 82) as industrial', () => {
    expect(checkIndustrial('8211300', 'Serviços combinados de escritório e apoio administrativo')).toBe(false);
  });
});
