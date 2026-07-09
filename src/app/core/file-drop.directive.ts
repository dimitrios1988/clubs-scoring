import { Directive, output, signal, HostListener, HostBinding, input } from '@angular/core';

/**
 * Turns the host element into a drag-and-drop target for CSV files.
 * Emits the dropped `File` via `fileDropped`. When `fileDropDisabled` is
 * true, all drag/drop interaction is ignored.
 */
@Directive({
  selector: '[appFileDrop]',
})
export class FileDropDirective {
  readonly fileDropDisabled = input(false);
  readonly fileDropped = output<File>();

  /** True while a file is being dragged over the host (for styling). */
  readonly isDragging = signal(false);

  @HostBinding('class.is-dragging')
  get draggingClass(): boolean {
    return this.isDragging();
  }

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    if (this.fileDropDisabled()) return;
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    if (this.fileDropDisabled()) return;
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    if (this.fileDropDisabled()) return;
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.fileDropped.emit(file);
    }
  }
}
