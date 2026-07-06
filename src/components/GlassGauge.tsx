import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';

interface GlassGaugeProps {
  value: number;
  displayValue?: string;
  title?: string;
  subtitle?: string;
  color?: string;
  size?: 'sm' | 'md';
  noTitle?: boolean;
}

const fillProgress = (offsetFinal: number) => keyframes`
  from {
    stroke-dashoffset: 314.16; /* Circunferencia total (vazio) */
  }
  to {
    stroke-dashoffset: ${offsetFinal}; /* Posicao do valor final */
  }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
`;

const GlassCard = styled.div<{ $isSmall: boolean; $noTitle?: boolean }>`
  position: relative;
  width: ${props => props.$isSmall ? '100%' : '240px'};
  padding: ${props => props.$isSmall ? '8px' : '24px'};
  border-radius: ${props => props.$isSmall ? '16px' : '28px'};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(15, 32, 67, 0.45); 
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.2);
  animation: ${fadeIn} 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
`;

const GlowEffect = styled.div<{ $color: string }>`
  position: absolute;
  bottom: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 140px;
  height: 140px;
  background: radial-gradient(circle, ${props => props.$color}4d 0%, rgba(0, 0, 0, 0) 70%);
  border-radius: 50%;
  pointer-events: none;
`;

const Header = styled.div<{ $isSmall: boolean }>`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${props => props.$isSmall ? '4px' : '20px'};
`;

const Title = styled.span<{ $isSmall: boolean }>`
  color: rgba(255, 255, 255, 0.95);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: ${props => props.$isSmall ? '12px' : '16px'};
  font-weight: 600;
  text-align: center;
`;

const Dots = styled.span`
  color: rgba(255, 255, 255, 0.5);
  font-weight: bold;
`;

const GaugeContainer = styled.div<{ $isSmall: boolean }>`
  position: relative;
  width: ${props => props.$isSmall ? '84px' : '160px'};
  height: ${props => props.$isSmall ? '84px' : '160px'};
  display: flex;
  justify-content: center;
  align-items: center;
`;

const SvgGauge = styled.svg`
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
`;

const CircleBackground = styled.circle<{ $isSmall: boolean }>`
  fill: none;
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: ${props => props.$isSmall ? '6' : '8'};
`;

const CircleProgress = styled.circle<{ $offsetFinal: number; $color: string; $isSmall: boolean }>`
  fill: none;
  stroke: ${props => props.$color};
  stroke-width: ${props => props.$isSmall ? '6' : '8'};
  stroke-linecap: round;
  filter: drop-shadow(0px 0px 8px ${props => props.$color}e6);
  stroke-dasharray: 314.16;
  animation: ${props => fillProgress(props.$offsetFinal)} 1.2s cubic-bezier(0.1, 0.8, 0.2, 1) forwards;
`;

const GaugeText = styled.div`
  position: absolute;
`;

const Percentage = styled.span<{ $isSmall: boolean }>`
  color: #ffffff;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: ${props => props.$isSmall ? '14px' : '28px'};
  font-weight: 700;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
`;

const FooterText = styled.div<{ $isSmall: boolean }>`
  margin-top: ${props => props.$isSmall ? '4px' : '16px'};
  color: rgba(255, 255, 255, 0.7);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: ${props => props.$isSmall ? '9px' : '14px'};
  text-align: center;
`;

export const GlassGauge: React.FC<GlassGaugeProps> = ({ 
  value, 
  title = "Sinal", 
  subtitle,
  color = "#00d2ff",
  size = "md",
  noTitle,
  displayValue: explicitDisplayValue
}) => {
  const clampedValue = Math.max(0, Math.min(100, value));
  const isSmall = size === 'sm';
  
  const radius = 50;
  const circumference = 2 * Math.PI * radius; 
  const strokeDashoffsetFinal = circumference - (clampedValue / 100) * circumference;

  const [displayValueState, setDisplayValueState] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1200; 
    const stepTime = Math.abs(Math.floor(duration / (clampedValue || 1)));
    
    if (clampedValue === 0) return;

    const timer = setInterval(() => {
      start += 1;
      setDisplayValueState(start);
      if (start >= clampedValue) {
        clearInterval(timer);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [clampedValue]);

  return (
    <GlassCard $isSmall={isSmall} $noTitle={noTitle}>
      <GlowEffect $color={color} />
      
      {!noTitle && (
        <Header $isSmall={isSmall}>
          <Title $isSmall={isSmall}>{title}</Title>
          {!isSmall && <Dots>•••</Dots>}
        </Header>
      )}

      <GaugeContainer $isSmall={isSmall}>
        <SvgGauge viewBox="0 0 120 120">
          <CircleBackground cx="60" cy="60" r={radius} $isSmall={isSmall} />
          <CircleProgress
            cx="60"
            cy="60"
            r={radius}
            $offsetFinal={strokeDashoffsetFinal}
            $color={color}
            $isSmall={isSmall}
          />
        </SvgGauge>
        
        <GaugeText>
          <Percentage $isSmall={isSmall}>{explicitDisplayValue ?? `${displayValueState}%`}</Percentage>
        </GaugeText>
      </GaugeContainer>

      {subtitle && <FooterText $isSmall={isSmall}>{subtitle}</FooterText>}
    </GlassCard>
  );
};
