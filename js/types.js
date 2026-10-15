/* Right Hand Man - project types: oilfield, mechanical/industrial piping, underground utilities.
   Each type sets: takeoff trades shown first, a starting SOV (quantities and prices BLANK - fill from takeoff and your own bid/cost data),
   extra daily-log fields, and change-order situations with the standard to cite. Nothing here is a production rate or a price. */
'use strict';
const S = (item, desc, unit) => ({item, desc, unit, qty:0, price:0});
const PTYPES = {
  general:{ name:'General / structural', icon:'🏗', trades:null, sov:null, daily:[], sits:{} },
  oilfield:{ name:'Oilfield', icon:'🛢', blurb:'Well pads, lease roads, tank batteries, containment, SWD, compressor/equipment pads, racks, flowlines, skids',
    trades:['Oilfield', 'Mech piping', 'Underground', 'Excavation', 'Concrete', 'Rebar', 'Steel', 'General'],
    sov:[S('1','Mobilization / demobilization','LS'), S('2','Well pad - caliche','CY'), S('3','Lease road - caliche','CY'), S('4','Geotextile','SY'), S('5','Containment berm','CY'), S('6','Containment liner','SF'),
      S('7','Tank battery - set tanks','EA'), S('8','Compressor / equipment pads (concrete)','CY'), S('9','Pipe rack steel','TON'), S('10','Flowline - steel','LF'), S('11','Flowline - poly/HDPE (fused)','LF'),
      S('12','Field welds','DI'), S('13','Skids / packaged equipment set','EA'), S('14','SWD facility piping & equipment','LS'), S('15','Hydrotest','LS'), S('16','Trench safety (over 5 ft)','LF')],
    daily:[['lease','Lease / pad / well name','text'], ['afe','AFE / work order no.','text'], ['permit','Work permit / hot-work permit no.','text'], ['jsa','JSA / tailgate meeting held','yn'], ['h2s','H2S monitors bump-tested','yn'],
      ['sim','SIMOPS with rig / frac / production crew','yn'], ['caliche','Caliche hauled (loads / tickets)','text'], ['welds','Welds completed today','num'], ['nde','Welds NDE today (shot / rejected)','text'], ['spill','Spills / releases (none or describe)','text']],
    sits:{ reroute:['Operator re-routed a line or moved equipment', {msa:['api-1104','Operator MSA change/extra-work clause; weld/NDE per API 1104 as specified'], private:['aia-g702','Subcontract changes clause']}],
      standby:['Standby: waiting on rig, operator, permits or SIMOPS', {msa:['osha-1910-119','Operator MSA standby/delay rates; PSM permit/MOC waits (29 CFR 1910.119(k),(l)) where PSM applies'], private:['aia-g702','Subcontract delay clause']}],
      liner:['Permit/regulator required a bigger berm or heavier liner', {msa:['rrc-ch4','RRC 16 TAC Ch. 4 permit conditions (pits/recycling) and SPCC (40 CFR 112) containment'], private:['epa-spcc','40 CFR 112 secondary containment per the SPCC plan']}],
      caliche:['Caliche pit / haul distance changed', {msa:['rrc-og','Operator MSA - haul/source changes; document tickets and distance'], private:['aia-g702','Subcontract changes clause']}] } },
  mechanical:{ name:'Mechanical / industrial piping', icon:'🔧', blurb:'Pipe by size/schedule/material, fittings, valves, welds (DI), hydrotests, supports, equipment setting, insulation',
    trades:['Mech piping', 'Steel', 'Welding', 'Concrete', 'Coatings', 'General'],
    sov:[S('1','Mobilization / demobilization','LS'), S('2','Pipe - carbon steel','LF'), S('3','Pipe - stainless / alloy','LF'), S('4','Butt welds','DI'), S('5','Socket welds','DI'), S('6','Fittings','EA'), S('7','Valves','EA'), S('8','Flanged joints (bolt-ups)','EA'),
      S('9','Pipe supports','EA'), S('10','Equipment setting','EA'), S('11','Hydrotest','LS'), S('12','NDE coordination / repairs','LS'), S('13','Insulation','LF'), S('14','Painting / coating','SF')],
    daily:[['area','Area / unit / system','text'], ['iso','Isometrics / line numbers worked','text'], ['welds','Welds completed (count)','num'], ['di','Diameter-inches today','num'], ['rt','Welds shot today / rejects','text'],
      ['hydro','Hydrotest today (loop no., pressure, hold, pass/fail)','text'], ['permit','Hot-work / line-break permits','text'], ['psm','PSM orientation / MOC impacts','text'], ['welders','Welders on site (stencils)','text']],
    sits:{ spec:['Line class, material or NDE % changed after bid', {industrial:['asme-b313','ASME B31.3 fluid service / examination changes - owner spec revision'], private:['aia-g702','Subcontract changes clause']}],
      repair:['Weld repairs caused by owner-furnished material or design change', {industrial:['asme-ix','Owner-furnished material defects; repairs per qualified WPS (ASME IX)'], private:['aia-g702','Subcontract changes clause']}],
      hydro:['Extra hydrotests or re-tests not caused by us', {industrial:['asme-b313','B31.3 leak test requirements vs contract test plan'], private:['aia-g702','Subcontract changes clause']}],
      supports:['Extra pipe supports beyond the spec spacing / drawings', {industrial:['mss-sp58','Supports per MSS SP-58 and the support drawings - added supports are extra'], private:['aia-g702','Subcontract changes clause']}] } },
  underground:{ name:'Underground utilities', icon:'🚧', blurb:'Water, sanitary, storm, ductbank, gas, fiber: trench by depth class, embedment, backfill, pipe, structures, bores, testing, trench safety, paving',
    trades:['Underground', 'Excavation', 'Concrete', 'Oilfield', 'General'],
    sov:[S('1','Mobilization','LS'), S('2','Trench safety protection (separate pay item, Tex. H&S 756)','LF'), S('3','Special shoring','SF'), S('4','Water line','LF'), S('5','Sanitary sewer','LF'), S('6','Storm drain','LF'),
      S('7','Manholes','EA'), S('8','Manhole extra depth','VF'), S('9','Inlets','EA'), S('10','Valves','EA'), S('11','Fire hydrant assemblies','EA'), S('12','Services','EA'), S('13','Bore / HDD','LF'), S('14','Tracer wire','LF'),
      S('15','Testing (air / mandrel / hydro / CCTV)','LS'), S('16','Pavement repair','SY'), S('17','Ductbank','LF'), S('18','Gas line','LF'), S('19','Fiber conduit','LF')],
    daily:[['lf','Pipe laid today (LF, size, material)','text'], ['sta','Stations worked (from - to)','text'], ['maxd','Max trench depth today','num'], ['soil','Soil type (competent person, App. A)','text'], ['prot','Protective system used (box / slope / shore)','text'],
      ['cp','Competent person name','text'], ['insp','Trench inspected before start / after rain','yn'], ['locates','811 locate ticket no. / utilities exposed','text'], ['tests','Tests today (air, mandrel, hydro, CCTV, vacuum)','text'], ['water','Groundwater / dewatering','text']],
    sits:{ utility:['Unmarked or mislocated utility in the way', {city:['osha-1926-651','OSHA 1926.651(b) locate duties + NCTCOG Div. 100 differing conditions; document 811 ticket'], txdot:['tx-4','TxDOT Item 4, Art. 5 Differing Site Conditions'], private:['aia-g702','Subcontract concealed conditions clause']}],
      rock:['Rock or groundwater not shown in the geotech', {city:['tx-hs-756','Owner geotech info required by Tex. H&S Code 756.023(a)(3); NCTCOG Div. 100 differing conditions'], txdot:['tx-4','TxDOT Item 4, Art. 5 Differing Site Conditions'], private:['aia-g702','Subcontract concealed conditions clause']}],
      deeper:['Pipe deeper than plan (new depth class / special shoring)', {city:['tx-hs-756','Trench safety paid by LF and special shoring by SF (Tex. H&S 756.023)'], txdot:['tx-402','TxDOT Items 402/403 trench protection LF and special shoring SF'], private:['osha-1926-652','OSHA 1926.652 protective system for the new depth']}],
      tests:['Owner added tests (CCTV, extra air/mandrel, re-disinfection)', {city:['tceq-217','30 TAC 217 / 290 testing requirements vs contract'], txdot:['tx-9','TxDOT Item 9 Art. 7 extra work'], private:['aia-g702','Subcontract changes clause']}] } },
};
const ptype = P => PTYPES[(P && P.type) || 'general'] || PTYPES.general;
const ptypeSOV = t => (PTYPES[t].sov || []).map(s => ({...s, id:uid()}));
