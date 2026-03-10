export interface CompanyLookupEntry {
  cnpj: string;
  razaoSocial: string;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatCnpj(cnpj: string): string {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function buildCompanySuggestionLabel(option: CompanyLookupEntry): string {
  return `${option.razaoSocial} (${formatCnpj(option.cnpj)})`;
}

export function findExactCompanyByRazao(
  options: CompanyLookupEntry[],
  razaoInput: string,
): CompanyLookupEntry | undefined {
  const normalizedRawInput = razaoInput.trim();
  const normalizedInput = normalizeText(normalizedRawInput);
  if (!normalizedInput) return undefined;

  const cnpjFromInput = onlyDigits(razaoInput);
  if (cnpjFromInput.length === 14) {
    return options.find(option => onlyDigits(option.cnpj) === cnpjFromInput);
  }

  const exactLabelMatch = options.find(
    option => normalizeText(buildCompanySuggestionLabel(option)) === normalizedInput,
  );
  if (exactLabelMatch) return exactLabelMatch;

  const exactRazaoMatches = options.filter(
    option => normalizeText(option.razaoSocial) === normalizedInput,
  );

  // Avoid selecting the wrong company when multiple branches share the same razao social.
  if (exactRazaoMatches.length === 1) return exactRazaoMatches[0];
  return undefined;
}

export function getRazaoSuggestions(
  options: CompanyLookupEntry[],
  razaoInput: string,
  limit = 30,
): CompanyLookupEntry[] {
  const normalizedInput = normalizeText(razaoInput);
  if (!normalizedInput) return options.slice(0, limit);

  const startsWithMatches: CompanyLookupEntry[] = [];
  const includesMatches: CompanyLookupEntry[] = [];
  const cnpjMatches: CompanyLookupEntry[] = [];
  const inputDigits = onlyDigits(razaoInput);

  for (const option of options) {
    const normalizedRazao = normalizeText(option.razaoSocial);
    const optionDigits = onlyDigits(option.cnpj);
    if (normalizedRazao.startsWith(normalizedInput)) {
      startsWithMatches.push(option);
    } else if (normalizedRazao.includes(normalizedInput)) {
      includesMatches.push(option);
    } else if (inputDigits.length > 0 && optionDigits.includes(inputDigits)) {
      cnpjMatches.push(option);
    }
  }
  return [...startsWithMatches, ...includesMatches, ...cnpjMatches].slice(0, limit);
}
