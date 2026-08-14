import { describe, expect, it } from 'vitest';
import { validateSchema } from '../../src/core/schema/schema-validator';
import schemaIndex from '../../schemas/index.json';
import pixelQuestSchema from '../../schemas/nintendo-3ds/pixel-quest/usa-v1.json';
import ironKeepSchema from '../../schemas/gbc/iron-keep/usa-v1.json';
import starForgeSchema from '../../schemas/pc/star-forge/v1.json';
import pokemonDpSchema from '../../schemas/nintendo-ds/pokemon-diamond-pearl/usa-v1.json';
import lotdkSchema from '../../schemas/pc/lego-batman-lotdk/steam-v1.json';
import finalFantasyExplorersLink from '../../schemas/community-editor-links/final-fantasy-explorers.json';
import hyruleWarriorsLink from '../../schemas/community-editor-links/hyrule-warriors.json';
import hyruleWarriorsAocLink from '../../schemas/community-editor-links/hyrule-warriors-age-of-calamity.json';
import kidIcarusUprisingLink from '../../schemas/community-editor-links/kid-icarus-uprising.json';
import kirbysBlowoutBlastLink from '../../schemas/community-editor-links/kirbys-blowout-blast.json';
import marioKart7Link from '../../schemas/community-editor-links/mario-kart-7.json';
import nintendogsCatsLink from '../../schemas/community-editor-links/nintendogs-cats.json';
import picross3dRound2Link from '../../schemas/community-editor-links/picross-3d-round-2.json';
import picrossELink from '../../schemas/community-editor-links/picross-e.json';
import pokemonPicrossLink from '../../schemas/community-editor-links/pokemon-picross.json';
import pokemonShuffleLink from '../../schemas/community-editor-links/pokemon-shuffle.json';
import rhythmParadiseMegamixLink from '../../schemas/community-editor-links/rhythm-paradise-megamix.json';
import smashBrosUltimateLink from '../../schemas/community-editor-links/smash-bros-ultimate.json';
import streetpassMiiPlazaLink from '../../schemas/community-editor-links/streetpass-mii-plaza.json';
import superKirbyClashLink from '../../schemas/community-editor-links/super-kirby-clash.json';
import sushiStrikerLink from '../../schemas/community-editor-links/sushi-striker.json';
import teamKirbyClashDxLink from '../../schemas/community-editor-links/team-kirby-clash-dx.json';
import theLegoMovieVideogameLink from '../../schemas/community-editor-links/the-lego-movie-videogame.json';
import zeldaBotwLink from '../../schemas/community-editor-links/zelda-botw.json';
import zeldaTotkLink from '../../schemas/community-editor-links/zelda-totk.json';

const bundled: Record<string, unknown> = {
  'nintendo-3ds/pixel-quest/usa-v1.json': pixelQuestSchema,
  'gbc/iron-keep/usa-v1.json': ironKeepSchema,
  'pc/star-forge/v1.json': starForgeSchema,
  'nintendo-ds/pokemon-diamond-pearl/usa-v1.json': pokemonDpSchema,
  'pc/lego-batman-lotdk/steam-v1.json': lotdkSchema,
  'community-editor-links/final-fantasy-explorers.json': finalFantasyExplorersLink,
  'community-editor-links/hyrule-warriors.json': hyruleWarriorsLink,
  'community-editor-links/hyrule-warriors-age-of-calamity.json': hyruleWarriorsAocLink,
  'community-editor-links/kid-icarus-uprising.json': kidIcarusUprisingLink,
  'community-editor-links/kirbys-blowout-blast.json': kirbysBlowoutBlastLink,
  'community-editor-links/mario-kart-7.json': marioKart7Link,
  'community-editor-links/nintendogs-cats.json': nintendogsCatsLink,
  'community-editor-links/picross-3d-round-2.json': picross3dRound2Link,
  'community-editor-links/picross-e.json': picrossELink,
  'community-editor-links/pokemon-picross.json': pokemonPicrossLink,
  'community-editor-links/pokemon-shuffle.json': pokemonShuffleLink,
  'community-editor-links/rhythm-paradise-megamix.json': rhythmParadiseMegamixLink,
  'community-editor-links/smash-bros-ultimate.json': smashBrosUltimateLink,
  'community-editor-links/streetpass-mii-plaza.json': streetpassMiiPlazaLink,
  'community-editor-links/super-kirby-clash.json': superKirbyClashLink,
  'community-editor-links/sushi-striker.json': sushiStrikerLink,
  'community-editor-links/team-kirby-clash-dx.json': teamKirbyClashDxLink,
  'community-editor-links/the-lego-movie-videogame.json': theLegoMovieVideogameLink,
  'community-editor-links/zelda-botw.json': zeldaBotwLink,
  'community-editor-links/zelda-totk.json': zeldaTotkLink,
};

describe('example + real schema repository', () => {
  it('index.json references exactly the bundled schemas', () => {
    expect(schemaIndex.schemas.length).toBe(Object.keys(bundled).length);
    for (const entry of schemaIndex.schemas) {
      expect(bundled[entry.path]).toBeDefined();
    }
  });

  it('every bundled schema passes formal validation', () => {
    for (const [path, raw] of Object.entries(bundled)) {
      const result = validateSchema(raw);
      expect(result.valid, `${path} should be valid: ${result.errors.join('; ')}`).toBe(true);
    }
  });

  it('every schema id in index.json matches the id declared inside the schema file', () => {
    for (const entry of schemaIndex.schemas) {
      const raw = bundled[entry.path] as { id: string };
      expect(raw.id).toBe(entry.id);
    }
  });

  it('has no duplicate schema ids in the index', () => {
    const ids = schemaIndex.schemas.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('community-editor-links schemas have empty fields and a slug matching /community-editors', () => {
    for (const [path, raw] of Object.entries(bundled)) {
      if (!path.startsWith('community-editor-links/')) continue;
      const schema = raw as { fields: unknown[]; communityEditor?: { slug: string } };
      expect(schema.fields, `${path} should have no editable fields`).toEqual([]);
      expect(schema.communityEditor?.slug, `${path} should declare communityEditor.slug`).toBeTruthy();
    }
  });
});
