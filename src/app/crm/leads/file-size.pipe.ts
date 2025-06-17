import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'fileSize'
})
export class FileSizePipe implements PipeTransform {
  transform(size: number): string {
    if (size === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(size) / Math.log(1024));
    
    return parseFloat((size / Math.pow(1024, i)).toFixed(2)) + ' ' + units[i];
  }
}