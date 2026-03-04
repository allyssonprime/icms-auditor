import { useState } from 'react';
import type { AppConfig } from '../types/config.ts';

interface ConfigPanelProps {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
  onClose: () => void;
}

function listToText(list: string[]): string {
  return list.join('\n');
}

function textToList(text: string): string[] {
  return text
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function textToNcmList(text: string): string[] {
  return text
    .split('\n')
    .map(s => s.replace(/\D/g, ''))
    .filter(s => s.length >= 4);
}

function textToNcmListShort(text: string): string[] {
  return text
    .split('\n')
    .map(s => s.replace(/\D/g, ''))
    .filter(s => s.length >= 2);
}

function ncmListToText(list: string[]): string {
  return list
    .map(ncm => {
      const d = ncm.replace(/\D/g, '');
      if (d.length === 8) return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
      if (d.length === 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
      return d;
    })
    .join('\n');
}

export function ConfigPanel({ config, onSave, onClose }: ConfigPanelProps) {
  const [decreto2128, setDecreto2128] = useState(ncmListToText(config.decreto2128));
  const [listaSN, setListaSN] = useState(listToText(config.listaSN));
  const [listaCamex, setListaCamex] = useState(ncmListToText(config.listaCamex));
  const [listaIndustriais, setListaIndustriais] = useState(listToText(config.listaIndustriais));
  const [listaCD, setListaCD] = useState(listToText(config.listaCD));
  const [listaVedacao25a, setListaVedacao25a] = useState(listToText(config.listaVedacao25a));
  const [listaVedacao25b, setListaVedacao25b] = useState(listToText(config.listaVedacao25b));
  const [listaCobreAco, setListaCobreAco] = useState(ncmListToText(config.listaCobreAco));

  const handleSave = () => {
    onSave({
      ...config,
      decreto2128: textToNcmList(decreto2128),
      listaSN: textToList(listaSN),
      listaCamex: textToNcmList(listaCamex),
      listaIndustriais: textToList(listaIndustriais),
      listaCD: textToList(listaCD),
      listaVedacao25a: textToList(listaVedacao25a),
      listaVedacao25b: textToList(listaVedacao25b),
      listaCobreAco: textToNcmListShort(listaCobreAco),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex justify-end">
      <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Configuracao</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            &times;
          </button>
        </div>

        <div className="p-4 space-y-5">
          <ConfigTextarea
            label="Decreto 2.128/SC — NCMs vedadas (4, 6 ou 8 digitos — um por linha)"
            value={decreto2128}
            onChange={setDecreto2128}
            placeholder="7005&#10;2207.10&#10;2710.12.30"
            hint={`${textToNcmList(decreto2128).length} NCMs cadastradas. Aceita prefixos (4 ou 6 digitos) ou NCM completa (8 digitos).`}
          />
          <ConfigTextarea
            label="Lista CAMEX (NCMs sem similar — um por linha)"
            value={listaCamex}
            onChange={setListaCamex}
            placeholder="84713019&#10;85176239"
          />
          <ConfigTextarea
            label="Aço/Cobre — NCMs (prefixos 2+ dígitos, um por linha)"
            value={listaCobreAco}
            onChange={setListaCobreAco}
            placeholder="72&#10;73&#10;74&#10;7106"
            hint={`${textToNcmListShort(listaCobreAco).length} prefixos cadastrados. 4% + aço/cobre = 0,6% recolhimento.`}
            label="Aco/Cobre — NCMs (prefixos 2+ digitos, um por linha)"
            value={listaCobreAco}
            onChange={setListaCobreAco}
            placeholder="72&#10;73&#10;74&#10;7106"
            hint={`${textToNcmListShort(listaCobreAco).length} prefixos cadastrados. Aceita prefixos curtos (2 digitos) ou NCM completa.`}
          />
          <ConfigTextarea
            label="Simples Nacional (CNPJs — um por linha)"
            value={listaSN}
            onChange={setListaSN}
            placeholder="12345678000199"
          />
          <ConfigTextarea
            label="Industriais — Opcao 10% (CNPJs)"
            value={listaIndustriais}
            onChange={setListaIndustriais}
            placeholder="12345678000199"
          />
          <ConfigTextarea
            label="CD Exclusivo (CNPJs)"
            value={listaCD}
            onChange={setListaCD}
            placeholder="12345678000199"
          />
          <ConfigTextarea
            label="Vedacao 2.5.a — TTD/Diferimento (CNPJs)"
            value={listaVedacao25a}
            onChange={setListaVedacao25a}
            placeholder="12345678000199"
          />
          <ConfigTextarea
            label="Vedacao 2.5.b — Textil/Confeccoes (CNPJs)"
            value={listaVedacao25b}
            onChange={setListaVedacao25b}
            placeholder="12345678000199"
          />
        </div>

        <div className="p-4 border-t flex gap-3">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            Salvar
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfigTextarea({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full border border-gray-300 rounded-lg p-2 text-sm font-mono focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
      />
      {hint && (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
}
