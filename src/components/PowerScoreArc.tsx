import React from 'react';

interface PowerScoreArcProps {
  score: number;
  maxScore?: number;
  size?: "small" | "medium" | "large";
  showLabel?: boolean;
}

const PowerScoreArc: React.FC<PowerScoreArcProps> = ({ 
  score, 
  size = "medium",
  showLabel = true
}) => {
  // Size configurations
  const sizeConfigs = {
    small: { fontSize: 'text-xl', labelSize: 'text-xs' },
    medium: { fontSize: 'text-3xl', labelSize: 'text-sm' },
    large: { fontSize: 'text-5xl', labelSize: 'text-base' }
  };

  const config = sizeConfigs[size];
  
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <div className={`font-bold ${config.fontSize} text-foreground`}>
        {score}
      </div>
      {showLabel && (
        <div className={`${config.labelSize} text-muted-foreground font-medium`}>
          Power Score
        </div>
      )}
    </div>
  );
};

export default PowerScoreArc;