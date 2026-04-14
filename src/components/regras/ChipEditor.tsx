import { useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface ChipEditorProps {
  values: (string | number)[];
  onChange: (values: (string | number)[]) => void;
  type?: 'string' | 'number';
  placeholder?: string;
  label?: string;
}

export function ChipEditor({ values, onChange, type = 'string', placeholder, label }: ChipEditorProps) {
  const [inputValue, setInputValue] = useState('');

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const val = type === 'number' ? parseFloat(inputValue.trim()) : inputValue.trim();
      if (type === 'number' && isNaN(val as number)) return;
      if (!values.includes(val)) {
        onChange([...values, val]);
      }
      setInputValue('');
    }
    if (e.key === 'Backspace' && !inputValue && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  function handleRemove(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs font-medium text-muted-foreground">{label}</label>}
      <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg bg-background min-h-[38px] items-center">
        {values.map((val, i) => (
          <Badge key={`${val}-${i}`} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-xs">
            {String(val)}
            <button
              type="button"
              onClick={() => handleRemove(i)}
              className="hover:bg-muted rounded-sm p-0.5 cursor-pointer"
            >
              <X size={12} />
            </button>
          </Badge>
        ))}
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={values.length === 0 ? placeholder : ''}
          className="border-0 shadow-none p-0 h-6 min-w-[80px] flex-1 focus-visible:ring-0 text-xs"
          type={type === 'number' ? 'number' : 'text'}
          step={type === 'number' ? 'any' : undefined}
        />
      </div>
    </div>
  );
}
