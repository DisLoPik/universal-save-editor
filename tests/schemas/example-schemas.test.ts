import { describe, expect, it } from 'vitest';
import { validateSchema } from '../../src/core/schema/schema-validator';
import schemaIndex from '../../schemas/index.json';
import pixelQuestSchema from '../../schemas/nintendo-3ds/pixel-quest/usa-v1.json';
import ironKeepSchema from '../../schemas/gbc/iron-keep/usa-v1.json';
import starForgeSchema from '../../schemas/pc/star-forge/v1.json';
import pokemonDpSchema from '../../schemas/nintendo-ds/pokemon-diamond-pearl/usa-v1.json';
import lotdkSchema from '../../schemas/pc/lego-batman-lotdk/steam-v1.json';

const bundled: Record<string, unknown> = {
  'nintendo-3ds/pixel-quest/usa-v1.json': pixelQuestSchema,
  'gbc/iron-keep/usa-v1.json': ironKeepSchema,
  'pc/star-forge/v1.json': starForgeSchema,
  'nintendo-ds/pokemon-diamond-pearl/usa-v1.json': pokemonDpSchema,
  'pc/lego-batman-lotdk/steam-v1.json': lotdkSchema,
};

describe('example + real schema repository', () => {
  it('index.json references five schemas, each with a matching bundled file', () => {
    expect(schemaIndex.schemas.length).toBe(5);
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
});
