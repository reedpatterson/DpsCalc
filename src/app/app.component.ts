import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

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

  //{ type: 'st', ct: 1, dmg_high: 2, dmg_low:1, name: 'fireball', max_targets: 1},
  //{ type: 'st', ct: 1, dmg_high: 2, dmg_low:1, name: 'icestorm', max_targets: 1}

  public spellForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    ct: new FormControl(0, [Validators.required, Validators.min(.1)]),
    cd: new FormControl(0, [Validators.required, Validators.min(.1)]),
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
  });

  public fightForm = new FormGroup({
    duration: new FormControl(0, [Validators.required, Validators.min(.1)]),
    total_mobs: new FormControl(0, [Validators.required, Validators.min(1)]),
    linked_mobs: new FormControl(0, [this.linkedGreaterThanTotal()]),
  });

  ngOnInit(): void {

  }

  calculateDPS(): void {
    if(this.fightForm.invalid) {
      this.fightForm.markAllAsTouched();
      return;
    }

    this.spellDPSArray = [];

    const fightInfo: FightInfo = this.fightForm.value;

    this.spellArray.forEach(spell => {
      let initDmg = ((spell.dmg_high + spell.dmg_low)/2)*spell.multiplier;
      let dotDmg = 0;

      if(spell.dot) {
        const ticksRealized = spell.duration! <= fightInfo.duration ? spell.duration!%spell.interval! : fightInfo.duration%spell.interval!
        dotDmg = ((spell.dot_dmg_high! + spell.dot_dmg_low!)/2)*ticksRealized;
      }
      let targetsHit = 0;

      //if no cap on mobs
      if(!spell.max_targets) {
        spell.max_targets === 100000;
      }


      //determine number of mobs affected by spell
      if( spell.type === 'st') {
        targetsHit = 1;
      } else if (spell.type === 'enc') {
        targetsHit = spell.max_targets! < fightInfo.linked_mobs ? spell.max_targets! : fightInfo.linked_mobs
      } else if ( spell.type === 'aoe') {
        targetsHit = spell.max_targets! < fightInfo.total_mobs ? spell.max_targets! : fightInfo.total_mobs
      }

      let totalDmg = (initDmg + dotDmg) * targetsHit;

      const dps = totalDmg/spell.ct

      //todo: change ticks to interval, add spell duration, and factor in fight duration

      this.spellDPSArray.push({ name: spell.name, dps });

    });
    this.spellDPSArray.sort((a: SpellDPS, b: SpellDPS) => b.dps - a.dps);

    this.fightForm.reset();

  }

  addSpell(): void {
    if(this.spellForm.invalid) {
      this.spellForm.markAllAsTouched();
      return;
    }
    const spell = this.spellForm.value as Spell;

    this.spellArray.push(spell);
    this.spellForm.reset();
  }

  removeSpell(ind: number) {
    const rmSpell = this.spellArray.splice(ind, 1)[0];

    const rmSpellDPSInd = this.spellDPSArray.findIndex(x => x.name = rmSpell.name);
    this.spellDPSArray.splice(rmSpellDPSInd, 1);
  }

  linkedGreaterThanTotal(): ValidatorFn {
    return (): ValidationErrors | null => {

        const totalMobs = this.fightForm?.controls['total_mobs'].value;
        const linkedMobs = this.fightForm?.controls['linked_mobs'].value;

        if(linkedMobs > totalMobs) {
          return { linkedGreaterThanTotal: true}
        }

      return null;
    };
  }

  dotValidator(): ValidatorFn {
    return (): ValidationErrors | null => {

      if(this.spellForm?.controls['dot'].value === true) {
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
}

interface Spell {
  name: string;
  cd: number;
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
}

interface SpellDPS {
  name: string;
  dps: number;
}

interface FightInfo {
  duration: number;
  total_mobs: number;
  linked_mobs: number;
}
