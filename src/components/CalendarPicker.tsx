import { useRef } from 'react';

interface CalendarPickerProps {
  value: string;
  onChange: (ddmmyyyy: string, iso: string) => void;
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export function CalendarPicker({ value, onChange }: CalendarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const date = value ? new Date(value + 'T12:00:00') : new Date();

  const dayName = DAYS[date.getDay()];
  const dayNum = String(date.getDate()).padStart(2, '0');
  const monthName = MONTHS[date.getMonth()];
  const year = date.getFullYear();

  const changeDay = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    const iso = d.toISOString().split('T')[0];
    const parts = iso.split('-');
    onChange(`${parts[2]}/${parts[1]}/${parts[0]}`, iso);
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value;
    if (!iso) return;
    const parts = iso.split('-');
    onChange(`${parts[2]}/${parts[1]}/${parts[0]}`, iso);
  };

  const handleOpenPicker = () => {
    if (inputRef.current) {
      if (typeof inputRef.current.showPicker === 'function') {
        inputRef.current.showPicker();
      } else {
        inputRef.current.focus();
      }
    }
  };

  return (
    <div className="relative w-full max-w-[220px]">
      <div
        className="absolute pointer-events-none"
        style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(to right, #833ab4, #fd1d1d, #fcb045)', right: -10, top: -20, opacity: 0.6 }}
      />

      <div
        onClick={handleOpenPicker}
        onTouchStart={handleOpenPicker}
        className="flex flex-col items-center cursor-pointer select-none w-full"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
          borderRadius: 40,
          backdropFilter: 'blur(10px)',
          padding: '10px 12px',
        }}
      >
        <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-0.5">{monthName}</span>
        <span className="text-white/45 text-[9px] font-medium leading-none">{dayName}</span>
        <span className="text-white text-3xl font-black my-0.5 leading-tight">{dayNum}</span>
        <span className="text-white/45 text-[9px] font-medium leading-none">{year}</span>
      </div>

      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={handleNativeChange}
        className="hidden"
      />
    </div>
  );
}
