import { Badge } from '../components/Badge';

type CommunityEditor = {
  slug: string;
  title: string;
  platform: string;
  description: string;
  author: 'Marc Robledo' | 'Magiczocker';
  hasThumb: boolean;
};

const AUTHOR_LINKS: Record<CommunityEditor['author'], string> = {
  'Marc Robledo': 'https://github.com/marcrobledo',
  Magiczocker: 'https://github.com/magiczocker10',
};

// Vendored from github.com/marcrobledo/savegame-editors (MIT). See
// /community-editors/NOTICE.md for exactly what was changed to make these
// work on this deployment.
const EDITORS: CommunityEditor[] = [
  { slug: 'zelda-totk', title: 'The Legend of Zelda: Tears of the Kingdom', platform: 'Switch', description: 'Items, weapon durability, modifiers, horses and more.', author: 'Marc Robledo', hasThumb: true },
  { slug: 'zelda-botw', title: 'The Legend of Zelda: Breath of the Wild', platform: 'Wii U / Switch', description: 'Items, weapon durability, modifiers and more.', author: 'Marc Robledo', hasThumb: true },
  { slug: 'smash-bros-ultimate', title: 'Super Smash Bros. Ultimate', platform: 'Switch', description: 'Skill orbs, spirit points, items and more.', author: 'Marc Robledo', hasThumb: true },
  { slug: 'hyrule-warriors-age-of-calamity', title: 'Hyrule Warriors: Age of Calamity', platform: 'Switch', description: 'Rupees and materials.', author: 'Marc Robledo', hasThumb: true },
  { slug: 'super-kirby-clash', title: 'Super Kirby Clash', platform: 'Switch', description: 'Apple currency and materials.', author: 'Marc Robledo', hasThumb: true },
  { slug: 'hyrule-warriors', title: 'Hyrule Warriors', platform: 'Wii U', description: 'Rupees and materials.', author: 'Marc Robledo', hasThumb: true },
  { slug: 'kid-icarus-uprising', title: 'Kid Icarus: Uprising', platform: '3DS', description: 'Apple currency and materials.', author: 'Marc Robledo', hasThumb: true },
  { slug: 'final-fantasy-explorers', title: 'Final Fantasy Explorers', platform: '3DS', description: 'Coins, flow balls and onions.', author: 'Marc Robledo', hasThumb: true },
  { slug: 'mario-kart-7', title: 'Mario Kart 7', platform: '3DS', description: 'Coin count, and unlock tracks and car parts.', author: 'Marc Robledo', hasThumb: true },
  { slug: 'team-kirby-clash-dx', title: 'Team Kirby Clash Deluxe', platform: '3DS', description: 'Apple currency and materials.', author: 'Marc Robledo', hasThumb: true },
  { slug: 'kirbys-blowout-blast', title: "Kirby's Blowout Blast", platform: '3DS', description: 'Unlock all amiibo puzzles.', author: 'Marc Robledo', hasThumb: true },
  { slug: 'picross-3d-round-2', title: 'Picross 3D: Round 2', platform: '3DS', description: 'Unlock all amiibo puzzles.', author: 'Marc Robledo', hasThumb: true },
  { slug: 'sushi-striker', title: 'Sushi Striker', platform: '3DS', description: 'Item amounts and unlock the Kyatten sprite.', author: 'Marc Robledo', hasThumb: true },
  { slug: 'pokemon-picross', title: 'Pokémon Picross', platform: '3DS', description: 'Free picrites.', author: 'Marc Robledo', hasThumb: true },
  { slug: 'pokemon-shuffle', title: 'Pokémon Shuffle', platform: '3DS', description: 'Hearts, jewels, coins, items and more.', author: 'Marc Robledo', hasThumb: true },
  { slug: 'rhythm-paradise-megamix', title: 'Rhythm Paradise / Heaven Megamix', platform: '3DS', description: 'Coins, flow balls and onions.', author: 'Marc Robledo', hasThumb: true },
  { slug: 'streetpass-mii-plaza', title: 'StreetPass Mii Plaza', platform: '3DS', description: 'Puzzle Swap pieces, unlock DLC hats and more.', author: 'Marc Robledo', hasThumb: true },
  { slug: 'the-lego-movie-videogame', title: 'The Lego Movie Videogame', platform: '3DS', description: 'General save editing.', author: 'Magiczocker', hasThumb: false },
  { slug: 'nintendogs+cats', title: 'Nintendogs + Cats', platform: '3DS', description: 'General save editing.', author: 'Magiczocker', hasThumb: false },
  { slug: 'picross-e', title: 'PICROSS e', platform: '3DS', description: 'General save editing.', author: 'Marc Robledo', hasThumb: false },
];

function EditorCard({ editor }: { editor: CommunityEditor }) {
  const href = `/community-editors/${editor.slug}/`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-bg-panel transition-colors hover:border-accent/50"
    >
      <div className="flex h-32 items-center justify-center overflow-hidden bg-bg-inset">
        {editor.hasThumb ? (
          <img
            src={`/community-editors/${editor.slug}/thumb.jpg`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs text-text-faint">No preview</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug text-text group-hover:text-accent-hover">{editor.title}</h3>
          <Badge tone="neutral">{editor.platform}</Badge>
        </div>
        <p className="flex-1 text-xs leading-relaxed text-text-muted">{editor.description}</p>
        <p className="text-xs text-text-faint">
          by{' '}
          <a
            href={AUTHOR_LINKS[editor.author]}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="underline decoration-dotted underline-offset-2 hover:text-accent-hover"
          >
            {editor.author}
          </a>
        </p>
      </div>
    </a>
  );
}

export function CommunityEditorsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-text">Community Editors</h1>
      <p className="mt-2 max-w-3xl text-sm text-text-muted">
        A collection of standalone, game-specific save editors — separate from this site's own schema-driven engine
        above. Each one is a full bespoke tool built for one specific game, still 100% client-side: nothing is ever
        uploaded.
      </p>

      <div className="mt-4 max-w-3xl rounded-lg border border-border bg-bg-panel p-4 text-xs leading-relaxed text-text-muted">
        Vendored from{' '}
        <a
          href="https://github.com/marcrobledo/savegame-editors"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-hover underline decoration-dotted underline-offset-2"
        >
          marcrobledo/savegame-editors
        </a>{' '}
        (MIT licensed), created by Marc Robledo with contributions from Magiczocker and others. Individual games are
        credited on their own page and in{' '}
        <a
          href="/community-editors/NOTICE.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-hover underline decoration-dotted underline-offset-2"
        >
          NOTICE.md
        </a>
        , which also documents the small set of changes made so they run on this deployment (removed a stale
        service-worker registration, fixed an author link, self-hosted one CDN dependency). Full license text:{' '}
        <a
          href="/community-editors/LICENSE-savegame-editors.txt"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-hover underline decoration-dotted underline-offset-2"
        >
          LICENSE-savegame-editors.txt
        </a>
        .
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EDITORS.map((editor) => (
          <EditorCard key={editor.slug} editor={editor} />
        ))}
      </div>
    </div>
  );
}
