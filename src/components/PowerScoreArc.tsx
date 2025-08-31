import React from 'react';

interface PowerScoreArcProps {
  score: number;
  maxScore?: number;
  size?: "small" | "medium" | "large";
  showLabel?: boolean;
}

const PowerScoreArc: React.FC<PowerScoreArcProps> = ({ 
  score, 
  maxScore = 600, // Updated for spider power scores which can be much higher
  size = "medium",
  showLabel = true
}) => {
  // Size configurations
  const sizeConfigs = {
    small: { diameter: 80, strokeWidth: 8, fontSize: 'text-lg', labelSize: 'text-xs' },
    medium: { diameter: 120, strokeWidth: 12, fontSize: 'text-2xl', labelSize: 'text-sm' },
    large: { diameter: 160, strokeWidth: 16, fontSize: 'text-4xl', labelSize: 'text-base' }
  };

  const config = sizeConfigs[size];
  const radius = (config.diameter - config.strokeWidth) / 2;
  const center = config.diameter / 2;
  const percentage = Math.min(Math.max(score / maxScore, 0), 1);
  
  // Arc spans 240 degrees (leaving 120 degrees at bottom open)
  const startAngle = 150; // Start at bottom left
  const endAngle = 30;    // End at bottom right
  const arcSpan = 240;
  
  // Calculate the fill angle based on percentage
  const fillAngle = startAngle - (percentage * arcSpan);
  
  // Convert angles to radians and calculate coordinates
  const toRadians = (angle: number) => (angle * Math.PI) / 180;
  
  const startX = center + radius * Math.cos(toRadians(startAngle));
  const startY = center + radius * Math.sin(toRadians(startAngle));
  const endX = center + radius * Math.cos(toRadians(endAngle));
  const endY = center + radius * Math.sin(toRadians(endAngle));
  
  const fillEndX = center + radius * Math.cos(toRadians(fillAngle));
  const fillEndY = center + radius * Math.sin(toRadians(fillAngle));
  
  // Determine score tier and colors
  const getScoreTier = (score: number) => {
    if (score >= 400) return { 
      tier: "LEGENDARY", 
      color: "from-amber-400 via-yellow-500 to-amber-600",
      glowColor: "shadow-amber-500/30",
      textColor: "text-amber-500"
    };
    if (score >= 300) return { 
      tier: "EPIC", 
      color: "from-purple-400 via-violet-500 to-purple-600",
      glowColor: "shadow-purple-500/30", 
      textColor: "text-purple-500"
    };
    if (score >= 200) return { 
      tier: "RARE", 
      color: "from-blue-400 via-cyan-500 to-blue-600",
      glowColor: "shadow-blue-500/30",
      textColor: "text-blue-500"
    };
    if (score >= 100) return { 
      tier: "UNCOMMON", 
      color: "from-green-400 via-emerald-500 to-green-600",
      glowColor: "shadow-green-500/30",
      textColor: "text-green-500"
    };
    return { 
      tier: "COMMON", 
      color: "from-gray-400 via-slate-500 to-gray-600",
      glowColor: "shadow-gray-500/30",
      textColor: "text-gray-500"
    };
  };

  const scoreTier = getScoreTier(score);
  
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: config.diameter, height: config.diameter * 0.75 }}>
        {/* Outer glow effect */}
        <div 
          className={`absolute inset-0 rounded-full blur-xl opacity-20 ${scoreTier.glowColor}`}
          style={{
            background: `conic-gradient(from ${startAngle}deg, transparent, var(--primary), transparent)`,
            transform: 'scale(1.1)'
          }}
        />
        
        <svg
          width={config.diameter}
          height={config.diameter}
          className="relative z-10"
          style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))' }}
        >
          {/* Background arc */}
          <path
            d={`M ${startX} ${startY} A ${radius} ${radius} 0 1 0 ${endX} ${endY}`}
            fill="none"
            stroke="hsl(var(--muted-foreground) / 0.2)"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
          />
          
          {/* Filled arc with gradient */}
          <defs>
            <linearGradient id={`powerGradient-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" className="text-muted-foreground/40" stopColor="currentColor" />
              <stop offset="50%" className={scoreTier.textColor} stopColor="currentColor" />
              <stop offset="100%" className={scoreTier.textColor} stopColor="currentColor" />
            </linearGradient>
          </defs>
          
          {percentage > 0 && (
            <path
              d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${percentage > 0.5 ? 1 : 0} 0 ${fillEndX} ${fillEndY}`}
              fill="none"
              stroke={`url(#powerGradient-${size})`}
              strokeWidth={config.strokeWidth}
              strokeLinecap="round"
              className="animate-fade-in"
              style={{
                animation: 'fade-in 0.8s ease-out, scale-in 0.6s ease-out'
              }}
            />
          )}
          
          {/* Power level markers */}
          {[0.25, 0.5, 0.75].map((mark, index) => {
            const markAngle = startAngle - (mark * arcSpan);
            const markX = center + (radius - config.strokeWidth/2) * Math.cos(toRadians(markAngle));
            const markY = center + (radius - config.strokeWidth/2) * Math.sin(toRadians(markAngle));
            
            return (
              <circle
                key={index}
                cx={markX}
                cy={markY}
                r={2}
                fill="hsl(var(--muted-foreground) / 0.4)"
                className="animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              />
            );
          })}
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: config.diameter * 0.1 }}>
          <div className={`font-bold ${config.fontSize} ${scoreTier.textColor} animate-scale-in`}>
            {score}
          </div>
          {showLabel && (
            <div className={`${config.labelSize} text-muted-foreground font-medium animate-fade-in`} style={{ animationDelay: '0.2s' }}>
              Power Score
            </div>
          )}
          <div className={`${sizeConfigs[size === 'small' ? 'small' : 'small'].labelSize} font-semibold ${scoreTier.textColor} opacity-80 animate-fade-in`} style={{ animationDelay: '0.4s' }}>
            {scoreTier.tier}
          </div>
        </div>
        
        {/* Progress indicator dots */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className={`w-1 h-1 rounded-full transition-all duration-300 ${
                i < Math.ceil(percentage * 5) 
                  ? scoreTier.textColor.replace('text-', 'bg-')
                  : 'bg-muted-foreground/30'
              }`}
              style={{ animationDelay: `${i * 0.1 + 0.6}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PowerScoreArc;