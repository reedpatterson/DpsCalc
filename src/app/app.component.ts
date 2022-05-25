import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'DPSCalc';
  public dpsForm = new FormGroup({
    cd: new FormControl(0, [Validators.required]),
    ct: new FormControl(0, [Validators.required]),
    dmg_low: new FormControl(0, [Validators.required]),
    dmg_high: new FormControl(0, [Validators.required]),
  })
}
