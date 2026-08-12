import { describe, expect, it } from 'vitest';
import { buildBackupFileName, buildExportFileName } from '../../src/utils/download';

describe('export/backup filenames', () => {
  it('inserts _edited before the extension', () => {
    expect(buildExportFileName('save.sav')).toBe('save_edited.sav');
    expect(buildExportFileName('SAVEDATA.bin')).toBe('SAVEDATA_edited.bin');
  });

  it('inserts _original before the extension for backups', () => {
    expect(buildBackupFileName('save.sav')).toBe('save_original.sav');
  });

  it('handles filenames with no extension', () => {
    expect(buildExportFileName('save')).toBe('save_edited');
    expect(buildBackupFileName('save')).toBe('save_original');
  });

  it('handles filenames with multiple dots by splitting on the last one', () => {
    expect(buildExportFileName('my.game.save')).toBe('my.game_edited.save');
  });

  it('handles dotfiles (leading dot is not treated as an extension separator)', () => {
    expect(buildExportFileName('.saverc')).toBe('.saverc_edited');
  });
});
