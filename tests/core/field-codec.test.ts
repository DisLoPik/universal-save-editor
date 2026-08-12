import { describe, expect, it } from 'vitest';
import { buildFieldLayout, readLeafValue, writeLeafValue } from '../../src/core/field/field-codec';
import { BinaryReader } from '../../src/core/binary/binary-reader';
import { BinaryWriter } from '../../src/core/binary/binary-writer';
import type { SaveSchema } from '../../src/core/schema/schema-types';
import { buildIronKeepSave, buildStarForgeSave } from '../fixtures/example-saves';
import ironKeepSchema from '../../schemas/gbc/iron-keep/usa-v1.json';
import starForgeSchema from '../../schemas/pc/star-forge/v1.json';

const ironKeep = ironKeepSchema as unknown as SaveSchema;
const starForge = starForgeSchema as unknown as SaveSchema;

describe('buildFieldLayout + readLeafValue', () => {
  it('flattens struct fields with resolved absolute offsets', () => {
    const layout = buildFieldLayout(ironKeep);
    const hp = layout.find((f) => f.instanceId === 'stats.hp');
    expect(hp).toBeDefined();
    expect(hp!.offset).toBe(0x8 + 0x3); // struct base 0x8 + relative 0x3
  });

  it('flattens array-of-struct elements with per-index instance ids', () => {
    const layout = buildFieldLayout(starForge);
    const ids = layout.filter((f) => f.instanceId.startsWith('inventory[')).map((f) => f.instanceId);
    expect(ids).toContain('inventory[0].itemId');
    expect(ids).toContain('inventory[4].quantity');
    const slot2ItemId = layout.find((f) => f.instanceId === 'inventory[2].itemId');
    expect(slot2ItemId!.offset).toBe(0x20 + 2 * 0x4);
  });

  it('reads correct values out of a real Iron Keep fixture, including a bitfield and a transform', () => {
    const buffer = buildIronKeepSave({ currentChapter: 5, bossDefeated: true, magicPercentRaw: 60 });
    const reader = new BinaryReader(buffer.buffer);
    const layout = buildFieldLayout(ironKeep);

    const chapter = layout.find((f) => f.instanceId === 'currentChapter')!;
    expect(readLeafValue(chapter.field, chapter.offset, reader)).toBe(5);

    const boss = layout.find((f) => f.instanceId === 'bossDefeated')!;
    expect(readLeafValue(boss.field, boss.offset, reader)).toBe(true);

    const magic = layout.find((f) => f.instanceId === 'stats.magicPercent')!;
    expect(readLeafValue(magic.field, magic.offset, reader)).toBe(30); // 60 / 2 (scale divisor)
  });

  it('reads an enum inside an array element', () => {
    const buffer = buildStarForgeSave({ items: [[3, 9], [0, 0], [0, 0], [0, 0], [0, 0]] });
    const reader = new BinaryReader(buffer.buffer);
    const layout = buildFieldLayout(starForge);
    const itemId = layout.find((f) => f.instanceId === 'inventory[0].itemId')!;
    expect(readLeafValue(itemId.field, itemId.offset, reader)).toBe(3);
  });
});

describe('writeLeafValue', () => {
  it('writes a transformed value back to its raw stored form', () => {
    const buffer = buildIronKeepSave();
    const layout = buildFieldLayout(ironKeep);
    const magic = layout.find((f) => f.instanceId === 'stats.magicPercent')!;
    const writer = new BinaryWriter(buffer);
    writeLeafValue(magic.field, magic.offset, writer, 40); // display 40 -> raw 80
    expect(buffer[magic.offset]).toBe(80);
  });

  it('round-trips a bitfield write/read without disturbing the neighboring boolean bit', () => {
    const buffer = buildIronKeepSave({ currentChapter: 1, bossDefeated: true });
    const layout = buildFieldLayout(ironKeep);
    const chapter = layout.find((f) => f.instanceId === 'currentChapter')!;
    const writer = new BinaryWriter(buffer);
    writeLeafValue(chapter.field, chapter.offset, writer, 6);

    const reader = new BinaryReader(buffer.buffer);
    expect(readLeafValue(chapter.field, chapter.offset, reader)).toBe(6);
    const boss = layout.find((f) => f.instanceId === 'bossDefeated')!;
    expect(readLeafValue(boss.field, boss.offset, reader)).toBe(true); // untouched
  });
});
