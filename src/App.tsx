import { useState } from 'react';
import MainMenu from './pages/MainMenu';
import Countries from './pages/Countries';
import HowToPlay from './pages/HowToPlay';
import Credits from './pages/Credits';
import GameScreen from './pages/GameScreen';
import type { GameModeId, ISO3 } from './types';

type Screen =
  | { kind: 'menu' }
  | { kind: 'countries' }
  | { kind: 'howto' }
  | { kind: 'credits' }
  | { kind: 'game'; mode: GameModeId; forcedCountry?: ISO3 };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });

  switch (screen.kind) {
    case 'menu':
      return (
        <MainMenu
          onPlay={(mode) => setScreen({ kind: 'game', mode })}
          onNavigate={(s) => setScreen({ kind: s })}
        />
      );
    case 'countries':
      return (
        <Countries
          onBack={() => setScreen({ kind: 'menu' })}
          onSelect={(iso3) => setScreen({ kind: 'game', mode: 'classic', forcedCountry: iso3 })}
        />
      );
    case 'howto':
      return <HowToPlay onBack={() => setScreen({ kind: 'menu' })} />;
    case 'credits':
      return <Credits onBack={() => setScreen({ kind: 'menu' })} />;
    case 'game':
      return (
        <GameScreen
          key={`${screen.mode}-${screen.forcedCountry ?? ''}-${Date.now()}`}
          mode={screen.mode}
          forcedCountry={screen.forcedCountry}
          onExit={() => setScreen({ kind: 'menu' })}
        />
      );
  }
}
