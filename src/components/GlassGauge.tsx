import React from 'react';

interface GlassGaugeProps {
  value: number;
  displayValue?: string;
  title?: string;
  subtitle?: string;
  color?: string;
  size?: 'sm' | 'md';
  noTitle?: boolean;
}

export const GlassGauge: React.FC<GlassGaugeProps> = ({
  value,
  displayValue,
  title = 'Sinal',
  subtitle,
  color = '#00d2ff',
  size = 'md',
  noTitle,
}) => {
  const clampedValue = Math.max(0, Math.min(100, value));
  const isSmall = size === 'sm';
  const padding = isSmall ? 'p-2' : 'p-5';
  const gaugeSize = isSmall ? 'w-[80px] h-[80px]' : 'w-[140px] h-[140px]';
  const svgView = isSmall ? '64 64' : '120 120';
  const svgCenter = isSmall ? 32 : 60;
  const circleRadius = isSmall ? 24 : 46;
  const strokeW = isSmall ? 5 : 7;
  const valFontSize = isSmall ? 'text-sm' : 'text-[26px]';
  const subtitleSize = isSmall ? 'text-[9px]' : 'text-xs';

  const circleCirc = 2 * Math.PI * circleRadius;
  const circleOffset = circleCirc - (clampedValue / 100) * circleCirc;

  return (
    <div className={`relative w-full ${padding} rounded-2xl flex flex-col items-center bg-white/10 border border-white/10 shadow-lg overflow-hidden ${noTitle ? '' : ''}`}>
      <div
        className="absolute bottom-[-20%] left-1/2 -translate-x-1/2 w-[100px] h-[100px] rounded-full pointer-events-none z-0"
        style={{
          background: `radial-gradient(circle, ${color}30 0%, rgba(0,0,0,0) 70%)`,
        }}
      />

      {!noTitle && (
        <div className={`relative z-[1] w-full flex justify-between items-center ${isSmall ? 'mb-1' : 'mb-2'}`}>
          <span className="text-white/80 text-sm font-semibold">
            {title}
          </span>
        </div>
      )}

      <div className={`relative z-[1] ${gaugeSize} flex justify-center items-center`}>
        <svg
          viewBox={svgView}
          className="w-full h-full"
          style={{ transform: 'rotate(-90deg)' }}
        >
          <circle
            cx={svgCenter}
            cy={svgCenter}
            r={circleRadius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeW}
          />
          <circle
            cx={svgCenter}
            cy={svgCenter}
            r={circleRadius}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={circleCirc}
            strokeDashoffset={circleOffset}
            style={{
              transition: 'stroke-dashoffset 0.5s ease-in-out',
              filter: `drop-shadow(0px 0px 6px ${color})`,
            }}
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`text-white ${valFontSize} font-bold leading-none`}
            style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}
          >
            {displayValue ?? `${clampedValue}%`}
          </span>
        </div>
      </div>

      {subtitle && (
        <div className={`relative z-[1] mt-1 text-white/50 ${subtitleSize} font-normal text-center leading-tight`}>
          {subtitle}
        </div>
      )}
    </div>
  );
};
