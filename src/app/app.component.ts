import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  //todo edit spell?
  //todo hoverover to see spell details?
  title = 'DPSCalc';

  spellArray: Spell[] = [];
  spellDPSArray: SpellDPS[] = [];

  fightInfo?: FightInfo;

  /*
  {
    "name": "gs",
    "ct": 2,
    "cd": 2,
    "dot": true,
    "dot_dmg_low": 100,
    "dot_dmg_high": 100,
    "duration": 9,
    "interval": 3,
    "multiplier": 1,
    "dmg_low": 100,
    "dmg_high": 100,
    "type": "enc",
    "max_targets": undefined,
     show_card: false,
}*/

  public spellForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    ct: new FormControl(0, [Validators.required, Validators.min(.1)]),
    rs: new FormControl(0, [Validators.required, Validators.min(.1)]),
    cd: new FormControl(10, [Validators.required, Validators.min(.1)]),
    dot: new FormControl(false, [this.dotValidator()]),
    dot_dmg_low: new FormControl(0, [Validators.required, Validators.min(1)]),
    dot_dmg_high: new FormControl(0, [Validators.required, Validators.min(1)]),
    duration: new FormControl(0, [Validators.required, Validators.min(.1)]),
    interval: new FormControl(0, [Validators.required, Validators.min(.1)]),
    multiplier: new FormControl(1, [Validators.required]),
    dmg_low: new FormControl(0, [Validators.required, Validators.min(1)]),
    dmg_high: new FormControl(0, [Validators.required, Validators.min(1)]),
    type: new FormControl('st', [Validators.required]),
    max_targets: new FormControl('1', [Validators.min(1)]),
  }, [this.dotIntervalDuration()]);

  public fightForm = new FormGroup({
    duration: new FormControl(0, [Validators.required, Validators.min(.1)]),
    total_mobs: new FormControl(1, [Validators.required, Validators.min(1)]),
    linked_mobs: new FormControl(1, [Validators.min(1),]),
  }, [this.linkedGreaterThanTotal()]);

  public playerForm = new FormGroup({
    rs: new FormControl(0),
  });

  ngOnInit(): void {

  }

  showCard(s: Spell | SpellDPS) {
    s.show_card ? s.show_card = false : s.show_card = true;
  }

  calculateDPS(): void {
    if (this.fightForm.invalid) {
      this.fightForm.markAllAsTouched();
      return;
    }

    this.spellDPSArray = [];

    this.fightInfo = this.fightForm.value;

    this.spellArray.forEach(spell => {
      let initDmg = ((spell.dmg_high + spell.dmg_low) / 2) * spell.multiplier;

      let dotDmg = 0;
      let ticksRealized = 0;

      if (spell.dot) {
        ticksRealized = spell.duration! <= this.fightInfo!.duration ? Math.floor(spell.duration! / spell.interval!) : Math.floor(this.fightInfo!.duration / spell.interval!)
        dotDmg = ((spell.dot_dmg_high! + spell.dot_dmg_low!) / 2) * ticksRealized;

      }
      let targetsHit = 0;

      //if no cap on mobs
      if (!spell.max_targets) {
        spell.max_targets === 100000;
      }


      //determine number of mobs affected by spell
      if (spell.type === 'st') {
        targetsHit = 1;
      } else if (spell.type === 'enc') {
        targetsHit = spell.max_targets! < this.fightInfo!.linked_mobs ? spell.max_targets! : this.fightInfo!.linked_mobs
      } else if (spell.type === 'aoe') {
        targetsHit = spell.max_targets! < this.fightInfo!.total_mobs ? spell.max_targets! : this.fightInfo!.total_mobs
      }

      let totalDmg = (initDmg + dotDmg) * targetsHit;

      const dps = totalDmg / (spell.ct + spell.rs)

      //todo: change ticks to interval, add spell duration, and factor in fight duration

      const spellDPS = { name: spell.name, dps, show_card: false, ticks: ticksRealized, targets_hit: targetsHit, is_dot: spell.dot  }

      this.spellDPSArray.push(spellDPS);

    });
    this.spellDPSArray.sort((a: SpellDPS, b: SpellDPS) => b.dps - a.dps);

    this.fightForm.reset({
      duration: 0,
      total_mobs: 1,
      linked_mobs: 1,
    });

  }

  addSpell(): void {
    if (this.spellForm.invalid) {
      this.spellForm.markAllAsTouched();
      return;
    }
    const spell = this.spellForm.value as Spell;

    this.spellArray.push(spell);
    this.spellForm.reset({
      name: '',
      ct: 0,
      cd: 10,
      dot: false,
      dot_dmg_low: 0,
      dot_dmg_high: 0,
      duration: 0,
      interval: 0,
      multiplier: 1,
      dmg_low: 0,
      dmg_high: 0,
      type: 'st',
      max_targets: null
    });
  }

  removeSpell(ind: number) {
    const rmSpell = this.spellArray.splice(ind, 1)[0];

    const rmSpellDPSInd = this.spellDPSArray.findIndex(x => x.name = rmSpell.name);
    this.spellDPSArray.splice(rmSpellDPSInd, 1);
  }

  linkedGreaterThanTotal(): ValidatorFn {
    return (): ValidationErrors | null => {

      const totalMobs = this.fightForm?.controls['total_mobs'];
      const linkedMobs = this.fightForm?.controls['linked_mobs'];

      if (linkedMobs?.value > totalMobs?.value) {
        totalMobs.setValue(linkedMobs.value)


        if(linkedMobs.touched || totalMobs.touched) {
          linkedMobs.markAsTouched();
          totalMobs.markAsTouched();
        }

        // return { fgMobsError: true }
        }

        // if (linkedMobs && totalMobs) {
        //   linkedMobs.setErrors(null)
        //   totalMobs.setErrors(null)
        // }

      return null;
    };
  }

  dotValidator(): ValidatorFn {
    return (): ValidationErrors | null => {

      if (this.spellForm?.controls['dot'].value === true) {
        this.spellForm?.controls['duration'].enable();
        this.spellForm?.controls['interval'].enable();
        this.spellForm?.controls['dot_dmg_low'].enable();
        this.spellForm?.controls['dot_dmg_high'].enable();

      } else {
        this.spellForm?.controls['duration'].disable();
        this.spellForm?.controls['interval'].disable();
        this.spellForm?.controls['dot_dmg_low'].disable();
        this.spellForm?.controls['dot_dmg_high'].disable();
      }

      return null;
    };
  }

  dotIntervalDuration(): ValidatorFn {
    return (): ValidationErrors | null => {

      if(this.spellForm?.controls['interval'].value > this.spellForm?.controls['duration'].value){
        this.addCustomError(this.spellForm?.controls['interval'], { intervalGreaterThanDuration: true });
        this.addCustomError(this.spellForm?.controls['duration'], { intervalGreaterThanDuration: true });

        if(this.spellForm?.controls['interval'].touched || this.spellForm?.controls['duration'].touched) {
          this.spellForm?.controls['interval'].markAsTouched();
          this.spellForm?.controls['duration'].markAsTouched();
        }

        return { fgError: true }
        }

        if (this.spellForm?.controls['interval'] && this.spellForm?.controls['duration']) {
          this.spellForm?.controls['interval'].setErrors(null)
          this.spellForm?.controls['duration'].setErrors(null)
        }

      return null;
    };
  }

   addCustomError(control: AbstractControl, error: Record<string, any>): void {
    if (control.errors) {
      Object.assign(control.errors, error);
    } else {
      control.setErrors(error);
    }
  }
}

interface Spell {
  name: string;
  cd: number;
  rs: number;
  ct: number;
  dot: boolean;
  dot_dmg_low?: number;
  dot_dmg_high?: number;
  duration?: number;
  interval?: number;
  dmg_low: number;
  dmg_high: number;
  multiplier: number;
  type: 'st' | 'enc' | 'aoe';
  max_targets?: number;
  show_card: boolean;
}

interface SpellDPS {
  name: string;
  dps: number;
  show_card: boolean;
  ticks: number;
  targets_hit: number;
  is_dot:boolean;
}

interface FightInfo {
  duration: number;
  total_mobs: number;
  linked_mobs: number;
}
