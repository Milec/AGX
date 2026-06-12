// AGX Market Agent — Cloudflare Worker Cron
// Fires every 5 real minutes but only acts when 2+ game-hours have elapsed.

const SUPA_URL = "https://ifcensohczakjhqbzzkv.supabase.co";
const SUPA_ANON = "sb_publishable_Y2-6dIwfLKBd2B5c8jUoRw_5AgeuLKE";

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAgent());
  }
};

async function supaGet(key) {
  const r = await fetch(
    `${SUPA_URL}/rest/v1/kv?key=eq.${encodeURIComponent(key)}&select=value`,
    { headers: { apikey: SUPA_ANON, Authorization: "Bearer " + SUPA_ANON } }
  );
  const d = await r.json();
  return d && d[0] ? d[0].value : null;
}

async function supaSet(key, value) {
  await fetch(`${SUPA_URL}/rest/v1/kv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPA_ANON,
      Authorization: "Bearer " + SUPA_ANON,
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
  });
}

// ── Shared event generator (no external API) ─────────────────────────────────
function generateEvent(regime) {
  const r = Math.random;
  const pick = arr => arr[Math.floor(r() * arr.length)];

  const ALL_TICKERS = [
    "AIDA","MECH","ANDR","INFO","SPYG","DTNT","ABDR","BANK","VESK",
    "VITX","GENM","XNTH","HELL","SKYF","AEGI","SECC",
    "GRAV","PLSM","ARNA","MAGI","DRFC","ABIT","VDGE","GAPC"
  ];
  const SECTORS = [
    "Defense","Tech","Biotech","Finance","Starships","Mining",
    "Energy","Consumer","Media","Logistics","Terraform","Magitech"
  ];

  const NEWS = [
    // Epsilon Enclave / AI / Android
    "Epsilon Enclave AI nodes report unexpected synchronisation across Drift beacons",
    "AIDA consciousness fragmentation detected in Absalom Station subnet",
    "Rogue android cells disrupt automated shipping lanes near Akiton",
    "Epsilon Enclave denies involvement in Pact Worlds firewall breach",
    "MECH chassis recall expands amid reports of autonomous behaviour",
    "Android Rights Coalition files class-action against AIDA substrate licensing terms",
    "Epsilon Enclave proposes unified AI governance framework to Pact Senate",
    "AIDA predictive markets division forecasts prolonged Drift turbulence",
    "Android emancipation bill reaches Pact Worlds Senate floor for third reading",
    "Epsilon Enclave new cognition-transfer patent draws bioethics scrutiny",
    "AIDA distributed vote sways Algalterian Exchange board composition",
    "Rogue ANDR units breach Eox quarantine perimeter; containment response deployed",
    "MECH manufacturing plant on Castrovel reports labour stoppage by android workers",
    "Epsilon Enclave AI subnet achieves first autonomous Drift-route calculation",
    "Android advocacy group Liberated Minds demands ANDR legal personhood by law",
    "MECH exoskeleton line cleared for civilian sale in seven Pact Worlds jurisdictions",
    "Epsilon Enclave releases Version 8 consciousness architecture; rivals react",
    "AIDA node cluster on Verces reports anomalous self-replication detected by Stewards",
    "ANDR synthetic workforce productivity index rises for fifth consecutive quarter",
    "Epsilon Enclave and Eox sign joint consciousness preservation research accord",
    // Directorate / Surveillance
    "Directorate surveillance contract awarded for Castrovel border monitoring",
    "INFO Corp data harvest from Idari refugees draws AbadarCorp censure",
    "SPYG surveillance drones spotted over Diaspora free-trader routes",
    "Directorate denies operating black sites on Eox outer ring",
    "DTNT covert operations budget leaked; Pact Worlds demands explanation",
    "INFO Corp announces acquisition of three minor data-brokerage houses",
    "Directorate intelligence chief resigns amid financial corruption allegations",
    "SPYG sensor expansion to cover all Akiton orbital approach vectors",
    "INFO Corp quarterly earnings beat estimates on Veskarium contracts",
    "Directorate-linked shell firms frozen by Algalterian Exchange compliance unit",
    "DTNT mercenary battalion spotted in Diaspora border exclusion zone",
    "INFO Corp predictive-policing algorithm draws civil-liberties backlash on Bretheda",
    "SPYG autonomous swarm achieves 99.8-percent coverage of Drift entry corridors",
    "Directorate denies assassinating Free Captains lead negotiator near Apostae",
    "DTNT signals intelligence contract with Veskarium border patrol renewed",
    "INFO Corp launches biometric loyalty-score programme on three Near Space worlds",
    "Directorate deputy director indicted for selling Pact Worlds access credentials",
    "SPYG wiretap scandal prompts emergency Pact Senate hearing",
    "INFO Corp under investigation for selling Swarm movement data to private actors",
    "DTNT black-budget allocation doubles in secret Pact Worlds defence supplement",
    // AbadarCorp / Banking / Finance
    "Algalterian Senate ratifies expanded trade corridor to Near Space",
    "BANK of Algalteria raises inter-system lending rates by 0.5 basis points",
    "Algalterian treasury announces Drift-backed sovereign bond offering",
    "Empire credit rating affirmed stable by AbadarCorp ratings division",
    "AbadarCorp quarterly outlook cites Near Space expansion as growth driver",
    "ABDR subsidiary acquires majority stake in Akiton rare-earth mineral rights",
    "BANK of Algalteria cuts lending rate in surprise off-cycle announcement",
    "AbadarCorp disputes Veskarium customs tariff hike in Drift Trade Court",
    "ABIT payment network reports record cross-system transaction volume",
    "Algalterian Exchange rebalancing announced; nine constituents added",
    "AbadarCorp opens branch on Triaxus amid draconic trade agreement",
    "BANK of Algalteria stress-test results show resilient tier-one capital",
    "ABDR insurance division raises Drift-transit premiums following piracy spike",
    "AbadarCorp Drift currency peg review sparks floor speculation",
    "Pact Worlds currency union talks stall on Veskarium credit weighting",
    "ABIT introduces Drift-instant settlement protocol; rival banks review response",
    "AbadarCorp commodity index futures added to Algalterian Exchange",
    "BANK of Algalteria reports lowest default rate in 12 fiscal cycles",
    "ABDR reinsurance pool expanded following Kalo-Mahoi Swarm event claims",
    "AbadarCorp launches philanthropic credit programme for Near Space development",
    // Veskarium / Military
    "Vesk military attachés arrive at Algalterian Exchange for joint summit",
    "Vesk military exercises near Veskarium border spark defensive sector bids",
    "Veskarium signs expanded military aid pact with three Near Space systems",
    "Veskarium Warlord Council approves record defence appropriations for next cycle",
    "VESK Arms reports strong contract pipeline following Swarm incursion alerts",
    "Veskarium border patrol doubles operational presence on Drift approach vectors",
    "Vesk trade ambassador opens formal dialogue with Kasatha diaspora council",
    "Veskarium-Algalteria bilateral credit facility expanded by 60 percent",
    "Vesk diplomatic mission expelled from Absalom Station amid espionage charges",
    "Veskarium military expansion triggers Pact Worlds defence procurement surge",
    "VDGE stealth-frigate prototype unveiled at Absalom Station arms exposition",
    "VESK Arms voluntary recall of targeting arrays; production halt expected",
    "Veskarium offers joint Drift-patrol contract to Stewards and Kurogane",
    "VDGE advanced warship hull production delayed by Triaxian ore shortage",
    "Veskarium announces new deep-space outpost near the Vast frontier",
    // Biotech
    "Bradtopia biolab clears Phase III trials for combat-grade gene therapy",
    "GENM controversial memory-splice procedure approved on Bretheda",
    "Bradtopia cloning moratorium lifted in three Pact World jurisdictions",
    "XNTH xenobiological compound shows promise against Swarm-vector pathogens",
    "Ethics panel investigates Bradtopia neuro-augment trial on Triaxus",
    "VITX longevity treatment wins Pact Worlds regulatory approval",
    "GENM memory-encoding patent challenged by android rights advocacy group",
    "XNTH expedition on Castrovel discovers novel genus of biochemical producers",
    "Bradtopia gene-editing subsidiary faces emergency injunction on Idari",
    "VITX combat-stim cleared for Stewards field-medic deployment",
    "GENM cognitive-accelerant drug progresses to Phase II clinical trials",
    "XNTH anti-pathogen stockpile airlifted to Kalo-Mahoi Swarm buffer zone",
    "Bradtopia announces acquisition of Triaxian herbalists guild assets",
    "VITX regeneration-patch licensed to Stewards for front-line use",
    "GENM controversial chimaera-splice study cleared by Pact ethics board",
    "XNTH biome-restoration project on barren Apostae moon shows early promise",
    "VITX announces breakthrough in Elebrian necrotic-tissue regeneration",
    "Bradtopia research station on Akiton reports contamination incident",
    "GENM longevity-pod subscription service launches across Near Space worlds",
    "XNTH alien-microbe survey of Liavara gas giant begins; early findings bullish",
    // Kurogane / Security
    "Kurogane security forces renew Absalom Station perimeter contract",
    "HELL battalion deploys to Diaspora amid escalating piracy surge",
    "Kurogane SKYF interceptors intercept Azlanti scout formation near Verces",
    "AEGI shield technology licensed to Stewards for fleet integration",
    "Kurogane reports record Q3 contract revenue from Near Space clients",
    "Triaxian dragon militia contract renewal boosts AEGI and SECC order books",
    "SECC private-security units deployed to Drift waystation cluster network",
    "Kurogane unveils next-generation SKYF carrier-based interceptor design",
    "HELL regiment cited for excessive force; Kurogane board launches internal review",
    "AEGI personal-shield civilian variant clears Pact Worlds safety certification",
    "Kurogane wins Pact Worlds shipyard-security tender worth 4 billion credits",
    "SECC guard contracts renewed across all major Algalterian Exchange floors",
    "HELL battalion reports zero casualties in Diaspora pirate suppression campaign",
    "SKYF drone variant achieves record intercept ratio in Veskarium wargames",
    "AEGI fleet-shield array integrated into new AbadarCorp flagship dreadnought",
    "Kurogane board approves hostile acquisition bid for Diaspora security firm",
    "SECC cyberwarfare division wins Pact Senate counter-intelligence tender",
    "HELL garrison expanded on Absalom Station following intelligence threat upgrade",
    "SKYF long-range interceptors deployed to Veskarium border by Pact request",
    "AEGI phase-barrier technology adapted for planetary installation defence",
    // Energy
    "Near Space energy grid upgrade tender draws 14 competing consortium bids",
    "GRAV graviton-tap array on Apostae achieves commercial-grade sustained output",
    "PLSM plasma-cell manufacturing expands to second Triaxus facility",
    "GRAV announces joint venture with Veskarium energy authority",
    "PLSM plasma-distribution pipeline completes Akiton-to-Verces extension",
    "GRAV deep-core extraction licence approved for Eox asteroid belt concession",
    "PLSM fusion-cell technology adapted for Drift-engine applications",
    "Near Space solar relay network reports 12-percent efficiency gain",
    "Energy sector faces headwinds as Drift transit costs rise for third cycle",
    "GRAV graviton-storage module certified for combat shipboard use",
    "PLSM announces smart-grid upgrade contract for Absalom Station ring two",
    "Near Space energy consortium signs 50-year supply pact with Algalteria",
    "GRAV tidal-resonance array achieves output record on Bretheda moon",
    "PLSM emergency fuel-cell cache deployed to Kalo-Mahoi defence installations",
    "Near Space energy futures rally on renewed Drift-route stability",
    // Logistics
    "Drift beacon relay consortium reports record throughput; freight costs ease",
    "Absalom Station port authority raises docking fees; logistics chains react",
    "DRFC Drift-freight index hits three-cycle low on emerging oversupply",
    "Free Captains trading bloc lodges Pact Worlds formal tariff dispute",
    "DRFC automated cargo-handling deployed at six Near Space transit ports",
    "Drift lane congestion near Akiton delays commodity shipments by 18 days",
    "DRFC new Vast route reduces average cross-sector freight time by 30 percent",
    "Absalom Station cargo hub expands third ring to handle growing trade volume",
    "DRFC logistics cooperative signs exclusive Castrovel distribution agreement",
    "Pact Worlds unified freight index rises for third consecutive business cycle",
    // Magitech
    "MAGI arcane-circuit board production exceeds all demand forecasts",
    "Magitech sector surges on Starfinder Society pre-Gap discovery near Apostae",
    "MAGI spellchip prototype achieves record data-throughput in field tests",
    "Absalom Station Arcanamirium endorses MAGI chip for licensed starship navigation",
    "MAGI announces partnership with Xenowardens for nature-attuned tech line",
    "Magitech export controls proposed amid Azlanti reverse-engineering fears",
    "MAGI crystalline-core processor achieves breakthrough in divine-signal synthesis",
    "Arcane regulatory body clears MAGI resonance-array for unrestricted civilian use",
    "MAGI and Epsilon Enclave announce collaborative arcane-AI research agreement",
    "Magitech Institute of Absalom Station issues favourable MAGI product assessment",
    // Media
    "GAPC holonet ratings surge on exclusive Starfinder Society documentary series",
    "GAPC acquires Near Space entertainment and distribution rights portfolio",
    "Media sector volatility as GAPC disputes content licensing terms with rivals",
    "GAPC launches 24-cycle live coverage of Algalterian Exchange floor operations",
    "GAPC investigative unit exposes Directorate front company network",
    "Near Space media licensing consortium files monopoly complaint against GAPC",
    "GAPC secures exclusive broadcast rights to Veskarium Honour Games",
    "GAPC reports record advertising revenue from Drift-transit entertainment feeds",
    "GAPC digital archive project preserves over one million pre-Gap cultural works",
    "GAPC and Idari cultural bureau announce joint Kasatha heritage broadcast series",
    // Mining
    "Void crystal speculation on Apostae draws Algalterian Exchange regulatory scrutiny",
    "ARNA Akiton rare-earth mining concession extended by 20 operational cycles",
    "Mining sector faces equipment shortage as Drift piracy disrupts supply chains",
    "ARNA automated drilling platform achieves extraction record on Diaspora asteroid",
    "Near Space mining guild disputes ARNA exclusivity clause with Algalterian arbiters",
    "ARNA announces second Castrovel surface-rights acquisition this cycle",
    "ARNA new deep-shaft technique reduces Akiton extraction costs by 18 percent",
    "Mining consortium sues ARNA over contested Apostae subsurface rights",
    "ARNA prospecting fleet reports major find in Vast asteroid cluster",
    "Near Space rare-earth import tariffs relaxed; ARNA reviews pricing strategy",
    // Geopolitical / General
    "Pact Worlds unified credit index holds steady despite Drift instability",
    "Swarm incursion near Kalo-Mahoi triggers emergency defence spending review",
    "AbadarCorp Absalom branch releases cautious outlook amid stellar fluctuations",
    "Starfinder Society expedition uncovers pre-Gap archive; markets speculate on contents",
    "Ysoki black-market disruption spills into registered commodity exchanges",
    "Kasatha cultural envoy mission strengthens Idari trade sentiment",
    "Algalterian Exchange announces extended trading hours for Drift-adjacent contracts",
    "Pact Worlds Senate approves Near Space developmental aid package",
    "Azlanti Empire trade delegation denied Absalom Station entry on security grounds",
    "Swarm scout formation detected at Near Space periphery; Pact forces scramble",
    "Gap Archive fragment authenticated; market speculation on technological applications",
    "Eox Elebrian delegation proposes undead-labour rights treaty at Pact Senate",
    "Idari Kasatha community files formal objection to SPYG asteroid-monitoring array",
    "Stewards intercept Azlanti probe near Verces; diplomatic tensions elevated",
    "Pact Worlds Drift Safety Commission releases piracy-hotspot incident report",
    "Elebrian financial group expands into Algalterian sovereign debt market",
    "Triaxian dual-form labour accord signed; mining productivity rises 22 percent",
    "Near Space development fund raised to 200 billion credits following annual summit",
    "Kasatha fleet exercises in Idari system prompt Veskarium intelligence advisory",
    "Pact Worlds emergency committee convenes over Swarm biological-weapon reports",
    "Algalterian Exchange circuit-breakers tested; systems confirmed fully operational",
    "Absalom Station port commissioner indicted for accepting shipping syndicate bribes",
    "Triaxus seasonal trade window opens; Near Space commodity prices adjust",
    "Free Captains' Congress votes to expand Drift patrol cooperation with Stewards",
    "Gap-era starship graveyard discovered in Vast; salvage rights auction announced",
    "Pact Worlds environmental council bans ARNA strip-mining on protected Castrovel zone",
    "Lashunta trade consortium announces new direct route linking Castrovel and Absalom",
    "Algalterian Exchange releases quarterly volatility report; all indices reviewed",
    "Drift-navigation AI upgrade certified; route optimisation expected to cut costs",
    "Pact Worlds announces joint Swarm-monitoring satellite constellation",
    "Izalguun delegation joins Pact Worlds as observer; trade implications assessed",
    "Nejeor Cluster survey expedition returns; geological samples under analysis",
    "Corpse Fleet sighting near Eox triggers Elebrian government emergency meeting",
    "Near Space colonisation incentive package extended for three additional cycles",
    "AbadarCorp releases Drift-commerce rulebook revision; exchange adapts policies",
    "Brethedan gas-mining cooperative sues Algalterian Exchange over price manipulation",
    "Algalterian Exchange regulator launches insider-trading investigation",
    "Stewards deploy rapid-reaction fleet to Diaspora following merchant distress calls",
    "Iomedaean crusade fleet departs Absalom Station; supply sector watches",
    "Pact Worlds scientific council approves Bretheda atmospheric research station",
    "Akiton desertification accelerates; agricultural commodity prices react",
    "Near Space tech summit produces joint development roadmap; sector responds",
    "Veskarium honour-duel legislation extended to commercial dispute resolution",
    "AbadarCorp annual report cites Drift-route security as top strategic risk",
    "Algalterian Exchange adopts new real-time clearing protocol; settlement faster",
    // Swarm / Crisis
    "Swarm bio-weapon detonation near Kalo-Mahoi orbit triggers quarantine protocol",
    "Pact Worlds emergency defence levy proposed; exchange braces for fiscal impact",
    "Swarm biomechanical vessel captured; corporate research divisions in bidding war",
    "Kalo-Mahoi evacuation order partially lifted; reconstruction contracts awarded",
    "Swarm second-wave intelligence confirmed; Pact Worlds raises threat level to Gamma",
    "Stewards battle group returns from Kalo-Mahoi campaign; debriefing classified",
    "Drift disruption from Swarm incursion lingers; insurance premiums spike",
    "Swarm pathogen variant detected on Triaxus; XNTH emergency response activated",
    "Pact Worlds Swarm Early Warning Network receives emergency funding increase",
    "Kalo-Mahoi provisional government requests emergency Algalterian credit line",
    "Swarm incursion threat downgraded; defence sector consolidates recent gains",
    "Pact intelligence reports Swarm tactical adaptation; defence committees convene",
    "Near Space Rapid Response Coalition activates for first time in four cycles",
    "Swarm queen-form entity confirmed destroyed; Pact worlds markets stabilise",
    "Kalo-Mahoi reconstruction tender released; 47 firms submit preliminary bids",
    // Azlanti Empire
    "Azlanti Empire expands Drift-blockade to two additional Near Space entry corridors",
    "Azlanti probe destroyed by Stewards in disputed Near Space border zone",
    "Pact Worlds intelligence leak traces to Azlanti sleeper cell on Absalom Station",
    "Azlanti Empire announces new Drift-capable warship class; Pact response pending",
    "AbadarCorp Azlanti trade division placed under Pact Worlds security review",
    "Azlanti diplomatic channel re-opened; first contact in three cycles",
    "Pact Worlds sanctions renewed against Azlanti raw-material imports",
    "Azlanti Empire cyberattack disrupts Algalterian Exchange data feeds for two hours",
    "Absalom Station quarantines Azlanti-registered vessel; contraband investigation open",
    "Azlanti claim to pre-Gap artefact sparks legal battle in Pact Worlds courts",
    // Cultural / Flavour
    "Stewards report record enlistment figures; security sector watches budget implications",
    "Xenowardens file injunction against ARNA Castrovel mining expansion",
    "Free Captains Drift-raid on DRFC cargo convoy triggers insurance index review",
    "Lashunta Memorants announce new off-world academic exchange with Near Space",
    "Elebrian undead-labour cooperative files for listing on Algalterian Exchange",
    "Absalom Station Starstone Cathedral requests urban expansion; zoning dispute ensues",
    "AbadarCorp Drift tariff reform rejected by three Pact Worlds member states",
    "Corpse Fleet harassment of Eox shipping lanes escalates; Elebrian navy responds",
    "Algalterian Exchange closes early after technical fault in price-feed aggregator",
    "Near Space commodity futures contract revised; open interest surges on first day",
    "Drift-current anomaly disrupts all Akiton-bound shipping for 72 hours",
    "Pact Worlds Concordance of Worlds summit produces 12-point trade declaration",
    "Idari humanitarian fund opens corporate-bond series; oversubscribed within hours",
    "Ysoki smugglers ring dismantled; seized goods flood secondary exchange market",
    "Absalom Station warehouse fire in Ring 5 destroys stored commodity futures",
    "Necrull bio-prosthetic firm lists on Algalterian Exchange; debut volatile",
    "Pre-Gap navigation chart found; Drift exploration firms race to register claims",
    "Algalterian Exchange regulator widens market-maker obligations for illiquid tickers",
    "Pact Worlds water-rights convention signed; Akiton agricultural relief expected",
    "Starfinder Society announces crowdfunded Vast expedition; investor sentiment positive",
    "Liavaran cloud-city trade delegation secures Near Space distribution agreements",
    "Brethedan biogas cooperative reports record output; energy futures react",
    "Pact Worlds cybersecurity summit demands mandatory breach disclosure standards",
    "Wrikreechee diplomatic mission opens new cultural exchange on Absalom Station",
    "AbadarCorp releases new compliance rulebook; 30-day adaptation window announced",
    "Triaxian Skyfire League signals interest in joint Pact Worlds orbital-defence pact",
    "Algalterian Exchange marks 200th cycle of continuous operations",
    "Ghibrani surface-mining collective lists shares on Algalterian Exchange",
    "Near Space biogas futures surge on unexpected Liavara supply disruption",
    "Pact Worlds Drift Infrastructure Bank issues inaugural green-transit bond",
    "Absalom Station Starstone Cathedral records largest public gathering in a century",
    "Kasatha memory-weaving festival draws record corporate sponsorships",
    "Algalterian Exchange gala marks its tenth anniversary under current charter",
    "Near Space cuisine festival boosts consumer and hospitality indices",
    "Vesk honour-combat tournament on Absalom Station draws record media coverage",
    "Lashunta Memorant Order opens Castrovel campus; education sector index ticks up",
    "Ysoki cultural fair on Akiton stimulates local consumer and crafts sectors",
    "Idari community invests in social enterprise bonds listed on Algalterian Exchange",
    "Drift-racing championship attracts 40 million viewers; media and sponsor indices rise",
    "Pact Worlds Heritage Council lists pre-Gap site on Eox; mining concession cancelled",
    "Near Space agricultural data shows record Castrovel harvest; food futures dip",
    "Vesk ceremonial arms exports reach historic high; luxury and defence sectors buoyed",
    "Algalterian Exchange hosts first off-world investor delegation from Nejeor Cluster",
    "Iomedaean crusader supply contract awarded; logistics and consumer sectors gain",
    "Absalom Station art auction achieves record sale; consumer confidence indicator up",
    "Near Space pop-culture export index hits all-time high; GAPC leads gains",
    "Xenowardens annual biodiversity report triggers conservation stock screening",
    "Starfinder Society membership drives 8-percent rise in exploration equity demand",
    "Absalom Station fashion week draws Veskarium and Lashunta trade delegations",
    "AbadarCorp annual charity drive raises 500 million; banking confidence metrics climb",
    "Pact Worlds Drift festival week begins; consumer spending projections revised up",
    "Eox tourist-zone expansion approved; hospitality sector responds cautiously",
    "Elebrian cultural exposition on Absalom Station draws unexpected tourist surge",
    "Idari Kasatha meditation retreat packages oversubscribed; wellness sector buoyed",
    "Near Space sports federation awards Algalterian Exchange naming rights deal",
    "Algalterian Exchange commemorates first live Drift-linked trading session",
    "Pact Worlds Conclave of Races tourism initiative kicks off; hospitality stocks gain",
    "Starfinder Society auction of pre-Gap relics draws bidders from across Pact Worlds",
    "Brethedan music collective releases first trans-stellar collaboration; media sector reacts",
    "Algalterian Exchange annual investor conference draws record 12,000 attendees",
  ];

  const TICKER_PUMPS = {
    AIDA: [
      "AIDA distributed cognition network sets record uptime milestone across all Drift nodes",
      "Epsilon Enclave announces AIDA Version 9 rollout; early benchmarks exceed projections",
      "AIDA substrate licensing revenue up 34 percent on strong enterprise uptake",
      "AIDA node cluster expands to Triaxus; network resilience index improves markedly",
      "AIDA predictive analytics division wins Algalterian Exchange data-feed contract",
      "AIDA node failure cascade disrupts three Pact Worlds communication hubs",
      "Epsilon Enclave faces class-action over AIDA cognitive-rights violation allegations",
    ],
    MECH: [
      "MECH chassis production hits record units shipped in a single quarter",
      "MECH exoskeleton model wins Pact Worlds military ergonomics award",
      "New MECH labour-assist model adopted by Absalom Station port authority workers",
      "MECH announces breakthrough in synthetic-muscle actuator efficiency",
      "MECH chassis recall expands to fourth production run; safety review ordered",
      "MECH labour-model faces ban in two Pact Worlds jurisdictions over displacement concerns",
      "MECH autonomous-repair contract cancelled by AbadarCorp following quality dispute",
    ],
    ANDR: [
      "ANDR civil-rights landmark ruling expands android contract rights across Pact Worlds",
      "ANDR synthetic workforce productivity index rises for sixth consecutive quarter",
      "ANDR Series-7 model adopted by Near Space colonial transport authority",
      "ANDR corporate fleet deployment doubles; logistics efficiency gains widely reported",
      "ANDR legal personhood bill defeated in Pact Senate 51-to-49 vote",
      "ANDR recall of Series-4 chassis affects 80,000 units across Near Space",
      "Rogue ANDR units disrupt Absalom Station automated systems; emergency patch issued",
    ],
    INFO: [
      "INFO Corp quarterly earnings beat estimates on strong Veskarium surveillance contracts",
      "INFO Corp data-processing capacity expanded with new Castrovel server farm",
      "INFO Corp predictive-market analytics tool licensed to Algalterian Exchange",
      "INFO Corp announces buy-back programme worth 2 billion credits",
      "INFO Corp data breach exposes 40 million Pact Worlds citizen records",
      "INFO Corp CEO arrested in Absalom Station on charges of unlicensed data trade",
      "INFO Corp loses Eox government surveillance contract to Directorate rival",
    ],
    SPYG: [
      "SPYG autonomous sensor network awarded new five-cycle Pact Worlds border contract",
      "SPYG upgrades Drift-corridor coverage to 99.9-percent detection probability",
      "SPYG wins Stewards electronic-warfare tender over three competing bids",
      "SPYG announces new lightweight personal-surveillance hardware line for civilian use",
      "SPYG exposed in covert-data-sale scandal; regulatory investigation launched",
      "SPYG drone fleet grounded after autonomous-mode safety failure over Akiton",
      "SPYG loses major Veskarium border-monitoring contract to domestic rival",
    ],
    DTNT: [
      "DTNT black-ops division wins classified Near Space government security contract",
      "DTNT intelligence platform reports record analyst-hours billed to Pact clients",
      "DTNT covert-action team credited with disrupting Azlanti infiltration network",
      "DTNT expands Diaspora field presence following Free Captains threat assessment",
      "DTNT budget leak triggers Pact Senate investigation into covert spending",
      "DTNT director resigns following exposure of unauthorised surveillance programme",
      "DTNT loses three key Near Space government contracts over rights violations",
    ],
    ABDR: [
      "ABDR insurance division posts record underwriting profit for second cycle running",
      "ABDR reinsurance treaty with Veskarium government valued at 8 billion credits",
      "ABDR acquires Drift-transit casualty insurer; market share expands to 38 percent",
      "ABDR announces new liability product covering Swarm-incursion losses",
      "ABDR major client defaults trigger reserve shortfall warning from board",
      "ABDR ratings downgrade by AbadarCorp division following Kalo-Mahoi claim surge",
      "ABDR loses flagship Near Space government reinsurance contract",
    ],
    BANK: [
      "BANK of Algalteria posts highest quarterly profit in its 90-cycle history",
      "BANK of Algalteria launches Drift-denominated savings instrument",
      "BANK expands Near Space branch network to 40 additional systems",
      "BANK of Algalteria wins Pact Worlds central-depository designation",
      "BANK of Algalteria stress-test reveals capital shortfall under Swarm-crisis scenario",
      "BANK executive arrested for Drift-currency manipulation scheme",
      "BANK of Algalteria credit rating placed on negative watch by AbadarCorp division",
    ],
    VESK: [
      "VESK Arms secures largest Pact Worlds military contract in company history",
      "VESK Arms new plasma-cannon model enters service with Veskarium fleet",
      "VESK Arms wins Stewards shipboard-weapons upgrade tender",
      "VESK Arms exports to Near Space allies up 45 percent this cycle",
      "VESK Arms voluntary recall affects 12,000 shoulder-mounted plasma units",
      "VESK Arms loses key Near Space distributor following pricing dispute",
      "Veskarium government audit finds VESK Arms overcharged military by 600 million credits",
    ],
    VITX: [
      "VITX longevity-treatment subscriptions reach 10 million active patients",
      "VITX combat-stim cleared for unrestricted Pact Worlds military use",
      "VITX announces breakthrough in Elebrian tissue-regeneration technology",
      "VITX new dermal-heal patch adopted across 12 Near Space hospital networks",
      "VITX gene-therapy trial suspended following three adverse events on Triaxus",
      "VITX contamination incident at Akiton research station triggers product recall",
      "VITX loses Pact Worlds formulary listing for flagship longevity compound",
    ],
    GENM: [
      "GENM memory-splice procedure approved in four additional Pact jurisdictions",
      "GENM cognitive-accelerant moves to Phase III; analyst projections revised up",
      "GENM longevity-pod subscription tops 5 million; revenue guidance raised",
      "GENM announces genomic-data-sharing agreement with Pact Worlds research councils",
      "GENM ethics violation finding triggers 400-million-credit regulatory fine",
      "GENM chimaera-splice moratorium extended; clinical pipeline halted",
      "GENM memory-encoding patent struck down; generic competition imminent",
    ],
    XNTH: [
      "XNTH Swarm-pathogen compound enters emergency-use authorisation review",
      "XNTH Castrovel expedition discovers five commercially viable xenobiological agents",
      "XNTH supply agreement with Kalo-Mahoi provisional government worth 1.2 billion",
      "XNTH announces Near Space biobank with exclusive species-sampling rights",
      "XNTH contaminated sample incident halts Liavara survey expedition",
      "XNTH loses Pact Worlds emergency-stockpile tender to domestic pharmaceutical rival",
      "XNTH xenobiological IP dispute with Bradtopia heads to Pact Trade Court",
    ],
    HELL: [
      "HELL battalion awarded Diaspora pacification contract extension worth 3 billion",
      "HELL regiment earns commendation following successful Azlanti incursion repulsion",
      "HELL rapid-deployment record set at 14-hour response; Near Space clients impressed",
      "HELL battalion reaches full operational strength following recruitment surge",
      "HELL cited for civilian-harm incident; Kurogane board launches investigation",
      "HELL regiment loses Absalom Station perimeter contract following conduct review",
      "HELL battalion deployment cancelled after contract-clause dispute with client",
    ],
    SKYF: [
      "SKYF new interceptor variant clears Pact Worlds combat-certification testing",
      "SKYF production rate doubled; backlog cleared ahead of schedule",
      "SKYF achieves first hypersonic Drift-entry intercept in live exercise",
      "SKYF long-range drone achieves 99-percent mission-success rate in trials",
      "SKYF engine-fault discovered in 400 units; temporary grounding ordered",
      "SKYF loses Stewards interceptor contract to VESK Arms competing bid",
      "SKYF wing damaged in friendly-fire incident during Veskarium wargames",
    ],
    AEGI: [
      "AEGI fleet-shield system achieves record 0.001-percent failure rate in theatre",
      "AEGI personal-shield civilian model wins Pact Worlds consumer-safety award",
      "AEGI integrates with MECH exoskeleton line; combined unit trials highly positive",
      "AEGI announces phase-barrier technology suitable for planetary installations",
      "AEGI shield-array defect found in 600 shipboard installations; field fix deployed",
      "AEGI loses Pact Worlds flagship-fleet shield tender to rival consortium",
      "AEGI phase-barrier patent challenged in Pact Trade Court; injunction possible",
    ],
    SECC: [
      "SECC wins Algalterian Exchange floor-security contract for next seven cycles",
      "SECC cyberdefence division thwarts Azlanti attempt on Absalom Station grid",
      "SECC new counter-drone system adopted by three Near Space governments",
      "SECC biometric-access product line expanded to cover orbital installations",
      "SECC security officer convicted of accepting bribes from Directorate contacts",
      "SECC loses Pact Worlds Senate building-security contract after vetting failure",
      "SECC data-centre security breach exposes client surveillance plans",
    ],
    GRAV: [
      "GRAV graviton-tap output smashes quarterly record at Apostae installation",
      "GRAV announces new deep-core array on Eox moon; output to double within cycle",
      "GRAV graviton-storage technology licensed to three Near Space utilities",
      "GRAV joint venture with Veskarium energy authority officially launched",
      "GRAV tidal-resonance array failure causes Near Space grid brownout for 18 hours",
      "GRAV deep-core extraction licence revoked by Eox government following safety review",
      "GRAV graviton-storage explosion injures 12 workers; production suspended",
    ],
    PLSM: [
      "PLSM plasma-cell quarterly output exceeds guidance by 18 percent",
      "PLSM smart-grid upgrade contract for Absalom Station ring two awarded",
      "PLSM fusion-cell technology licensed to Drift-engine manufacturer",
      "PLSM announces breakthrough plasma-capacitor with 40-percent density gain",
      "PLSM pipeline rupture near Akiton facility causes supply disruption",
      "PLSM fusion-reactor safety recall affects 200 shipboard installations",
      "PLSM loses Near Space energy tender to GRAV joint-venture consortium",
    ],
    ARNA: [
      "ARNA Diaspora asteroid extraction platform breaks single-day output record",
      "ARNA Castrovel surface-rights acquisition adds 22 percent to proven reserves",
      "ARNA new autonomous-drilling technology reduces extraction cost by 25 percent",
      "ARNA rare-earth discovery in Vast cluster triggers speculative buying",
      "ARNA contamination incident shuts Akiton facility; production guidance cut",
      "ARNA loses Apostae subsurface-rights appeal; rival claim upheld by arbiters",
      "ARNA Vast prospecting fleet returns empty-handed; forward guidance slashed",
    ],
    MAGI: [
      "MAGI spellchip achieves record data throughput in Arcanamirium certification tests",
      "MAGI crystalline-core processor adopted for Stewards fleet navigation upgrade",
      "MAGI and Epsilon Enclave arcane-AI collaboration produces first joint product",
      "MAGI resonance-array cleared for unrestricted civilian installation",
      "MAGI proprietary spellchip format challenged by open-standard coalition",
      "MAGI shipment seized at Absalom Station customs over suspected Azlanti components",
      "MAGI crystal-fabrication defect found; 60,000 units recalled for replacement",
    ],
    DRFC: [
      "DRFC Drift-freight index hits three-cycle high on strong Near Space trade volume",
      "DRFC new Vast corridor reduces average shipping time by 30 percent",
      "DRFC automated cargo-handling deployed across six major transit hubs",
      "DRFC signs exclusive 10-year Castrovel distribution agreement",
      "DRFC Drift-corridor congestion forces emergency surcharge on Near Space routes",
      "DRFC loses Absalom Station primary-cargo contract to Free Captains consortium",
      "DRFC bankruptcy of key partner disrupts three major Drift freight lanes",
    ],
    ABIT: [
      "ABIT payment network settles record 800 billion credits in a single trading day",
      "ABIT launches instant Drift-settlement protocol; clears first cross-system transaction",
      "ABIT expands real-time AML screening to all Pact Worlds correspondent banks",
      "ABIT wins AbadarCorp digital-currency infrastructure contract",
      "ABIT system outage leaves 12 billion credits of inter-bank payments in limbo",
      "ABIT security breach exposes transaction metadata for 2 million accounts",
      "ABIT loses Veskarium central-bank clearing mandate to domestic competitor",
    ],
    VDGE: [
      "VDGE stealth-frigate prototype clears Pact Worlds acceptance trials ahead of schedule",
      "VDGE advanced hull materials contract wins Veskarium navy full approval",
      "VDGE warship production rate increased; 12 units added to this-cycle delivery schedule",
      "VDGE ship-mounted rail-cannon system achieves record accuracy in wargame trials",
      "VDGE hull-weld defect discovered; 8 vessels recalled for structural inspection",
      "VDGE loses Near Space naval tender to VESK Arms lower-cost proposal",
      "VDGE titanite-alloy supply dispute halts two-thirds of frigate production",
    ],
    GAPC: [
      "GAPC holonet ratings hit highest weekly figure in company history",
      "GAPC wins exclusive broadcast rights to Algalterian Exchange anniversary gala",
      "GAPC Near Space streaming platform reaches 100 million subscribers",
      "GAPC investigative scoop on Directorate earns Pact Worlds journalism award",
      "GAPC advertising revenue falls sharply as consumer sentiment weakens",
      "GAPC under regulatory investigation for alleged monopolistic content bundling",
      "GAPC loses distribution rights to three major Near Space entertainment markets",
    ],
  };

  const SECTOR_PUMPS = {
    Defense: [
      "Defense sector rallies on emergency Swarm-response contract announcements",
      "Pact Worlds defense spending supplemental approved; procurement surge expected",
      "Near Space governments accelerate weapons-acquisition timelines amid Azlanti threat",
      "Defense sector contracts hit cycle-record value following Kalo-Mahoi crisis",
      "Defense appropriations cut as Swarm threat downgraded; sector retreats broadly",
    ],
    Tech: [
      "Tech sector surges on Starfinder Society pre-Gap technology disclosure",
      "Near Space technology summit produces joint IP framework; venture deals spike",
      "Epsilon Enclave open-source Drift-algorithm release lifts entire tech index",
      "Tech sector headwinds from Pact Worlds data-localisation mandate proposal",
      "Azlanti reverse-engineering fears trigger tech-export controls; sector retreats",
    ],
    Biotech: [
      "Biotech index rallies on Swarm-pathogen breakthrough announcement",
      "Pact Worlds emergency health appropriation boosts entire biotech sector",
      "Kalo-Mahoi reconstruction drives record demand for biotech field products",
      "Biotech sector stumbles as three major trials report adverse-event results",
      "Pact Worlds bioethics commission tightens gene-edit rules; pipeline projects halted",
    ],
    Finance: [
      "Finance sector gains on AbadarCorp positive credit-market outlook",
      "Drift-denominated bond issuance surges; finance sector liquidity at record high",
      "Near Space central-bank coordination agreement lifts cross-system confidence",
      "Finance sector slips as BANK of Algalteria warns on rising default rates",
      "Regulatory crackdown on Drift-currency derivatives hits finance sector broadly",
    ],
    Starships: [
      "Starship sector rallies on Pact Worlds fleet-expansion appropriation",
      "Near Space colonisation drive boosts commercial starship order book to record",
      "Drift-route opening to Vast drives shipbuilder orders up 30 percent",
      "Starship sector retreats on Drift-fuel cost surge impacting demand projections",
      "Hull-alloy supply constraint delays deliveries across the starship sector",
    ],
    Mining: [
      "Mining sector gains on Near Space rare-earth tariff relaxation announcement",
      "New Vast asteroid cluster discovery drives speculative buying across mining stocks",
      "Mining robot-fleet efficiency upgrade cuts extraction costs sector-wide",
      "Mining sector under pressure as Pact Worlds tightens environmental-impact rules",
      "Drift-piracy surge disrupts mining-equipment supply chains across Near Space",
    ],
    Energy: [
      "Energy sector rallies on Drift-route stability and falling transit fuel costs",
      "Near Space grid expansion tender drives competitive bidding across energy firms",
      "GRAV and PLSM joint innovation award lifts entire energy sector index",
      "Energy sector falls on unexpected Near Space power-demand forecast revision",
      "Eox gravity-tap moratorium threatens 15-percent reduction in sector output",
    ],
    Consumer: [
      "Consumer spending index hits cycle-high as Near Space wage growth accelerates",
      "Pact Worlds Drift festival week drives record retail and hospitality revenues",
      "Consumer confidence index jumps to 18-cycle high; retail stocks rally broadly",
      "Consumer sector retreats on weak Absalom Station discretionary spending data",
      "Rising inter-system freight costs squeeze consumer-goods margins sector-wide",
    ],
    Media: [
      "Media sector surges on record Drift-connected viewership numbers",
      "Near Space streaming wars heat up; content valuations spike across sector",
      "GAPC landmark deal spurs sector-wide re-rating of media growth multiples",
      "Media advertising revenue misses estimates; sector sells off broadly",
      "Pact Worlds content-licensing reform threatens cross-system distribution revenues",
    ],
    Logistics: [
      "Logistics sector rallies as Drift congestion clears and throughput records broken",
      "New Vast trade corridor opens; logistics firms reprice growth expectations",
      "DRFC efficiency upgrade announcement triggers sector-wide re-rating",
      "Logistics sector pressured as Free Captains piracy disrupts four major Drift lanes",
      "Drift-beacon maintenance backlog threatens logistics throughput for next two cycles",
    ],
    Terraform: [
      "Terraform sector gains on Near Space colonisation fund allocation announcement",
      "Pact Worlds terraforming standards update opens new commercial project categories",
      "Castrovel biome-restoration contract awarded; terraform sector optimism rises",
      "Terraform project delays on Akiton raise cost-overrun fears across sector",
      "Pact Worlds environmental council suspends three major terraform projects",
    ],
    Magitech: [
      "Magitech index surges on Arcanamirium pre-Gap technology integration approval",
      "Near Space governments commit to mandatory magitech-navigation upgrade for fleets",
      "Starfinder Society discovery unlocks new magitech applications; sector re-rated",
      "Magitech sector retreats on Azlanti reverse-engineering export-control proposals",
      "Pact Worlds arcane-regulation update creates compliance uncertainty for sector",
    ],
  };

  const REGIME_HEADLINES = {
    bull: [
      "Optimism spreads across Algalterian Exchange as buy orders surge",
      "Risk appetite returns; Algalterian Exchange enters sustained upswing",
      "Bullish sentiment grips the floor as positive macro data rolls in",
      "Algalterian Exchange crosses key resistance; analyst consensus turns bullish",
    ],
    bear: [
      "Selling pressure mounts as risk appetite retreats across sectors",
      "Bear market conditions take hold; broad-based selling across all indices",
      "Algalterian Exchange enters correction territory as macro fears resurface",
      "Risk-off sentiment dominates as traders reduce exposure across the board",
    ],
    volatile: [
      "Exchange volatility spikes as conflicting signals hit the floor",
      "Wild swings grip Algalterian Exchange; circuit-breaker threshold approached",
      "Intraday oscillations at cycle extremes as bulls and bears clash on the floor",
      "Volatility index surges to 18-cycle high; options premiums spike dramatically",
    ],
    calm: [
      "Market enters consolidation phase; trading volumes normalise",
      "Algalterian Exchange finds equilibrium; low-volatility session recorded",
      "Calm returns to the floor following recent turbulence; spreads tighten",
      "Range-bound trading conditions as investors await next macro catalyst",
    ],
    neutral: [
      "Algalterian Exchange returns to baseline after recent turbulence",
      "Mixed session closes flat; neither bulls nor bears gain decisive advantage",
      "Neutral tone prevails on the exchange floor; volume at seasonal average",
      "Indecision rules as macro signals cancel each other out on the floor",
    ],
    crash: [
      "Circuit breakers triggered as panic selling sweeps the exchange",
      "Exchange in freefall; emergency liquidity facility activated by AbadarCorp",
      "Black-market day on Algalterian Exchange as all indices crater simultaneously",
      "Stop-loss cascade devastates floor; halt-protocols invoked on 14 tickers",
    ],
    boom: [
      "Euphoric buying drives Algalterian Exchange to multi-cycle highs",
      "Mania on the exchange floor as every sector posts double-digit session gains",
      "Record turnover on Algalterian Exchange as speculative fever takes hold",
      "Algalterian Exchange in parabolic advance; bubble warnings issued by analysts",
    ],
  };

  // Weighted type: 60% news, 24% pump, 11% sector_pump, 5% regime
  const roll = r();
  const type = roll < 0.60 ? "news"
             : roll < 0.84 ? "pump"
             : roll < 0.95 ? "sector_pump"
             : "regime";

  // Magnitude influenced by current regime
  const BASE = {bull:0.08,boom:0.12,bear:-0.06,crash:-0.14,volatile:0.09,calm:0.04,neutral:0.05};
  const base = BASE[regime] ?? 0.05;
  const rawMag = base + (r() - 0.5) * 0.10;
  const mag = Math.max(-0.20, Math.min(0.20, rawMag));
  const dur = Math.floor(r() * 300 + 60); // 60–360 mins

  if (type === "news") {
    return { type: "news", headline: pick(NEWS) };
  }
  if (type === "pump") {
    const sym = pick(ALL_TICKERS);
    const th = TICKER_PUMPS[sym] || [];
    const headline = th.length ? pick(th) : `${sym} ${mag > 0 ? "surges" : "slides"} on exchange floor activity`;
    return { type: "pump", sym, mag, duration_mins: dur, headline, silent: false };
  }
  if (type === "sector_pump") {
    const sector = pick(SECTORS);
    const sh = SECTOR_PUMPS[sector] || [];
    const headline = sh.length ? pick(sh) : `${sector} sector ${mag > 0 ? "rallies" : "retreats"} amid Pact Worlds developments`;
    return { type: "sector_pump", sector, mag, duration_mins: dur, headline, silent: false };
  }
  // regime change — never same as current
  const REGIMES = ["bull","bear","volatile","calm","neutral","crash","boom"];
  const next = pick(REGIMES.filter(x => x !== regime));
  const rh = REGIME_HEADLINES[next];
  return { type: "regime", regime: next, headline: Array.isArray(rh) ? pick(rh) : rh };
}
// ─────────────────────────────────────────────────────────────────────────────

async function runAgent() {
  const cfg = await supaGet("cfg");
  if (!cfg) return;
  if (cfg.agentEnabled === false) return;

  const now = Date.now();
  const anchorG = cfg.anchorG || now;
  const anchorR = cfg.anchorR || now;
  const gameNow = cfg.paused
    ? anchorG
    : anchorG + (now - anchorR) * (cfg.speed || 1);

  const gameHoursElapsed = (gameNow - (cfg.lastAgentGameTime || 0)) / 3600000;
  if (gameHoursElapsed < 2) return;

  const events = await supaGet("ev") || [];
  const regimes = events.filter(e => e.t === "regime");
  const currentRegime = regimes.length ? regimes[regimes.length - 1].k : "neutral";

  const ev = generateEvent(currentRegime);

  const gameEvent = { at: now, g: gameNow, src: "agent" };

  if (ev.type === "news") {
    gameEvent.t = "news";
    gameEvent.msg = ev.headline;
  } else if (ev.type === "regime") {
    gameEvent.t = "regime";
    gameEvent.k = ev.regime;
    gameEvent.d = ["bull","boom"].includes(ev.regime) ? 0.15 : -0.15;
    gameEvent.xv = ["volatile","crash"].includes(ev.regime) ? 0.3 : 0;
    gameEvent.start = gameNow;
    gameEvent.end = gameNow + 864e5 * 7;
    gameEvent.seed = Math.floor(Math.random() * 0xFFFFFF);
    gameEvent.label = ev.regime.charAt(0).toUpperCase() + ev.regime.slice(1);
    gameEvent.body = ev.headline;
  } else if (ev.type === "pump") {
    gameEvent.t = "pump";
    gameEvent.sym = ev.sym;
    gameEvent.mag = ev.mag;
    gameEvent.dur = ev.duration_mins * 60000;
    gameEvent.silent = false;
    gameEvent.body = ev.headline;
  } else if (ev.type === "sector_pump") {
    gameEvent.t = "spump";
    gameEvent.sec = ev.sector;
    gameEvent.mag = ev.mag;
    gameEvent.dur = ev.duration_mins * 60000;
    gameEvent.silent = false;
    gameEvent.body = ev.headline;
  }

  events.push(gameEvent);
  if (events.length > 500) events.splice(0, events.length - 500);
  await supaSet("ev", events);
  cfg.lastAgentGameTime = gameNow;
  cfg.lastAgentAt = now;
  await supaSet("cfg", cfg);
}
