EQ2 Census API — Spell Data Summary
API Overview
The EverQuest 2 spell data is served through the Daybreak Census API, a RESTful service returning JSON or XML. The base endpoint is:
https://census.daybreakgames.com/s:{serviceId}/get/eq2/
The project service ID is reedpatterson.

The spell Collection
The primary collection for spell data is spell. All spell queries follow this base pattern:
https://census.daybreakgames.com/s:reedpatterson/get/eq2/spell/?{filters}&{commands}
Key fields on a spell record:

name — display name of the spell
level — level the spell is granted
tier / tier_name — quality tier (e.g. Apprentice, Journeyman, Adept, Expert, Master, Grandmaster)
type — category: spells (mage/priest), arts (fighter/scout combat arts), tradeskills, ascension, etc.
given_by — how the spell is obtained; use class to get base class spells. Other values: alternateadvancement, spellscroll, classtraining, warderspell, race, etc.
classes — object keyed by lowercase class name (e.g. classes.wizard, classes.templar), each containing displayname, id, and level
effect_list — array of effect descriptions
description — plain text spell description
cast_secs_hundredths — cast time in hundredths of a second
recast_secs — recast/cooldown in seconds
cost — object with power, health, concentration, etc.
target_type — e.g. self, enemy, friend
duration — object with min_sec_tenths, max_sec_tenths, does_not_expire
crc — shared identifier across tiers of the same spell (different tiers share a CRC but have different ids)
beneficial — 1 if beneficial, 0 if offensive
alternate_advancement — 1 if this is an AA ability


Querying Class Spells
To get all base class spells for a specific class (e.g. Wizard):
https://census.daybreakgames.com/s:reedpatterson/get/eq2/spell/?given_by=class&type=spells&c:has=classes.wizard&c:limit=100&c:show=name,level,tier_name,classes,effect_list,cast_secs_hundredths,recast_secs,cost,target_type,description

For fighter/scout classes, use type=arts instead of type=spells
Class name in c:has must be lowercase (e.g. classes.berserker, classes.templar)
Paginate using c:start=100, c:start=200, etc.


Query Commands Reference
CommandPurposec:limit=NMax results to returnc:start=NPagination offsetc:show=field1,field2Return only specified fieldsc:has=fieldFilter to records where field existsc:distinct=fieldGet all distinct values for a fieldc:sort=field:1 or :−1Sort ascending/descending
Search modifiers (prepended to values):

] = greater than or equal (e.g. level=]50)
[ = less than or equal (e.g. level=[50)
^ = starts with
* = contains
! = not equal


Server / Ruleset Differences (Live vs TLE vs Origins)
The spell collection is global — there is no per-server flag in the data. Server differences must be handled at the application layer:

TLE servers are expansion-locked; filter by level=[N where N is the level cap of the unlocked expansion to approximate available spells
Origins may have its own Census considerations (Daybreak has an official forum thread on this, worth investigating)
Character location can be queried via locationdata.world on the character collection to identify which server a character is on


