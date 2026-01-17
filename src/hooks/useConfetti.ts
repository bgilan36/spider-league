import { useCallback } from 'react';
import confetti from 'canvas-confetti';

type ConfettiType = 'victory' | 'badge' | 'milestone' | 'streak' | 'spotlight';

export const useConfetti = () => {
  const fireConfetti = useCallback((type: ConfettiType = 'victory') => {
    const defaults = {
      origin: { y: 0.6 },
      zIndex: 9999,
    };

    switch (type) {
      case 'victory':
        // Big celebration for battle wins
        const duration = 3000;
        const end = Date.now() + duration;

        const frame = () => {
          confetti({
            ...defaults,
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#3b82f6', '#8b5cf6', '#f59e0b']
          });
          confetti({
            ...defaults,
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#3b82f6', '#8b5cf6', '#f59e0b']
          });

          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        };
        frame();
        break;

      case 'badge':
        // Starburst effect for badge unlocks
        confetti({
          ...defaults,
          particleCount: 100,
          spread: 70,
          origin: { y: 0.4 },
          colors: ['#fbbf24', '#f59e0b', '#d97706', '#ffffff'],
          shapes: ['star', 'circle'],
          scalar: 1.2
        });
        break;

      case 'milestone':
        // Upward burst for milestones
        confetti({
          ...defaults,
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          gravity: 0.8,
          colors: ['#10b981', '#34d399', '#6ee7b7']
        });
        break;

      case 'streak':
        // Fire-like effect for streaks
        const fire = () => {
          confetti({
            ...defaults,
            particleCount: 30,
            spread: 30,
            startVelocity: 45,
            origin: { y: 0.9, x: 0.5 },
            colors: ['#f97316', '#ef4444', '#fbbf24', '#dc2626'],
            shapes: ['circle'],
            gravity: 1.2,
            drift: 0
          });
        };
        fire();
        setTimeout(fire, 150);
        setTimeout(fire, 300);
        break;

      case 'spotlight':
        // Sparkle effect for spider of the day
        confetti({
          ...defaults,
          particleCount: 80,
          spread: 100,
          origin: { y: 0.5 },
          colors: ['#fbbf24', '#fde68a', '#ffffff', '#f59e0b'],
          shapes: ['star'],
          scalar: 1.5,
          ticks: 150
        });
        break;
    }
  }, []);

  return { fireConfetti };
};
