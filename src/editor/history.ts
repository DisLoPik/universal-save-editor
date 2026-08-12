import type { FieldValue } from '../core/field/field-codec';

export interface FieldEdit {
  instanceId: string;
  previousValue: FieldValue | undefined;
  nextValue: FieldValue;
}

/** Plain command-pattern undo/redo stack, independent of any UI framework. */
export class HistoryManager {
  private past: FieldEdit[] = [];
  private future: FieldEdit[] = [];

  record(edit: FieldEdit): void {
    this.past.push(edit);
    this.future = [];
  }

  undo(): FieldEdit | null {
    const edit = this.past.pop();
    if (!edit) return null;
    this.future.push(edit);
    return edit;
  }

  redo(): FieldEdit | null {
    const edit = this.future.pop();
    if (!edit) return null;
    this.past.push(edit);
    return edit;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
