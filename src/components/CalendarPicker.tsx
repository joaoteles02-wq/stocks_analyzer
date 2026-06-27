import { useRef } from 'react';

interface CalendarPickerProps {
  value: string; // ISO YYYY-MM-DD
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

  return (
    <div className="relative" style={{ width: 260 }}>
      <div className="circle absolute" style={{ width: 100, height: 100, borderRadius: '50%', background: 'linear-gradient(to right, #833ab4, #fd1d1d, #fcb045)', left: 170, top: -30 }} />

      <div
        onClick={() => inputRef.current?.showPicker()}
        className="flex flex-col items-center cursor-pointer select-none"
        style={{
          background: 'rgba(255,255,255,0.1)',
          border: '2px solid rgba(255,255,255,0.1)',
          boxShadow: '30px 30px 40px rgba(0,0,0,0.2)',
          borderRadius: 60,
          backdropFilter: 'blur(10px)',
          padding: '20px 30px',
        }}
      >
        <div className="flex items-center justify-between w-full mb-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); changeDay(-1); }}
            className="text-white/60 hover:text-white transition-colors text-lg leading-none px-1"
          >
            ◀
          </button>
          <span className="text-white/80 text-sm font-bold uppercase tracking-wider px-2">{monthName}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); changeDay(1); }}
            className="text-white/60 hover:text-white transition-colors text-lg leading-none px-1"
          >
            ▶
          </button>
        </div>

        <span className="text-white/50 text-xs font-medium mt-1">{dayName}</span>
        <span className="text-white text-5xl font-black my-1 leading-tight">{dayNum}</span>
        <span className="text-white/50 text-xs font-medium">{year}</span>

        <span className="text-white/30 text-[10px] mt-2 border-t border-white/10 pt-2 w-full text-center">
          Clique para alterar
        </span>
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
