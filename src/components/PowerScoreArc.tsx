import React from 'react';

interface PowerScoreArcProps {
  score: number;
  maxScore?: number;
  size?: number | "small" | "medium" | "large";
}

const PowerScoreArc: React.FC<PowerScoreArcProps> = ({ 
  score, 
  maxScore = 100, 
  size = 80 
}) => {
  // Convert size variants to numbers
  const getSizeValue = (size: number | "small" | "medium" | "large"): number => {
    if (typeof size === 'number') return size;
    switch (size) {
      case 'small': return 60;
      case 'medium': return 80;
      case 'large': return 100;
      default: return 80;
    }
  };

  const sizeValue = getSizeValue(size);
  const percentage = Math.min(score / maxScore, 1);
  const strokeWidth = sizeValue <= 60 ? 4 : 6;
  const radius = (sizeValue - strokeWidth) / 2;
  const circumference = Math.PI * radius; // Half circle
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference * (1 - percentage);
  
  // Color based on score ranges (similar to Oura)
  const getScoreColor = (score: number) => {
    if (score >= 85) return "hsl(var(--chart-1))"; // Excellent - Green
    if (score >= 70) return "hsl(var(--chart-2))"; // Good - Blue  
    if (score >= 55) return "hsl(var(--chart-3))"; // Fair - Yellow
    return "hsl(var(--chart-4))"; // Poor - Red
  };

  const scoreColor = getScoreColor(score);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: sizeValue, height: sizeValue / 2 + 10 }}>
        <svg
          width={sizeValue}
          height={sizeValue / 2 + 10}
          className="transform -rotate-0"
          style={{ overflow: 'visible' }}
        >
          {/* Background arc */}
          <path
            d={`M ${strokeWidth/2} ${sizeValue/2} A ${radius} ${radius} 0 0 1 ${sizeValue - strokeWidth/2} ${sizeValue/2}`}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          
          {/* Progress arc */}
          <path
            d={`M ${strokeWidth/2} ${sizeValue/2} A ${radius} ${radius} 0 0 1 ${sizeValue - strokeWidth/2} ${sizeValue/2}`}
            fill="none"
            stroke={scoreColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: 'stroke-dashoffset 0.5s ease-in-out',
            }}
          />
        </svg>
        
        {/* Score text */}
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <div className="text-center">
            <div className={`font-bold ${sizeValue <= 60 ? 'text-sm' : 'text-xl'}`} style={{ color: scoreColor }}>
              {score}
            </div>
            <div className={`text-muted-foreground font-medium ${sizeValue <= 60 ? 'text-xs' : 'text-xs'}`}>
              Power Score
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PowerScoreArc;