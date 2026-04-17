import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileUploadComponent } from '../../../src/app/shared/components/forms/file-upload.component';
import { MatIconModule } from '@angular/material/icon';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

function makeFile(name: string, type: string, sizeBytes = 1024): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

describe('FileUploadComponent', () => {
  let fixture: ComponentFixture<FileUploadComponent>;
  let component: FileUploadComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileUploadComponent, MatIconModule, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(FileUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts with no files', () => {
    expect(component.selectedFiles.length).toBe(0);
  });

  it('onDragOver sets isDragOver=true', () => {
    const event = { preventDefault: jest.fn() } as unknown as DragEvent;
    component.onDragOver(event);
    expect(component.isDragOver).toBe(true);
  });

  it('onDragLeave sets isDragOver=false', () => {
    component.isDragOver = true;
    component.onDragLeave();
    expect(component.isDragOver).toBe(false);
  });

  it('onDrop processes valid files', () => {
    const spy = jest.spyOn(component.filesSelected, 'emit');
    const file = makeFile('doc.pdf', 'application/pdf');
    const dt = { files: [file] } as unknown as DataTransfer;
    const event = { preventDefault: jest.fn(), dataTransfer: dt, isDragOver: false } as unknown as DragEvent;
    component.onDrop(event);
    expect(component.selectedFiles.length).toBe(1);
    expect(spy).toHaveBeenCalled();
  });

  it('removeFile removes a file by index', () => {
    const file = makeFile('doc.pdf', 'application/pdf');
    component.selectedFiles = [file];
    const spy = jest.spyOn(component.filesSelected, 'emit');
    const event = { stopPropagation: jest.fn() } as unknown as MouseEvent;
    component.removeFile(0, event);
    expect(component.selectedFiles.length).toBe(0);
    expect(spy).toHaveBeenCalled();
  });

  it('rejects files over maxSizeMB', () => {
    const spy = jest.spyOn(component.validationErrors, 'emit');
    const bigFile = makeFile('big.pdf', 'application/pdf', 20 * 1024 * 1024);
    component.maxSizeMB = 10;
    const event = { stopPropagation: jest.fn() } as unknown as MouseEvent;
    const dt = { files: [bigFile] } as unknown as DataTransfer;
    const dropEvent = { preventDefault: jest.fn(), dataTransfer: dt } as unknown as DragEvent;
    component.onDrop(dropEvent);
    expect(spy).toHaveBeenCalled();
    expect(component.errors[0].reason).toBe('size');
  });

  it('rejects files with wrong type', () => {
    component.accept = 'application/pdf';
    const file = makeFile('img.png', 'image/png');
    const dt = { files: [file] } as unknown as DataTransfer;
    const event = { preventDefault: jest.fn(), dataTransfer: dt } as unknown as DragEvent;
    component.onDrop(event);
    expect(component.errors[0].reason).toBe('type');
  });

  it('iconForType returns pdf icon for application/pdf', () => {
    expect(component.iconForType('application/pdf')).toBe('picture_as_pdf');
  });

  it('iconForType returns image icon for image type', () => {
    expect(component.iconForType('image/jpeg')).toBe('image');
  });

  it('iconForType returns generic icon for other types', () => {
    expect(component.iconForType('application/zip')).toBe('insert_drive_file');
  });

  it('formatSize returns B for bytes under 1024', () => {
    expect(component.formatSize(512)).toBe('512 B');
  });

  it('formatSize returns KB for kilobyte range', () => {
    expect(component.formatSize(2048)).toContain('KB');
  });

  it('formatSize returns MB for megabyte range', () => {
    expect(component.formatSize(2 * 1024 * 1024)).toContain('MB');
  });

  it('multiple=true appends files', () => {
    fixture.componentRef.setInput('multiple', true);
    const file1 = makeFile('a.pdf', 'application/pdf');
    const file2 = makeFile('b.pdf', 'application/pdf');
    const dt1 = { files: [file1] } as unknown as DataTransfer;
    const dt2 = { files: [file2] } as unknown as DataTransfer;
    component.onDrop({ preventDefault: jest.fn(), dataTransfer: dt1 } as unknown as DragEvent);
    component.onDrop({ preventDefault: jest.fn(), dataTransfer: dt2 } as unknown as DragEvent);
    expect(component.selectedFiles.length).toBe(2);
  });
});
