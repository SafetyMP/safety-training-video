/**
 * EHS (Environmental, Health & Safety) reference library.
 *
 * Use to augment OpenAI prompts with accurate facts and to validate generated
 * content (terminology, myths to avoid, recommended points to cover).
 *
 * Usage:
 * - Augment: getContextForPrompt(userPrompt) → inject into system prompt.
 * - Check: validateContentAgainstReference(scriptText, { topicIds }) → warnings,
 *   terminology suggestions, myths flagged, missing recommendations.
 * - Lookup: getTopicsForPrompt(prompt), getAllEHSTopics().
 *
 * @see OSHA regulations, ANSI standards, and industry best practices.
 */

/** Single EHS topic with facts, practices, and validation hints. */
export interface EHSTopic {
  id: string;
  label: string;
  keywords: string[];
  keyFacts: string[];
  bestPractices: string[];
  commonHazards: string[];
  regulatoryRefs: { name: string; ref?: string }[];
  /** Preferred terms and phrases to use; avoid alternatives when possible. */
  correctTerminology: { preferred: string; avoid?: string[] }[];
  /** Phrases or claims that are wrong or misleading; flag if present. */
  mythsOrAvoid: string[];
  /** Recommended points to mention; used for optional "should include" checks. */
  shouldMention: string[];
  /** Relevant standard sign types (from safety-signs-reference). */
  signsRelevant?: string[];
}

/** Result of validating content against the EHS reference. */
export interface EHSValidationResult {
  topicIds: string[];
  warnings: string[];
  terminologySuggestions: { found: string; prefer: string }[];
  mythsFlagged: string[];
  missingRecommendations: string[];
}

const EHS_TOPICS: EHSTopic[] = [
  {
    id: 'forklift',
    label: 'Forklift / powered industrial truck safety',
    keywords: ['forklift', 'fork lift', 'powered industrial truck', 'PIT', 'pallet', 'warehouse', 'loading dock', 'lift truck'],
    keyFacts: [
      'Only trained and certified operators may operate forklifts (OSHA 1910.178(l)).',
      'Pre-operation inspection, traveling/maneuvering, and load handling are the three critical phases.',
      'Employers must ensure competency and provide refresher training as needed.',
    ],
    bestPractices: [
      'Sound the horn at blind corners, intersections, and when approaching pedestrians.',
      'Look in the direction of travel; slow down near pedestrians and in congested areas.',
      'Conduct a pre-use inspection before each shift (brakes, steering, horn, tires, forks).',
      'Never exceed rated capacity; keep loads low and stable when traveling.',
      'Use spotters when visibility is limited; ensure pedestrians stay clear.',
    ],
    commonHazards: [
      'Tip-overs from speeding, sharp turns, or overloaded/uneven loads.',
      'Struck-by incidents when pedestrians are in the path of travel.',
      'Falls from elevated forks; never use forks as a personnel platform unless designed for it.',
      'Collisions at blind spots, dock edges, and congested aisles.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1910.178', ref: 'Powered industrial trucks' },
      { name: '29 CFR 1910.178(l)', ref: 'Training requirements' },
    ],
    correctTerminology: [
      { preferred: 'forklift', avoid: ['fork lift'] },
      { preferred: 'powered industrial truck', avoid: [] },
      { preferred: 'pre-operation inspection', avoid: ['pre-op check'] },
      { preferred: 'rated capacity', avoid: ['max weight'] },
    ],
    mythsOrAvoid: [
      'Forklifts are safe to use without training.',
      'It is okay to give a coworker a ride on the forks.',
      'You can use the forks as a personnel lift without an approved platform.',
    ],
    shouldMention: ['horn', 'pedestrian', 'inspection', 'speed', 'capacity', 'blind'],
    signsRelevant: ['HARD HAT AREA', 'KEEP CLEAR', 'AUTHORIZED PERSONNEL ONLY'],
  },
  {
    id: 'slip-trip-fall',
    label: 'Slip, trip, and fall hazards',
    keywords: ['slip', 'trip', 'fall', 'walkway', 'aisle', 'housekeeping', 'wet floor', 'spill', 'footwear', 'clear', 'obstruction'],
    keyFacts: [
      'OSHA 1910.22 requires walking-working surfaces to be kept clean, dry, and free of hazards.',
      'Aisles and passageways must be kept clear and in good repair.',
      'Employers must maintain workplaces in a condition that prevents slip, trip, and fall injuries.',
    ],
    bestPractices: [
      'Clean up spills promptly; use wet-floor signs until the area is dry.',
      'Keep walkways and aisles clear of obstructions, cords, and clutter.',
      'Wear appropriate footwear for the surface (slip-resistant where needed).',
      'Report damaged flooring, loose mats, or poor lighting.',
      'Use proper storage; avoid placing objects in walkways.',
    ],
    commonHazards: [
      'Wet or greasy floors, especially in kitchens, wash areas, and entrances.',
      'Cords, hoses, and clutter in walkways.',
      'Uneven flooring, loose mats, or missing guardrails on elevated surfaces.',
      'Poor lighting and obscured steps or ramps.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1910.22', ref: 'Walking-working surfaces, general requirements' },
      { name: '1910 Subpart D', ref: 'Walking-Working Surfaces' },
    ],
    correctTerminology: [
      { preferred: 'slip, trip, and fall', avoid: ['slip and fall only'] },
      { preferred: 'walking-working surface', avoid: [] },
      { preferred: 'wet floor', avoid: [] },
    ],
    mythsOrAvoid: [
      'Minor spills can wait; cleaning is only for big messes.',
      'Mats and rugs do not need to be secured.',
    ],
    shouldMention: ['spill', 'walkway', 'clear', 'footwear', 'housekeeping', 'sign'],
    signsRelevant: ['WET FLOOR', 'CAUTION', 'SLIPPERY WHEN WET'],
  },
  {
    id: 'ppe',
    label: 'Personal protective equipment (PPE)',
    keywords: ['PPE', 'personal protective equipment', 'hard hat', 'safety glasses', 'gloves', 'high-vis', 'vest', 'hearing protection', 'respirator'],
    keyFacts: [
      'Employers must assess the workplace for hazards and provide appropriate PPE (OSHA 1910.132).',
      'PPE must be used, maintained, and stored properly; it is the last line of defense.',
      'Engineering and work-practice controls should be used first; PPE supplements them when needed.',
    ],
    bestPractices: [
      'Wear PPE required for your area: hard hat, safety glasses, high-vis vest, etc., as posted.',
      'Inspect PPE before use; replace damaged or worn equipment.',
      'Use the right PPE for the hazard (e.g., impact vs. chemical gloves).',
      'Store PPE clean and in good condition; do not modify it.',
    ],
    commonHazards: [
      'Head injury from falling objects or overhead work; eye injury from flying particles or splashes.',
      'Struck-by incidents in traffic or machinery areas without high-visibility clothing.',
      'Hearing loss in high-noise areas without hearing protection.',
      'Hand injury from cuts, punctures, or chemicals without suitable gloves.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1910.132', ref: 'General PPE requirements' },
      { name: '1910 Subpart I', ref: 'Personal Protective Equipment' },
    ],
    correctTerminology: [
      { preferred: 'safety glasses', avoid: ['goggles'] },
      { preferred: 'hearing protection', avoid: ['earplugs'] },
      { preferred: 'high-visibility', avoid: ['high vis'] },
    ],
    mythsOrAvoid: [
      'PPE alone is enough; no need for other controls.',
      'One type of gloves works for all chemicals.',
    ],
    shouldMention: ['hard hat', 'safety glasses', 'vest', 'assess', 'hazard', 'required'],
    signsRelevant: ['PPE REQUIRED', 'EYE PROTECTION REQUIRED', 'HEARING PROTECTION REQUIRED', 'HARD HAT AREA'],
  },
  {
    id: 'fire-evacuation',
    label: 'Fire evacuation and emergency egress',
    keywords: ['fire', 'evacuation', 'evacuate', 'exit', 'emergency', 'assembly', 'meeting point', 'egress', 'alarm', 'extinguisher'],
    keyFacts: [
      'Emergency action plans (EAPs) under 29 CFR 1910.38 must include evacuation procedures and escape routes.',
      'Do not use elevators during a fire; use designated stairwells and exits.',
      'Know your primary and secondary exits and the designated assembly point outside.',
    ],
    bestPractices: [
      'Know the location of exits, pull stations, and fire extinguishers before an emergency.',
      'When the alarm sounds, leave immediately via the nearest safe exit; close doors behind you.',
      'Assemble at the designated meeting point; never re-enter until cleared.',
      'Participate in drills; follow your evacuation route and assist visitors if trained.',
    ],
    commonHazards: [
      'Using elevators during a fire; blocked or locked exits.',
      'Ignoring alarms or delaying evacuation.',
      'Re-entering the building before officials declare it safe.',
      'Not knowing the assembly point or alternate routes.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1910.38', ref: 'Emergency action plans' },
      { name: 'OSHA 1910.36', ref: 'Exit route design and construction' },
    ],
    correctTerminology: [
      { preferred: 'assembly point', avoid: ['meeting point'] },
      { preferred: 'emergency exit', avoid: [] },
      { preferred: 'do not use elevators during a fire', avoid: ['never use elevators'] },
    ],
    mythsOrAvoid: [
      'Elevators are safe during a fire.',
      'You should grab personal belongings before evacuating.',
    ],
    shouldMention: ['exit', 'elevator', 'assembly', 'alarm', 'drill'],
    signsRelevant: ['EXIT', 'EMERGENCY EXIT', 'FIRE EXTINGUISHER', 'NO SMOKING'],
  },
  {
    id: 'lockout-tagout',
    label: 'Lockout/tagout (LOTO)',
    keywords: ['lockout', 'tagout', 'LOTO', 'energy isolation', 'zero energy', 'machine guarding', 'maintenance', 'repair'],
    keyFacts: [
      'OSHA 1910.147 requires lockout/tagout to control hazardous energy during servicing and maintenance.',
      'Only authorized employees may perform LOTO; affected employees must never bypass or remove locks.',
      'All energy sources must be isolated and verified before work begins.',
    ],
    bestPractices: [
      'Follow the written LOTO procedure for each piece of equipment.',
      'Apply your own lock and tag; never remove another person’s lock.',
      'Verify zero energy (e.g., try the start button) after isolation and before work.',
      'Remove locks only after the authorized person who applied them has finished and cleared the area.',
    ],
    commonHazards: [
      'Unexpected startup or release of stored energy during service.',
      'Bypassing or removing LOTO devices; working under someone else’s lock.',
      'Incomplete isolation (e.g., forgetting pneumatic or hydraulic energy).',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1910.147', ref: 'The control of hazardous energy (lockout/tagout)' },
    ],
    correctTerminology: [
      { preferred: 'lockout/tagout', avoid: ['lock-out tag-out'] },
      { preferred: 'authorized employee', avoid: [] },
      { preferred: 'zero energy', avoid: ['off'] },
    ],
    mythsOrAvoid: [
      'Turning off the power is enough; no lockout needed.',
      'You can remove someone else’s lock if they are not around.',
    ],
    shouldMention: ['lock', 'tag', 'isolate', 'authorized', 'verify'],
    signsRelevant: ['DANGER', 'AUTHORIZED PERSONNEL ONLY'],
  },
  {
    id: 'hazard-communication',
    label: 'Hazard communication (GHS)',
    keywords: ['hazcom', 'GHS', 'SDS', 'safety data sheet', 'chemical', 'label', 'HAZCOM', 'hazard communication'],
    keyFacts: [
      'OSHA 1910.1200 requires a written hazard communication program, labels, and SDS access.',
      'Globally Harmonized System (GHS) labels include pictograms, signal words, and hazard statements.',
      'Employees must have access to SDSs and training on chemical hazards in their work areas.',
    ],
    bestPractices: [
      'Read labels and SDSs before using a chemical; follow storage and handling instructions.',
      'Use proper PPE as stated on the label or SDS.',
      'Do not mix chemicals unless trained and authorized; keep containers closed when not in use.',
      'Report missing or damaged labels; do not use unlabeled containers.',
    ],
    commonHazards: [
      'Exposure to toxic, corrosive, or flammable chemicals without proper PPE or ventilation.',
      'Mixing incompatible chemicals; ingestion or skin contact from poor hygiene.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1910.1200', ref: 'Hazard communication' },
    ],
    correctTerminology: [
      { preferred: 'Safety Data Sheet', avoid: ['MSDS'] },
      { preferred: 'GHS', avoid: [] },
      { preferred: 'hazard communication', avoid: ['hazcom'] },
    ],
    mythsOrAvoid: [
      'MSDS is the current term; OSHA now requires SDS.',
      'If a chemical is familiar, you do not need to check the SDS.',
    ],
    shouldMention: ['SDS', 'label', 'GHS', 'chemical', 'PPE'],
    signsRelevant: ['WARNING', 'DANGER', 'CAUTION', 'PPE REQUIRED'],
  },
  {
    id: 'confined-space',
    label: 'Confined space entry',
    keywords: ['confined space', 'permit required', 'entry', 'tank', 'vessel', 'silo', 'manhole', 'atmosphere', 'entrant', 'attendant'],
    keyFacts: [
      'OSHA 1910.146 defines permit-required confined spaces; entry requires a written program, permit, and trained entrants/attendants.',
      'Hazards include atmospheric (oxygen deficiency, flammable, toxic), engulfment, and physical hazards.',
      'Rescue procedures and retrieval equipment must be in place before entry.',
    ],
    bestPractices: [
      'Never enter a permit-required confined space without a valid permit and attendant.',
      'Test atmosphere before entry and continuously monitor; exit if levels are unsafe.',
      'Use proper ventilation, PPE, and retrieval equipment as specified in the permit.',
    ],
    commonHazards: [
      'Oxygen-deficient or toxic atmospheres; flammable or explosive vapors.',
      'Engulfment in grain, sand, or liquids; entrapment in machinery.',
      'Falls, poor visibility, and difficult rescue access.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1910.146', ref: 'Permit-required confined spaces' },
    ],
    correctTerminology: [
      { preferred: 'permit-required confined space', avoid: ['confined space only'] },
      { preferred: 'attendant', avoid: ['spotter'] },
      { preferred: 'entrant', avoid: [] },
    ],
    mythsOrAvoid: [
      'A quick entry without a permit is acceptable for routine tasks.',
      'Atmospheric testing once at the start is sufficient.',
    ],
    shouldMention: ['permit', 'atmosphere', 'attendant', 'rescue', 'ventilation'],
    signsRelevant: ['DANGER', 'PERMIT REQUIRED', 'CONFINED SPACE'],
  },
  {
    id: 'fall-protection',
    label: 'Fall protection',
    keywords: ['fall protection', 'fall arrest', 'guardrail', 'harness', 'lanyard', 'anchorage', 'leading edge', 'roof', 'elevated', 'ladder'],
    keyFacts: [
      'OSHA 1910.140 requires fall protection when working 4 feet or more above a lower level (general industry); 6 feet in construction.',
      'Fall protection systems include guardrails, safety nets, and personal fall arrest systems (PFAS).',
      'Anchorages must support 5,000 lbs per attached worker; harnesses must be inspected before use.',
    ],
    bestPractices: [
      'Use guardrails, safety nets, or PFAS when working at heights.',
      'Inspect harness, lanyard, and anchorage before each use; use 100% tie-off when moving.',
      'Keep the free fall distance as short as possible; ensure clearance below for arrest.',
    ],
    commonHazards: [
      'Unprotected sides and edges; holes and openings; leading edges.',
      'Unstable ladders and scaffolds; improper anchorage.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1910.140', ref: 'Fall protection' },
      { name: 'OSHA 1926 Subpart M', ref: 'Fall protection (construction)' },
    ],
    correctTerminology: [
      { preferred: 'personal fall arrest system', avoid: ['harness system'] },
      { preferred: 'fall protection', avoid: [] },
      { preferred: '100% tie-off', avoid: [] },
    ],
    mythsOrAvoid: [
      'Fall protection is only needed on construction sites.',
      'A body belt is sufficient for fall arrest (use full-body harness).',
    ],
    shouldMention: ['harness', 'guardrail', 'anchorage', 'inspect', 'height'],
    signsRelevant: ['DANGER', 'FALL HAZARD', 'HARD HAT AREA'],
  },
  {
    id: 'electrical',
    label: 'Electrical safety',
    keywords: ['electrical', 'electrocution', 'shock', 'arc flash', 'live wire', 'lockout', 'qualified', 'volt', 'extension cord', 'GFCI'],
    keyFacts: [
      'OSHA 1910 Subpart S covers electrical safety; only qualified persons may work on exposed energized parts.',
      'Lockout/tagout applies to electrical energy; verify de-energized before work.',
      'Arc flash hazards require appropriate PPE and boundaries per NFPA 70E.',
    ],
    bestPractices: [
      'Assume all circuits are live until verified de-energized and locked out.',
      'Use GFCI for portable tools in wet or damp areas; inspect cords for damage.',
      'Maintain safe approach distances; use proper voltage-rated tools and PPE.',
    ],
    commonHazards: [
      'Contact with live parts; arc flash and arc blast.',
      'Damaged cords, overloaded circuits, wet conditions.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1910.303–399', ref: 'Electrical, Subpart S' },
      { name: 'NFPA 70E', ref: 'Electrical safety in the workplace' },
    ],
    correctTerminology: [
      { preferred: 'qualified person', avoid: ['electrician only'] },
      { preferred: 'GFCI', avoid: [] },
      { preferred: 'arc flash', avoid: [] },
    ],
    mythsOrAvoid: [
      'Low voltage cannot kill; 120V is safe.',
      'Rubber gloves alone protect from electrical shock.',
    ],
    shouldMention: ['lockout', 'qualified', 'cord', 'GFCI', 'inspect'],
    signsRelevant: ['DANGER', 'HIGH VOLTAGE', 'ELECTRICAL HAZARD'],
  },
  {
    id: 'machine-guarding',
    label: 'Machine guarding',
    keywords: ['machine guard', 'guarding', 'point of operation', 'nip point', 'rotating', 'in-running', 'safeguard', 'press', 'saw'],
    keyFacts: [
      'OSHA 1910.212 requires machines to be guarded to protect from point-of-operation, in-running nip points, and rotating parts.',
      'Guards must be in place and functioning; never remove or bypass guards without proper procedures.',
      'Training on hazards and safe work practices is required for machine operators.',
    ],
    bestPractices: [
      'Keep guards in place during operation; report damaged or missing guards immediately.',
      'Use proper feeding tools; never reach into the point of operation while the machine is running.',
      'Follow lockout procedures when performing maintenance or clearing jams.',
    ],
    commonHazards: [
      'Contact with moving parts, pinch points, and cutting edges.',
      'Flying chips and sparks; ejection of material.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1910.212', ref: 'General requirements for machine guarding' },
      { name: 'OSHA 1910.219', ref: 'Mechanical power-transmission apparatus' },
    ],
    correctTerminology: [
      { preferred: 'point of operation', avoid: [] },
      { preferred: 'machine guard', avoid: ['guard only'] },
    ],
    mythsOrAvoid: [
      'Guards slow down production; it is okay to run without them for short tasks.',
      'Gloves protect hands from moving machinery (they can increase entanglement risk).',
    ],
    shouldMention: ['guard', 'point of operation', 'lockout', 'inspect'],
    signsRelevant: ['DANGER', 'KEEP HANDS CLEAR', 'MACHINE GUARD'],
  },
  {
    id: 'ergonomics',
    label: 'Ergonomics and musculoskeletal disorders',
    keywords: ['ergonomics', 'MSD', 'musculoskeletal', 'lifting', 'repetitive', 'strain', 'posture', 'workstation', 'back injury', 'overexertion'],
    keyFacts: [
      'Musculoskeletal disorders (MSDs) are among the most common workplace injuries; ergonomics can reduce risk.',
      'OSHA provides voluntary guidelines; some states have ergonomics rules.',
      'Proper lifting technique, workstation design, and rest breaks reduce MSD risk.',
    ],
    bestPractices: [
      'Use proper lifting technique: bend knees, keep load close, avoid twisting.',
      'Adjust workstations for height and reach; use ergonomic tools where available.',
      'Take short breaks; vary tasks; ask for help with heavy or awkward loads.',
    ],
    commonHazards: [
      'Overexertion from lifting, pushing, or pulling; repetitive motion.',
      'Awkward postures; prolonged sitting or standing; vibration.',
    ],
    regulatoryRefs: [
      { name: 'OSHA guidelines', ref: 'Ergonomics' },
    ],
    correctTerminology: [
      { preferred: 'musculoskeletal disorder', avoid: ['MSD only on first use'] },
      { preferred: 'ergonomics', avoid: [] },
    ],
    mythsOrAvoid: [
      'Back belts prevent lifting injuries (evidence is limited; proper technique matters more).',
      'Ergonomics is only for office workers.',
    ],
    shouldMention: ['lift', 'posture', 'breaks', 'assistance'],
    signsRelevant: ['CAUTION', 'LIFT PROPERLY'],
  },
  {
    id: 'bloodborne-pathogens',
    label: 'Bloodborne pathogens',
    keywords: ['bloodborne', 'pathogen', 'needlestick', 'sharps', 'universal precautions', 'BBP', 'hepatitis', 'HIV', 'exposure', 'biohazard'],
    keyFacts: [
      'OSHA 1910.1030 requires a written exposure control plan, training, and PPE for occupational exposure to blood or OPIM.',
      'Universal precautions treat all blood and body fluids as potentially infectious.',
      'Sharps must be disposed of in puncture-resistant containers; never recap needles.',
    ],
    bestPractices: [
      'Use appropriate PPE (gloves, face shields) when exposure is possible.',
      'Dispose of sharps in designated containers immediately after use.',
      'Wash hands and report any exposure incident; follow post-exposure protocols.',
    ],
    commonHazards: [
      'Needlesticks and cuts from contaminated sharps.',
      'Splash or contact with blood or body fluids; improper disposal.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1910.1030', ref: 'Bloodborne pathogens' },
    ],
    correctTerminology: [
      { preferred: 'universal precautions', avoid: [] },
      { preferred: 'OPIM', avoid: [] },
      { preferred: 'bloodborne pathogens', avoid: ['BBP only on first use'] },
    ],
    mythsOrAvoid: [
      'Recapping needles by hand is acceptable if done carefully.',
      'HIV and hepatitis are easily transmitted through casual contact.',
    ],
    shouldMention: ['gloves', 'sharps', 'dispose', 'report', 'PPE'],
    signsRelevant: ['BIOHAZARD', 'WARNING', 'BLOODBORNE PATHOGENS'],
  },
  {
    id: 'respiratory-protection',
    label: 'Respiratory protection',
    keywords: ['respirator', 'respiratory', 'fit test', 'N95', 'cartridge', 'SCBA', 'airborne', 'dust', 'fume', 'vapor'],
    keyFacts: [
      'OSHA 1910.134 requires a written respiratory protection program, medical evaluation, and fit testing.',
      'Respirators must be appropriate for the hazard; cartridge change schedules apply.',
      'Clean-shaven face is required for tight-fitting respirators; beard breaks the seal.',
    ],
    bestPractices: [
      'Use only respirators assigned to you; perform seal check each time you don.',
      'Replace cartridges per schedule or when breakthrough is detected; store properly.',
      'Report medical symptoms that may affect respirator use.',
    ],
    commonHazards: [
      'Inhalation of dust, fumes, vapors, or gases without adequate protection.',
      'Improper fit, defective seal, or wrong cartridge for the hazard.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1910.134', ref: 'Respiratory protection' },
    ],
    correctTerminology: [
      { preferred: 'fit test', avoid: [] },
      { preferred: 'respirator', avoid: ['mask'] },
    ],
    mythsOrAvoid: [
      'Any dust mask provides adequate protection for hazardous atmospheres.',
      'Beards are fine with respirators if you pull the straps tight.',
    ],
    shouldMention: ['fit test', 'cartridge', 'seal', 'medical'],
    signsRelevant: ['RESPIRATORY PROTECTION REQUIRED', 'RESPIRATOR REQUIRED'],
  },
  {
    id: 'hearing-conservation',
    label: 'Hearing conservation',
    keywords: ['hearing', 'noise', 'decibel', 'dB', 'earplug', 'ear muff', 'hearing protection', 'TWA', 'audiogram'],
    keyFacts: [
      'OSHA 1910.95 requires a hearing conservation program when noise exposure equals or exceeds 85 dBA 8-hour TWA.',
      'Hearing protection must reduce exposure to within limits; proper fit is critical.',
      'Annual audiograms and training are required for exposed employees.',
    ],
    bestPractices: [
      'Wear hearing protection in designated areas; insert earplugs correctly for a proper seal.',
      'Report ringing in ears or difficulty hearing; participate in audiometric testing.',
      'Reduce noise at the source when possible; limit time in high-noise areas.',
    ],
    commonHazards: [
      'Permanent hearing loss from prolonged or repeated exposure to high noise.',
      'Tinnitus; communication difficulties; increased risk of accidents.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1910.95', ref: 'Occupational noise exposure' },
    ],
    correctTerminology: [
      { preferred: 'hearing protection', avoid: ['earplugs only'] },
      { preferred: 'TWA', avoid: [] },
    ],
    mythsOrAvoid: [
      'Earplugs slightly in the ear provide adequate protection.',
      'Hearing loss from noise is reversible.',
    ],
    shouldMention: ['hearing protection', 'noise', 'fit', 'audiogram'],
    signsRelevant: ['HEARING PROTECTION REQUIRED', 'NOISE HAZARD'],
  },
  {
    id: 'welding-hot-work',
    label: 'Welding and hot work',
    keywords: ['welding', 'welder', 'hot work', 'cutting', 'torch', 'spark', 'permit', 'fire watch', 'ventilation', 'fume'],
    keyFacts: [
      'OSHA 1910.252 requires fire prevention for welding, cutting, and brazing; hot work permits may be required.',
      'A fire watch must be present during and after hot work until the area is safe.',
      'Ventilation and respiratory protection may be needed for fumes; UV from arc welding requires eye protection.',
    ],
    bestPractices: [
      'Obtain a hot work permit when required; ensure combustibles are removed or covered.',
      'Wear appropriate PPE: welding helmet, gloves, jacket; protect nearby workers from UV.',
      'Perform fire watch during and after work; have extinguishers readily available.',
    ],
    commonHazards: [
      'Fire and explosion from sparks igniting combustibles.',
      'UV radiation and eye damage; fume inhalation; burns.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1910.252', ref: 'Welding, cutting, and brazing' },
    ],
    correctTerminology: [
      { preferred: 'hot work permit', avoid: [] },
      { preferred: 'fire watch', avoid: [] },
    ],
    mythsOrAvoid: [
      'Welding in a well-ventilated area does not require respiratory protection for all materials.',
      'A quick weld does not need a fire watch.',
    ],
    shouldMention: ['permit', 'fire watch', 'PPE', 'ventilation'],
    signsRelevant: ['DANGER', 'HOT WORK', 'NO SMOKING'],
  },
  {
    id: 'hand-power-tools',
    label: 'Hand and power tools',
    keywords: ['hand tool', 'power tool', 'saw', 'drill', 'grinder', 'sanders', 'chisel', 'wrench', 'blade', 'guard'],
    keyFacts: [
      'OSHA 1910.242 and 1910.243 cover hand and portable power tools; guards and safety devices must be used.',
      'Tools must be maintained; use the right tool for the job; keep blades sharp and guards in place.',
      'GFCI protection is required for portable electric tools in wet or conductive areas.',
    ],
    bestPractices: [
      'Inspect tools before use; do not use damaged or defective tools.',
      'Use guards and safety devices; keep hands away from cutting edges and rotating parts.',
      'Secure workpieces; wear appropriate PPE (safety glasses, gloves when appropriate).',
    ],
    commonHazards: [
      'Cutting and puncture injuries; flying chips and particles.',
      'Electric shock; kickback from saws; tool breakage.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1910.242', ref: 'Hand and portable powered tools' },
      { name: 'OSHA 1910.243', ref: 'Guarding of portable powered tools' },
    ],
    correctTerminology: [
      { preferred: 'power tool', avoid: [] },
      { preferred: 'guard', avoid: [] },
    ],
    mythsOrAvoid: [
      'Gloves protect from all power tool hazards (they can get caught in rotating tools).',
      'Removing a guard for a quick cut is acceptable.',
    ],
    shouldMention: ['guard', 'inspect', 'PPE', 'correct tool'],
    signsRelevant: ['CAUTION', 'EYE PROTECTION REQUIRED'],
  },
  {
    id: 'scaffolding',
    label: 'Scaffolding',
    keywords: ['scaffold', 'scaffolding', 'platform', 'guardrail', 'planking', 'tie-off', 'capacity', 'inspection'],
    keyFacts: [
      'OSHA 1926.451 sets requirements for scaffolding; qualified persons must design and inspect.',
      'Guardrails, midrails, and toe boards are required; platforms must support 4× intended load.',
      'Scaffolds must be inspected before use and after modifications or weather events.',
    ],
    bestPractices: [
      'Use only scaffolds that have been inspected and tagged; do not exceed load capacity.',
      'Ensure guardrails are in place; use fall protection when required by the standard.',
      'Report damaged or unstable scaffolding; do not use in high winds or adverse weather.',
    ],
    commonHazards: [
      'Falls from unguarded edges; platform collapse from overload.',
      'Struck-by from falling tools or materials; electrocution from power lines.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1926.451', ref: 'Scaffolding (construction)' },
    ],
    correctTerminology: [
      { preferred: 'scaffolding', avoid: ['scaffold only'] },
      { preferred: 'competent person', avoid: [] },
    ],
    mythsOrAvoid: [
      'Scaffolding does not need inspection if it looks fine.',
      'Adding extra planks increases capacity.',
    ],
    shouldMention: ['guardrail', 'inspect', 'capacity', 'fall protection'],
    signsRelevant: ['DANGER', 'FALL HAZARD'],
  },
  {
    id: 'excavation-trenching',
    label: 'Excavation and trenching',
    keywords: ['excavation', 'trench', 'trenching', 'cave-in', 'shoring', 'sloping', 'protective system', 'underground', 'utility'],
    keyFacts: [
      'OSHA 1926.652 requires protective systems (sloping, shoring, shielding) for excavations 5 feet or deeper.',
      'A competent person must inspect excavations daily and before each shift; soil classification matters.',
      'Underground utilities must be located (Call 811) before digging.',
    ],
    bestPractices: [
      'Call 811 before digging; keep spoil piles at least 2 feet from the edge.',
      'Use required protective systems; never enter an unprotected trench 5 feet or deeper.',
      'Ensure safe access/egress; have a rescue plan.',
    ],
    commonHazards: [
      'Cave-in and engulfment; struck-by from falling loads.',
      'Hazardous atmospheres in deep excavations; struck-by equipment.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1926.652', ref: 'Excavation protective systems' },
    ],
    correctTerminology: [
      { preferred: 'protective system', avoid: [] },
      { preferred: 'competent person', avoid: [] },
    ],
    mythsOrAvoid: [
      'Hard soil will not collapse; no protective system needed.',
      'Quick entry into a shallow trench is safe without inspection.',
    ],
    shouldMention: ['protective system', 'Call 811', 'inspect', 'cave-in'],
    signsRelevant: ['DANGER', 'EXCAVATION'],
  },
  {
    id: 'emergency-first-aid',
    label: 'Emergency response and first aid',
    keywords: ['first aid', 'CPR', 'AED', 'emergency', 'bleeding', 'shock', 'burns', '911', 'responder', 'defibrillator'],
    keyFacts: [
      'OSHA 1910.151 requires adequate first aid supplies and someone trained to render first aid when no infirmary is nearby.',
      'AEDs improve survival for cardiac arrest; training in CPR and first aid is recommended.',
      'Know the location of first aid kits, AEDs, eyewash stations, and emergency contacts.',
    ],
    bestPractices: [
      'Call 911 for serious injuries; use PPE when rendering first aid to avoid bloodborne exposure.',
      'Control bleeding with direct pressure; do not move an injured person unless necessary.',
      'Know how to use an AED; participate in first aid and CPR training.',
    ],
    commonHazards: [
      'Delay in care; improper technique worsening injury.',
      'Exposure to blood/body fluids without PPE.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1910.151', ref: 'Medical services and first aid' },
    ],
    correctTerminology: [
      { preferred: 'first aid', avoid: [] },
      { preferred: 'AED', avoid: ['defibrillator only'] },
    ],
    mythsOrAvoid: [
      'Tilting the head back stops a nosebleed (lean forward, pinch nose).',
      'Putting butter on burns helps (use cool running water).',
    ],
    shouldMention: ['911', 'first aid', 'AED', 'bleeding'],
    signsRelevant: ['FIRST AID', 'AED', 'EYEWASH'],
  },
  {
    id: 'heat-stress',
    label: 'Heat stress and illness',
    keywords: ['heat', 'heat stress', 'heat stroke', 'heat exhaustion', 'hydration', 'rest break', 'acclimatization', 'sun', 'outdoor'],
    keyFacts: [
      'Heat illness can be fatal; acclimatization, hydration, and rest breaks reduce risk.',
      'Employers should have a heat illness prevention program for outdoor and hot indoor work.',
      'Signs of heat stroke include confusion, loss of consciousness, hot dry skin; call 911 immediately.',
    ],
    bestPractices: [
      'Drink water frequently; take rest breaks in shade or cool area.',
      'Wear light, breathable clothing; use cooling vests or damp cloths when appropriate.',
      'Watch for signs in yourself and coworkers; report symptoms early.',
    ],
    commonHazards: [
      'Heat stroke (life-threatening); heat exhaustion; heat cramps.',
      'Dehydration; exacerbation of existing medical conditions.',
    ],
    regulatoryRefs: [
      { name: 'OSHA/NIOSH', ref: 'Heat illness prevention' },
    ],
    correctTerminology: [
      { preferred: 'heat illness', avoid: ['heat stroke only'] },
      { preferred: 'acclimatization', avoid: [] },
    ],
    mythsOrAvoid: [
      'You can tough out heat; sweating means you are fine.',
      'Sports drinks are always better than water (water is usually sufficient).',
    ],
    shouldMention: ['water', 'rest', 'shade', 'symptoms'],
    signsRelevant: ['CAUTION', 'HOT AREA'],
  },
  {
    id: 'crane-rigging',
    label: 'Crane and rigging operations',
    keywords: ['crane', 'hoist', 'rigging', 'load', 'sling', 'tagline', 'swing radius', 'capacity', 'signal', 'operator'],
    keyFacts: [
      'OSHA 1910.179 and 1926.1427 cover cranes; only qualified operators and signal persons may perform roles.',
      'Load charts and rated capacity must be followed; never exceed capacity or use defective rigging.',
      'Swing radius must be barricaded; all personnel must stay clear of the load.',
    ],
    bestPractices: [
      'Use proper hand signals or radios; ensure the operator has clear visibility.',
      'Inspect slings and rigging before each use; use taglines to control load swing.',
      'Stay out of the swing radius and never walk under a suspended load.',
    ],
    commonHazards: [
      'Struck-by from load or boom; tip-over from overload or improper setup.',
      'Electrocution from contact with power lines; caught-in during rigging.',
    ],
    regulatoryRefs: [
      { name: 'OSHA 1910.179', ref: 'Overhead and gantry cranes' },
      { name: 'OSHA 1926.1427', ref: 'Crane operator qualification' },
    ],
    correctTerminology: [
      { preferred: 'qualified operator', avoid: [] },
      { preferred: 'tagline', avoid: [] },
    ],
    mythsOrAvoid: [
      'A little over capacity is acceptable for a short lift.',
      'The operator can see everything; no spotter needed.',
    ],
    shouldMention: ['signal', 'capacity', 'swing radius', 'inspect'],
    signsRelevant: ['DANGER', 'KEEP CLEAR', 'CRANE OPERATION'],
  },
];

const TOPICS_BY_ID = new Map(EHS_TOPICS.map((t) => [t.id, t]));

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find EHS topics relevant to a user prompt (e.g. script request).
 * Uses keyword matching on normalized prompt text.
 */
export function getTopicsForPrompt(prompt: string): EHSTopic[] {
  const norm = normalizeForMatch(prompt);
  const matched: EHSTopic[] = [];
  for (const topic of EHS_TOPICS) {
    const hasMatch = topic.keywords.some((kw) => {
      const k = normalizeForMatch(kw);
      return k.length >= 2 && (norm.includes(k) || norm.includes(k.replace(/\s+/g, ' ')));
    });
    if (hasMatch) matched.push(topic);
  }
  return matched;
}

/**
 * Build a context string from relevant EHS topics for injection into system prompts.
 * Use to augment OpenAI calls with accurate, reference-backed facts.
 */
export function getContextForPrompt(prompt: string): string {
  const topics = getTopicsForPrompt(prompt);
  if (topics.length === 0) return '';

  const sections: string[] = [
    'Reference facts (use these to keep the script accurate; align with OSHA/ANSI where applicable):',
  ];
  for (const t of topics) {
    sections.push(`\n[${t.label}]`);
    if (t.keyFacts.length) sections.push(`Key facts: ${t.keyFacts.join(' ')}`);
    if (t.bestPractices.length) sections.push(`Best practices: ${t.bestPractices.slice(0, 3).join(' ')}`);
    if (t.commonHazards.length) sections.push(`Common hazards: ${t.commonHazards.slice(0, 2).join(' ')}`);
    if (t.signsRelevant?.length) sections.push(`Relevant signs: ${t.signsRelevant.join(', ')}.`);
  }
  return sections.join('\n');
}

/**
 * Validate script content (e.g. combined narration + imagePrompt text) against
 * the EHS reference. Returns warnings, terminology suggestions, myth flags,
 * and missing "should mention" points for relevant topics.
 */
export function validateContentAgainstReference(
  content: string,
  options?: { topicIds?: string[]; restrictToTopics?: boolean }
): EHSValidationResult {
  const topicIds = options?.topicIds ?? getTopicsForPrompt(content).map((t) => t.id);
  const restrict = options?.restrictToTopics ?? false;
  const topics = topicIds.map((id) => TOPICS_BY_ID.get(id)).filter(Boolean) as EHSTopic[];

  const warnings: string[] = [];
  const terminologySuggestions: { found: string; prefer: string }[] = [];
  const mythsFlagged: string[] = [];
  const missingRecommendations: string[] = [];

  const normContent = normalizeForMatch(content);

  for (const t of topics) {
    for (const term of t.correctTerminology) {
      if (!term.avoid?.length) continue;
      for (const avoid of term.avoid) {
        const a = normalizeForMatch(avoid);
        if (a.length >= 3 && normContent.includes(a)) {
          terminologySuggestions.push({ found: avoid, prefer: term.preferred });
        }
      }
    }
    for (const myth of t.mythsOrAvoid) {
      const m = normalizeForMatch(myth);
      if (m.length >= 10 && normContent.includes(m)) {
        mythsFlagged.push(myth);
      }
    }
    for (const rec of t.shouldMention) {
      const r = normalizeForMatch(rec);
      if (r.length >= 2 && !normContent.includes(r)) {
        missingRecommendations.push(`[${t.label}] Consider mentioning: ${rec}`);
      }
    }
  }

  if (mythsFlagged.length) {
    warnings.push(`Possible myth or avoid-phrase in content: ${mythsFlagged.join('; ')}`);
  }
  if (terminologySuggestions.length) {
    warnings.push(
      `Terminology: prefer "${terminologySuggestions.map((s) => s.prefer).join('", "')}" over alternatives where used.`
    );
  }

  if (restrict && topics.length === 0) {
    return {
      topicIds: [],
      warnings: [],
      terminologySuggestions: [],
      mythsFlagged: [],
      missingRecommendations: [],
    };
  }

  return {
    topicIds,
    warnings,
    terminologySuggestions,
    mythsFlagged,
    missingRecommendations,
  };
}

/**
 * All EHS topics (for UI or debugging).
 */
export function getAllEHSTopics(): EHSTopic[] {
  return [...EHS_TOPICS];
}

/**
 * Collect all regulatory citation strings from given topics (for live API fetch).
 */
export function getCitationsForTopics(topicIds: string[]): string[] {
  const topics = topicIds.map((id) => TOPICS_BY_ID.get(id)).filter(Boolean) as EHSTopic[];
  const citations: string[] = [];
  for (const t of topics) {
    for (const r of t.regulatoryRefs) {
      if (r.name) citations.push(r.name);
    }
  }
  return [...new Set(citations)];
}

/**
 * Build a detailed context string for fact verification.
 * Includes keyFacts, bestPractices, mythsOrAvoid, and regulatoryRefs for each topic.
 * Used by fact-verification module to verify script claims.
 */
export function getVerificationContextForTopics(topicIds: string[]): string {
  if (topicIds.length === 0) return '';
  const topics = topicIds
    .map((id) => TOPICS_BY_ID.get(id))
    .filter(Boolean) as EHSTopic[];
  if (topics.length === 0) return '';

  const sections: string[] = [
    'Authoritative EHS reference (OSHA/ANSI). Use this to verify factual claims:',
  ];
  for (const t of topics) {
    sections.push(`\n[${t.label}]`);
    if (t.regulatoryRefs.length)
      sections.push(`Regulations: ${t.regulatoryRefs.map((r) => `${r.name}${r.ref ? ` (${r.ref})` : ''}`).join('; ')}`);
    if (t.keyFacts.length) sections.push(`Key facts: ${t.keyFacts.join(' ')}`);
    if (t.bestPractices.length) sections.push(`Best practices: ${t.bestPractices.join(' ')}`);
    if (t.mythsOrAvoid.length) sections.push(`Myths/avoid (wrong): ${t.mythsOrAvoid.join(' ')}`);
  }
  return sections.join('\n');
}
