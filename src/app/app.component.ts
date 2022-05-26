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

  spellArray: Spell[] = [{ type: 'st', ticks: 1, ct: 1, dmg_high: 2, dmg_low:1, name: 'fireball', max_targets: 1},
  { type: 'st', ticks: 1, ct: 1, dmg_high: 2, dmg_low:1, name: 'icestorm', max_targets: 1}];
  spellDPSArray: SpellDPS[] = [];

  public spellForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    ticks: new FormControl(1, [Validators.required, Validators.min(1)]),
    ct: new FormControl(0, [Validators.required, Validators.min(.1)]),
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
    this.spellForm.markAllAsTouched();
    this.fightForm.markAllAsTouched();

    const fightInfo: FightInfo = this.fightForm.value;

    this.spellArray.forEach(spell => {
      let totalDmg = (spell.dmg_high + spell.dmg_low)/2
      let targetsHit = 0;

      //if no cap on mobs
      if(!spell.max_targets) {
        spell.max_targets === 100000;
      }
    

      if( spell.type === 'st') {
        targetsHit === 1;
      } else if (spell.type === 'enc') {
        targetsHit = spell.max_targets! < fightInfo.linked_mobs ? spell.max_targets! : fightInfo.linked_mobs
      } else if ( spell.type === 'aoe') {
        targetsHit = spell.max_targets! < fightInfo.total_mobs ? spell.max_targets! : fightInfo.total_mobs
      }

      totalDmg = totalDmg*spell.ticks*targetsHit;

      //todo: change ticks to interval, add spell duration, and factor in fight duration

      this.spellDPSArray.push({ name: spell.name, dps: totalDmg });
    });


  }

  addSpell(): void {
    this.spellForm.markAllAsTouched();
    const spell = this.spellForm.value as Spell;

    this.spellArray.push(spell);
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
}

interface Spell {
  name: string;
  ticks: number;
  ct: number;
  dmg_low: number;
  dmg_high: number;
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