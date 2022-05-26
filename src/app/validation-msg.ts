import { AfterViewInit, Component, Input } from '@angular/core';
import { AbstractControl, FormControl } from '@angular/forms';

@Component({
  selector: 'validation-msg',
  template: `
    <div *ngIf="control.errors && control.touched" class="text-danger">
        <small *ngIf="control.errors['min']">Value too low</small>
        <small *ngIf="control.errors['required']">Required</small>
        <small *ngIf="control.errors['max']">Value too high</small>
        <small *ngIf="control.errors['linkedGreaterThanTotal']">Number of linked mobs cannot exceed number of total mobs</small>
        <small *ngIf="control.errors['intervalGreaterThanDuration']">DoT interval cannot exceed DoT duration</small>
    </div>
  `,
})
export class ValidationMessageComponent implements AfterViewInit {
  @Input() control: AbstractControl = new FormControl('')

  ngAfterViewInit(): void {

  }
}
