import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTurnBasedBattle } from '@/hooks/useTurnBasedBattle';
import { useAuth } from '@/auth/AuthProvider';
import { toast } from 'sonner';

const TurnBasedBattle = () => {
  const { battleId } = useParams<{ battleId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    battle,
    turns,
    loading,
    submitting,
    isMyTurn,
    myHp,
    opponentHp,
    mySpider,
    opponentSpider,
    submitTurn,
  } = useTurnBasedBattle(battleId || null);

  useEffect(() => {
    if (!battleId) {
      toast.error('No battle ID provided');
      navigate('/battle-mode');
    }
  }, [battleId, navigate]);

  useEffect(() => {
    // Battle ended, redirect after a delay
    if (battle && !battle.is_active) {
      setTimeout(() => {
        navigate('/battle-mode');
      }, 5000);
    }
  }, [battle, navigate]);

  const handleAction = async (actionType: 'attack' | 'defend' | 'special' | 'pass') => {
    try {
      await submitTurn(actionType);
      toast.success(`${actionType.charAt(0).toUpperCase() + actionType.slice(1)} performed!`);
    } catch (error) {
      // Error already handled in hook
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!battle || !mySpider || !opponentSpider) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Battle not found</p>
            <Button asChild className="mt-4">
              <Link to="/battle-mode">Back to Battle Mode</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const battleEnded = !battle.is_active;
  const iWon = battle.winner === 'TEAM_A' 
    ? (battle.team_a as any)?.userId === user?.id 
    : (battle.team_b as any)?.userId === user?.id;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Turn-Based Battle — Spider League</title>
        <meta name="description" content="Engage in strategic turn-based spider battles" />
      </Helmet>

      {/* Header */}
      <header className="glass-card border-b border-border/30 sticky top-0 z-40 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <img 
                  src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png" 
                  alt="Spider League Logo" 
                  className="h-12 w-auto"
                />
              </Link>
              <div>
                <h1 className="text-2xl font-bold gradient-text">Turn-Based Battle</h1>
                <p className="text-sm text-muted-foreground">Turn {battle.turn_count}</p>
              </div>
            </div>
            
            <Button variant="ghost" asChild>
              <Link to="/battle-mode">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Exit
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {battleEnded && (
          <Card className="mb-6 border-primary">
            <CardContent className="p-6 text-center">
              <h2 className="text-3xl font-bold mb-2">
                {iWon ? '🏆 Victory!' : '💀 Defeat'}
              </h2>
              <p className="text-muted-foreground">
                {iWon ? `${mySpider.nickname} has won the battle!` : `${opponentSpider.nickname} has won the battle!`}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Redirecting to Battle Mode...</p>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* My Spider */}
          <Card className={isMyTurn && !battleEnded ? 'border-primary' : ''}>
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold">{mySpider.nickname}</h3>
                <p className="text-sm text-muted-foreground">{mySpider.species}</p>
                {isMyTurn && !battleEnded && (
                  <p className="text-sm text-primary font-medium mt-1">Your Turn!</p>
                )}
              </div>
              
              <img 
                src={mySpider.image_url} 
                alt={mySpider.nickname}
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">HP</span>
                  <span className="font-bold">{myHp} / {mySpider.hit_points}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${((myHp || 0) / mySpider.hit_points) * 100}%` }}
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                  <div>
                    <div className="text-muted-foreground">ATK</div>
                    <div className="font-bold">{mySpider.damage}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">DEF</div>
                    <div className="font-bold">{mySpider.defense}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">SPD</div>
                    <div className="font-bold">{mySpider.speed}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Opponent Spider */}
          <Card>
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold">{opponentSpider.nickname}</h3>
                <p className="text-sm text-muted-foreground">{opponentSpider.species}</p>
                {!isMyTurn && !battleEnded && (
                  <p className="text-sm text-muted-foreground mt-1">Opponent's Turn</p>
                )}
              </div>
              
              <img 
                src={opponentSpider.image_url} 
                alt={opponentSpider.nickname}
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">HP</span>
                  <span className="font-bold">{opponentHp} / {opponentSpider.hit_points}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 transition-all"
                    style={{ width: `${((opponentHp || 0) / opponentSpider.hit_points) * 100}%` }}
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                  <div>
                    <div className="text-muted-foreground">ATK</div>
                    <div className="font-bold">{opponentSpider.damage}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">DEF</div>
                    <div className="font-bold">{opponentSpider.defense}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">SPD</div>
                    <div className="font-bold">{opponentSpider.speed}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        {!battleEnded && (
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold mb-4">Battle Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button
                  onClick={() => handleAction('attack')}
                  disabled={!isMyTurn || submitting}
                  className="h-20"
                >
                  ⚔️ Attack
                </Button>
                <Button
                  onClick={() => handleAction('defend')}
                  disabled={!isMyTurn || submitting}
                  variant="secondary"
                  className="h-20"
                >
                  🛡️ Defend
                </Button>
                <Button
                  onClick={() => handleAction('special')}
                  disabled={!isMyTurn || submitting}
                  variant="outline"
                  className="h-20"
                >
                  💥 Special
                </Button>
                <Button
                  onClick={() => handleAction('pass')}
                  disabled={!isMyTurn || submitting}
                  variant="ghost"
                  className="h-20"
                >
                  ⏭️ Pass
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Battle Log */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4">Battle Log</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {turns.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No turns yet. Battle begins now!
                </p>
              ) : (
                turns.map((turn, index) => (
                  <div key={turn.id} className="text-sm p-2 bg-muted/50 rounded">
                    <span className="font-medium">Turn {turn.turn_index}:</span>{' '}
                    <span className="text-muted-foreground">
                      {turn.action_type} - {JSON.stringify(turn.result_payload)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TurnBasedBattle;
