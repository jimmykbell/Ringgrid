(() => {
    'use strict';
    const $ = id => document.getElementById(id), storePrefix = 'ringgrid23-tournament-', registryKey = 'ringgrid23-registry-v1', names = ['Alex Morgan', 'Jordan Lee', 'Taylor Brooks', 'Casey Bennett', 'Morgan Parker', 'Jamie Rivera', 'Avery Collins', 'Drew Foster', 'Riley Carter', 'Quinn Sullivan', 'Peyton Reed', 'Cameron Hayes', 'Skyler James', 'Reese Murphy', 'Dakota Turner', 'Rowan Cooper', 'Emerson Price', 'Finley Ward', 'Harper Bailey', 'Logan Gray', 'Sage Mitchell', 'Charlie Evans', 'Blake Phillips', 'Elliot Hughes', 'Hayden Scott', 'Parker Diaz', 'Milan Walker', 'Jules Richardson', 'Kendall Ross', 'Phoenix Kelly', 'Remy Sanders', 'Adrian Howard', 'Tatum Bell', 'Micah Wood', 'Arden Russell', 'Noel Jenkins', 'Marley Bryant', 'Frankie Coleman', 'Kai Henderson', 'Shiloh Perry', 'Lennon Powell', 'River Flores', 'Ellis Butler', 'Sydney Simmons', 'Bailey Patterson', 'Samira Khan', 'Nico Ramirez', 'Ari Thompson', 'Devon Clarke', 'Robin Ellis'];
    const events = ['OPEN', 'Form', 'Weapon', 'Combat', 'Sparring', 'Creative', 'Extreme', 'Creative Weapon', 'Extreme Weapon'];
    const codes = ['BCG8u', 'GWY910', 'GBLBR8u', 'B1BR8u', 'JUDGE', 'M11829', 'W11829', 'M233039', 'W233039', 'M234049', 'W234049', 'M455059', 'W455059', 'M453039', 'MASTER', 'M236069'];
    const beltCodes = ['W', 'O', 'Y', 'C', 'G', 'P', 'BL', 'BR', 'R', '1BR'];
    const ageCodes = ['8u', '910', '1112', '1314', '1517', '1829', '3039', '4049', '5059', '6069', '70u'];
    const ranks = [['W', 'White'], ['O', 'Orange'], ['Y', 'Yellow'], ['C', 'Camo'], ['G', 'Green'], ['P', 'Purple'], ['BL', 'Blue'], ['BR', 'Brown'], ['R', 'Red'], ['1BR', '1st Black Recommended'], ...Array.from({ length: 8 }, (_, i) => [String(i + 1), `${i + 1}${['st', 'nd', 'rd'][i] || 'th'} Degree`])];
    const eventColor = e => ['Form', 'Weapon', 'Combat'].includes(e) ? 'red' : ['Sparring', 'Creative', 'Extreme'].includes(e) ? 'orange' : 'green';
    // Center/A/B are required working positions. Fourth is optional, for rotation OR a break.
    const SLOT_LABELS = ['CENTER', 'JUDGE A', 'JUDGE B', 'OVERFLOW / ROTATION'];
    const ACTIVE_SLOTS = 3, MAX_SLOTS = 4;
    const position = j => SLOT_LABELS[j.slot] || SLOT_LABELS[0];
    const inSlot = (ring, slot, excludeId = null) => state.judges.find(j => j.id !== excludeId && j.ring === ring && j.slot === slot);
    const activeAtRing = ring => state.judges.filter(j => j.ring === ring && j.slot >= 0 && j.slot < ACTIVE_SLOTS && canWork(j));
    const breakAtRing = (ring, excludeId = null) => state.judges.find(j => j.id !== excludeId && j.ring === ring && j.onBreak);
    const divisionOf = (g, belts, age) => g + belts.join('') + age;
    let state, activeJudge = null, screen = 'tournaments', deferredPrompt = null, activeTournamentId = 'gmi-2026', remoteMode = false, remoteTournaments = [], adminAuthenticated = false;
    function seed() { return { judges: [], archivedRings: [], competitionLedger: [], rttlRequests: [], rings: Array.from({ length: 12 }, (_, i) => ({ id: i + 1, code: '', event: 'OPEN', capacity: 3 })), pending: [], activity: [], seq: 1 }; }
    function blankSeed(ringCount = 12) { const s = seed(); s.judges = []; s.seq = 1; s.rings = Array.from({ length: Math.max(1, Math.min(40, Number(ringCount) || 12)) }, (_, i) => ({ id: i + 1, code: '', event: 'OPEN', capacity: 3 })); return s; }
    const defaultTournament = { id: 'gmi-2026', name: 'Grandmaster Invitational 2026', date: '2026-11-13', location: 'Roswell, GA', ringCount: 12, status: 'Upcoming', hasStarterRoster: true };
    function getRegistry() { try {
        let a = JSON.parse(localStorage.getItem(registryKey));
        if (Array.isArray(a))
            return a;
    }
    catch { } return [defaultTournament]; }
    let tournaments = getRegistry(), cloudPending = [], cloudRTTL = [];
    function hostedNeedsFirebase() { return location.protocol === 'https:' && !remoteMode; }
    function localStoreKey() { return storePrefix + activeTournamentId; }
    function initialFor(id) { return id === 'gmi-2026' ? seed() : blankSeed((tournaments.find(x => x.id === id) || {}).ringCount); }
    function load() { try {
        let x = JSON.parse(localStorage.getItem(localStoreKey()));
        return x && x.judges && x.rings ? x : initialFor(activeTournamentId);
    }
    catch {
        return initialFor(activeTournamentId);
    } }
    state = load();
    state.archivedRings ??= [];
    state.competitionLedger ??= [];
    state.rttlRequests ??= [];
    state.judges.forEach(j => { j.ringsJudged ??= 0; j.ringsSinceBreak ??= j.ringsJudged; j.onBreak ??= false; j.creditedRingIds ??= []; j.hasCompeted ??= !!j.competing; j.completedDivisions ??= []; j.checkedIn ??= false; j.notifications ??= []; });
    state.rings.forEach(r => r.event ??= 'OPEN');
    state.archivedRings.forEach(r => r.event ??= 'OPEN');
    function save() { localStorage.setItem(localStoreKey(), JSON.stringify(state)); if (remoteMode && window.RinggridLive?.isAdmin?.())
        window.RinggridLive.saveAdminState(activeTournamentId, structuredClone(state)); }
    if (normalizeLegacyAssignments()) save();
    function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    const fatigueFaces = ['😎', '😁', '🙂', '😐', '😓', '🥵', '💀'];
    const fatigueTitles = ['Fresh', 'All Smiles', 'Feeling Good', 'Getting Tired', 'Needs Coffee', 'Exhausted', 'Send Help!'];
    function sinceBreak(j) {
        // The most recent break establishes a baseline against the lifetime total.
        // This avoids a stale ringsSinceBreak field re-inflating the fatigue meter.
        const total=Number(j.ringsJudged ?? 0), baseline=Number(j.fatigueResetAtTotal);
        if(j.fatigueResetAtTotal != null && Number.isFinite(total) && Number.isFinite(baseline))
            return Math.max(0, Math.floor(total-baseline));
        const value=Number(j.ringsSinceBreak ?? j.ringsJudged ?? 0);
        return Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0);
    }
    function fatigue(j) { const i = Math.min(6, sinceBreak(j)); return {emoji:fatigueFaces[i], title:fatigueTitles[i], count:sinceBreak(j)}; }
    function fatigueBadge(j) { const x=fatigue(j); return `<span class="fatigue-face" title="${x.title} · ${x.count} divisions since break" aria-label="${x.title}, ${x.count} divisions since break">${x.emoji}</span>`; }
    function canWork(j) { return !!j.checkedIn && !j.onBreak; }
    function normalizeLegacyAssignments() {
        // One-time migration for previous releases where a break judge could remain
        // in Center/A/B. Never reset counts, competition results or tournament data.
        let changed = false;
        for (const ring of state.rings || []) {
            const members = state.judges.filter(j => j.ring === ring.id);
            const used = new Set();
            for (const j of members) {
                if (!Number.isInteger(j.slot) || j.slot < 0 || j.slot >= MAX_SLOTS || used.has(j.slot)) {
                    const free = [0,1,2,3].find(n => !used.has(n));
                    if (free === undefined) continue; // Preserve historical assignments, do not silently remove a judge.
                    j.slot = free;
                    changed = true;
                }
                used.add(j.slot);
            }
            const resting = members.filter(j => j.onBreak);
            if (!resting.length) continue;
            const keep = resting.find(j => j.slot === 3) || resting[0];
            for (const other of resting) {
                if (other === keep) continue;
                other.breakFromRing = ring.id;
                other.ring = null;
                other.slot = null;
                changed = true;
            }
            if (keep.slot !== 3) {
                const overflow = inSlot(ring.id, 3, keep.id);
                if (overflow) {
                    overflow.slot = keep.slot;
                }
                keep.slot = 3;
                changed = true;
            }
        }
        return changed;
    }
    function resumeBreak(j) {
        if (!j.onBreak) return;
        j.onBreak = false;
        j.breakFromRing = null;
        notify(j, 'Your break has ended. You are available to judge again.');
        log(j.name + ' returned from break');
    }
    function toggleBreak(id, start) {
        const j = state.judges.find(x => x.id === id);
        if (!j) return;
        if (start && !j.checkedIn) return toast('A judge must be checked in before taking a break');
        if (start && j.competing) return toast('Finish their competition first');
        if (j.onBreak === start) return;
        if (start) {
            const origin = j.ring;
            const alreadyResting = origin ? state.judges.find(x => x.id !== j.id && x.onBreak && (x.ring === origin || x.breakFromRing === origin)) : null;
            if (alreadyResting && !confirm(`Ring ${origin} already has a judge on break. Do you confirm sending ${j.name} to break also?`)) return;
            if (alreadyResting) {
                // Only one break judge lives in a ring's overflow spot at a time.
                // A second resting judge remains attached to their home ring by reference,
                // and can be found in the global Judges on Break tab.
                j.breakFromRing = origin;
                j.ring = null;
                j.slot = null;
            } else if (origin && j.slot !== 3) {
                const overflow = inSlot(origin, 3, j.id);
                if (overflow) {
                    // Rotate the fourth active judge into the newly vacated working spot.
                    overflow.slot = j.slot;
                    notify(overflow, `Rotated into ${position(overflow)} in Ring ${origin}.`);
                }
                j.slot = 3;
            }
            j.onBreak = true;
            j.fatigueResetAtTotal = Number(j.ringsJudged) || 0;
            j.ringsSinceBreak = 0;
            notify(j, 'You are on break. Your fatigue meter has reset.');
            log(j.name + (origin ? ` started a break from Ring ${origin}` : ' started a break'));
        } else {
            resumeBreak(j);
        }
        save(); renderAdmin();
        if ($('modal').open) $('modal').close();
        manage(id);
        if (start) {
            const pane = $('breakJudgePanel');
            if (pane) { pane.open = true; const parent = pane.closest('.main-panel'); if (parent) parent.open = true; }
        }
        toast(start ? j.name + ' is on break · fatigue reset to 😎' : j.name + ' is back from break');
    }

    function toast(t) { $('toast').textContent = t; $('toast').style.display = 'block'; setTimeout(() => $('toast').style.display = 'none', 2400); }
    function log(t) { state.activity.unshift({ text: t, time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }); state.activity = state.activity.slice(0, 35); }
    function show(s) { screen = s; document.querySelectorAll('main.screen').forEach(x => x.hidden = x.id !== s); $('homeBtn').hidden = s === 'tournaments' || s === 'welcome'; if (s === 'tournaments')
        renderTournaments(); if (s === 'admin')
        renderAdmin(); if (s === 'judge')
        renderJudge(); window.scrollTo(0, 0); }
    function activeTournament() { return (remoteMode ? remoteTournaments : tournaments).find(t => t.id === activeTournamentId) || defaultTournament; }
    function renderTournaments() {
        let list = remoteMode ? remoteTournaments : tournaments;
        const holder = $('tournamentCards');
        if (!holder)
            return;
        $('tournamentMode').textContent = remoteMode ? 'FIREBASE LIVE' : 'LOCAL DEMO';
        holder.innerHTML = list.length ? list.map(t => `<article class="tournament-card"><div><strong>${esc(t.name)}</strong><p class="muted">${esc(t.date || 'Date not set')} · ${esc(t.location || 'Location not set')} · ${esc(t.status || 'Upcoming')}</p></div><button class="primary" data-select-tournament="${esc(t.id)}">Select Tournament</button></article>`).join('') : '<p class="muted">No tournaments yet. Sign in as Admin to create the first one.</p>';
    }
    function enterTournament(id) {
        const all = remoteMode ? remoteTournaments : tournaments;
        if (!all.some(t => t.id === id))
            return toast('Tournament not found');
        activeTournamentId = id;
        activeJudge = null;
        adminAuthenticated = false;
        state = remoteMode ? blankSeed((all.find(t => t.id === id) || {}).ringCount) : load();
        if (remoteMode)
            window.RinggridLive?.selectTournament?.(id);
        document.querySelectorAll('[data-current-tournament]').forEach(el => el.textContent = activeTournament().name);
        show('welcome');
    }
    function returnToTournaments() { activeJudge = null; adminAuthenticated = false; cloudPending = []; window.RinggridLive?.leaveTournament?.(); show('tournaments'); }
    function freshTournamentDetails() { return { name: $('tournamentName').value.trim(), date: $('tournamentDate').value, location: $('tournamentLocation').value.trim(), ringCount: Math.min(40, Math.max(1, +$('tournamentRings').value || 12)), status: 'Upcoming' }; }
    async function createTournament(e) {
        e.preventDefault();
        const t = freshTournamentDetails();
        if (t.name.length < 3)
            return $('tournamentCreateError').textContent = 'Enter a tournament name.';
        const original = state;
        const newState = blankSeed(t.ringCount);
        if ($('copyRoster').checked)
            newState.judges = original.judges.map((j, i) => ({ ...j, id: 'J' + (i + 1), checkedIn: false, ring: null, competing: false, hasCompeted: false, completedDivisions: [], creditedRingIds: [], ringsJudged: 0, ringsSinceBreak: 0, onBreak: false, response: 'none', declineCleared: false, notifications: [] }));
        newState.seq = newState.judges.length + 1;
        if (remoteMode) {
            try {
                await window.RinggridLive.createTournament(t, newState);
                $('tournamentCreateForm').reset();
                show('tournaments');
            }
            catch (err) {
                $('tournamentCreateError').textContent = err.message || 'Could not create tournament';
            }
            return;
        }
        const id = 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
        const record = { ...t, id };
        tournaments.push(record);
        localStorage.setItem(registryKey, JSON.stringify(tournaments));
        localStorage.setItem(storePrefix + id, JSON.stringify(newState));
        $('tournamentCreateForm').reset();
        show('tournaments');
        toast(t.name + ' created');
    }
    function applyRemoteState(incoming) {
        if (!remoteMode || !incoming || !Array.isArray(incoming.judges))
            return;
        state = incoming;
        state.pending = remoteMode && adminAuthenticated ? cloudPending : (state.pending || []);
        state.activity ??= [];
        state.archivedRings ??= [];
        state.competitionLedger ??= [];
    state.rttlRequests = remoteMode && adminAuthenticated ? cloudRTTL : (state.rttlRequests || []);
        state.judges.forEach(j => { j.ringsJudged ??= 0; j.ringsSinceBreak ??= j.ringsJudged; j.onBreak ??= false; j.creditedRingIds ??= []; j.completedDivisions ??= []; j.checkedIn ??= false; j.notifications ??= []; });
        if (normalizeLegacyAssignments() && window.RinggridLive?.isAdmin?.()) save();
        if (screen === 'judge')
            renderJudge();
        if (screen === 'admin')
            renderAdmin();
    }
    function mergeCheckins(ids) { if (!remoteMode)
        return; const set = new Set(ids); state.judges.forEach(j => { j.checkedIn = set.has(j.id); }); if (screen === 'judge')
        renderJudge(); if (screen === 'admin')
        renderAdmin(); }
    window.RinggridBridge = { showModal: modal, applyPhoneUpdate: (judgeId, phone) => { const j = state.judges.find(x => x.id === judgeId); if (j) {
            j.phone = phone;
            save();
            renderAdmin();
            toast('Phone updated for ' + j.name);
        } }, setRTTLRequests:requests=>{ if(remoteMode){cloudRTTL=requests||[];state.rttlRequests=cloudRTTL;if(screen==='admin')renderAdmin();} }, setPending: pending => { if (!remoteMode)
            return; cloudPending = pending; state.pending = pending; if (screen === 'admin')
            renderAdmin(); }, setLiveMode: on => { remoteMode = !!on; if (screen === 'tournaments')
            renderTournaments(); }, setTournaments: a => { remoteTournaments = a || []; if (screen === 'tournaments')
            renderTournaments(); }, applyRemoteState, mergeCheckins, getAdminState: () => structuredClone(state), getTournament: () => activeTournament(), getTournamentId: () => activeTournamentId, notify: toast, getScreen: () => screen, setAdminAuthed: value => adminAuthenticated = !!value };
    function nameKey(v) { return String(v || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase(); }
    function isNameTaken(name, excludePendingId = null) { const key = nameKey(name); return state.judges.some(j => nameKey(j.name) === key) || state.pending.some(p => p.id !== excludePendingId && nameKey(p.name) === key); }
    function formatPhone(v) { let p = normalizePhone(v); return p ? p.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3') : ''; }
    function checkInJudge(id, yes = true, suppliedPhone = '') {
        const j = state.judges.find(x => x.id === id);
        if (!j)
            return;
        if (!yes && j.competing)
            return toast('Finish competition before undoing check-in'); if (!yes && j.onBreak) return toast('End this judge’s break before undoing check-in');
        if (j.checkedIn === yes) return;
        if (yes && !j.hasPhone && !normalizePhone(j.phone)) {
            const formatted = formatPhone(suppliedPhone || $('checkinPhone')?.value || '');
            if (!formatted) {
                if (screen !== 'judge') modal(`<h3>Judge Check-In</h3><p>${esc(j.name)} has no phone number on file. Please enter their mobile number to check them in.</p><label>Mobile number <input id="adminCheckinPhone" type="tel" inputmode="tel" maxlength="12" placeholder="888-123-4567"></label><div class="modal-actions"><button class="primary" data-confirm-checkin-phone="${esc(j.id)}">Save Number &amp; Check In</button></div>`);
                else toast('Enter your 10-digit mobile number to check in.');
                return;
            }
            j.phone = formatted;
            j.hasPhone = true;
        }
        j.checkedIn = yes;
        log(j.name + (yes ? ' checked in' : ' check-in reversed'));
        save();
        if (remoteMode)
            window.RinggridLive?.setCheckin?.(activeTournamentId, j.id, yes, suppliedPhone || $('checkinPhone')?.value || '').catch(err => { j.checkedIn=!yes; renderJudge(); toast('Live check-in failed: ' + err.message); });
        if (screen === 'judge')
            renderJudge();
        else
            renderAdmin();
        toast(yes ? j.name + ' checked in and available' : j.name + ' marked not checked in');
    }
    function notify(j, t) { j.notifications.unshift({ text: t, time: new Date().toLocaleTimeString(), read: false }); j.notifications = j.notifications.slice(0, 15); }
    function assign(id, ring, slot = -1) {
        const j = state.judges.find(x => x.id === id);
        if (!j) return;
        if (ring && !state.rings.some(r => r.id === ring)) return toast('Ring not found');
        if (ring && j.competing) return toast('Judge is competing; mark available first');
        if (!ring) {
            j.ring = null;
            j.slot = null;
            j.response = 'none';
            if (j.onBreak) j.breakFromRing ??= null;
            notify(j, 'Your ring assignment has been cleared.');
            log(j.name + ' removed from assignment');
            save(); renderAdmin(); toast('Ring assignment cleared');
            return;
        }
        if (slot < 0) {
            const candidates = j.onBreak ? [3] : [0, 1, 2, 3];
            slot = candidates.find(n => !inSlot(ring, n, j.id));
            if (slot === undefined) return toast(j.onBreak ? 'End the break first or free the overflow spot' : 'Ring already has four judges');
        }
        if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_SLOTS) return toast('Invalid judging position');
        if (j.ring === ring && j.slot === slot) return;
        const other = inSlot(ring, slot, j.id);
        if (other && (!j.ring || j.slot == null || !Number.isInteger(j.slot))) return toast(`${position(other)} is occupied by ${other.name}. Choose an empty spot or rotate an assigned judge.`);
        if (other && j.ring !== ring && inSlot(j.ring, j.slot, j.id)) return toast('Previous judging position is occupied. Move that judge first.');
        if (j.onBreak && slot < ACTIVE_SLOTS && !confirm(`Do you confirm ${j.name} is off of break?`)) return;
        if (other?.onBreak && j.slot < ACTIVE_SLOTS && !confirm(`Do you confirm ${other.name} is off of break?`)) return;
        // An on-break judge may use overflow, but a ring may have only one such judge.
        if (j.onBreak && slot === 3 && breakAtRing(ring, j.id)) return toast(`Ring ${ring} already has a judge on break. End a break before placing another in overflow.`);
        if (other?.onBreak && j.ring && j.slot === 3 && breakAtRing(j.ring, other.id)) return toast(`Ring ${j.ring} already has a judge on break.`);
        if (!other && j.ring !== ring && state.judges.filter(x => x.ring === ring).length >= MAX_SLOTS) return toast('Ring already has four judges');
        const previousRing = j.ring, previousSlot = j.slot;
        if (j.onBreak && slot < ACTIVE_SLOTS) resumeBreak(j);
        if (other) {
            if (other.onBreak && previousSlot < ACTIVE_SLOTS) resumeBreak(other);
            other.ring = previousRing;
            other.slot = previousSlot;
            other.response = previousRing ? 'assigned' : 'none';
            notify(other, previousRing ? `Rotated to ${position(other)} in Ring ${previousRing}.` : 'Your ring assignment has been cleared.');
            log(other.name + (previousRing ? ` rotated to Ring ${previousRing} ${position(other)}` : ' unassigned'));
        }
        j.ring = ring;
        j.slot = slot;
        j.response = 'assigned';
        if (!j.onBreak) j.breakFromRing = null;
        notify(j, `Assigned to Ring ${ring} · ${position(j)}${j.onBreak ? ' (on break)' : ''}.`);
        log(j.name + ` assigned to Ring ${ring} ${position(j)}`);
        save(); renderAdmin(); toast('Ring positions saved');
    }
    function setCompete(id) { let j = state.judges.find(x => x.id === id); if (j?.division === 'JUDGE' || j?.eligibleToCompete === false) {
        toast('Judge-only registrations cannot compete');
        return;
    } if (!j)
        return; if (!j.competing && !j.checkedIn)
        return toast('Judge must check in before competing'); if (!j.competing && j.onBreak) return toast('End this judge’s break before competition'); if (!j.competing && j.ring) {
        toast('Remove ' + j.name + ' from Ring ' + j.ring + ' before competing');
        return;
    } if (!j.competing && j.completedDivisions.includes(j.division)) {
        toast(j.name + ' already completed this division');
        return;
    } j.competing = !j.competing; if (j.competing)
        j.hasCompeted = true;
    else if (!j.completedDivisions.includes(j.division))
        j.completedDivisions.push(j.division); if (j.competing) {
        j.ring = null;
        j.response = 'none';
    } notify(j, j.competing ? 'You are marked as competing.' : 'You are now available for judging.'); log(j.name + (j.competing ? ' marked competing' : ' marked available')); save(); renderAdmin(); }
    function response(id, val) { let j = state.judges.find(x => x.id === id); if (!j || !j.ring)
        return; j.response = val; j.declineCleared = false; notify(j, val === 'confirmed' ? 'You confirmed Ring ' + j.ring + '.' : 'You declined Ring ' + j.ring + '. Admin has been notified.'); log(j.name + (val === 'confirmed' ? ' confirmed' : ' declined') + ' Ring ' + j.ring); save(); if (screen === 'judge')
        renderJudge();
    else
        renderAdmin(); toast('Response recorded in Demo Mode'); }
    function autoDivision(id) { let r = state.rings.find(r => r.id === id); return r?.code || 'No division — create one'; }
    function competitionGroups() { const groups = new Map(); for (const j of state.judges.filter(x => x.competing)) {
        const code = j.division || 'Unspecified';
        if (!groups.has(code))
            groups.set(code, []);
        groups.get(code).push(j);
    } return groups; }
    function renderCompetitionControls() {
        const selector = $('competitionDivision'), previous = selector.value;
        const codes = [...new Set(state.judges.map(j => j.division).filter(c => c && c !== 'JUDGE'))].sort();
        selector.innerHTML = '<option value="">Select a division…</option>' + codes.map(code => `<option value="${esc(code)}">${esc(code)}</option>`).join('');
        if (codes.includes(previous))
            selector.value = previous;
        const members = state.judges.filter(j => j.division === selector.value);
        const blocked = members.filter(j => j.ring || j.onBreak);
        const absent = members.filter(j => !j.checkedIn);
        const already = members.filter(j => j.competing);
        const finished = members.filter(j => j.completedDivisions.includes(j.division));
        $('divisionPreview').innerHTML = members.length ? `<div class="division-members">${members.map(j => `<div class="division-member"><strong>${esc(j.name)}</strong><small>${j.ring ? '🔒 Judging Ring ' + j.ring : j.competing ? 'Already competing' : j.completedDivisions.includes(j.division) ? '✓ Completed division' : !j.checkedIn ? 'Not checked in' : j.onBreak ? '☕ On break' : '✓ Available'}</small></div>`).join('')}</div>${blocked.length ? `<p class="blocked-message">Remove ${blocked.length} assigned judge(s) from their rings first.</p>` : ''}${absent.length ? `<p class="blocked-message">⚠ ${absent.length} missing judge(s) will be listed in the confirmation and skipped.</p>` : ''}` : '<p class="muted">Choose a division to load its registered judges.</p>';
        $('sendDivisionBtn').disabled = !members.some(j => j.checkedIn) || blocked.some(j => j.checkedIn) || already.length > 0 || finished.length > 0;
        $('sendDivisionBtn').textContent = members.length ? `Send ${members.filter(j => j.checkedIn && !j.competing && !j.completedDivisions.includes(j.division)).length} Checked-In to Competition` : 'Send Division to Competition';
        $('activeCompetitionDivisions').innerHTML = [...competitionGroups()].map(([code, judges]) => {
            const visible = judges.filter(j => j.name.toLowerCase().includes($('competingSearch').value.trim().toLowerCase()));
            if (!visible.length)
                return '';
            return `<div class="active-division competition-group"><div class="competition-group-header"><strong>${esc(code)}</strong><small>${judges.length} competing</small><button data-finish-division="${esc(code)}">Division Finished</button></div>${visible.map(j => `<div class="judge-row judge-competing"><div><strong>${esc(j.name)}</strong><small>${j.rank}° · ${esc(j.division)}</small></div><button data-modal-compete="${j.id}">Finished Competing</button></div>`).join('')}</div>`;
        }).join('') || '<p class="muted">No matching competing judges.</p>';
    }
    let divisionFilters = { active: null, completed: null };
    function matchDivision(r, filter) { if (!filter) return true; if (filter.packet && !(r.packet || '').toLowerCase().includes(filter.packet.toLowerCase())) return false; const setup = r.setup; if (filter.level) {
        if (setup?.level) {
            if (setup.level !== filter.level)
                return false;
        }
        else if (!r.code?.endsWith(filter.level))
            return false;
    } if (filter.gender) {
        if (setup?.gender) {
            if (setup.gender !== filter.gender)
                return false;
        }
        else if (!r.code?.startsWith(filter.gender))
            return false;
    } if (filter.rank || filter.age) {
        if (!setup)
            return false;
        if (filter.rank) {
            const lo = ranks.findIndex(x => x[0] === setup.startRank), hi = ranks.findIndex(x => x[0] === setup.endRank), target = ranks.findIndex(x => x[0] === filter.rank);
            if (target < lo || target > hi)
                return false;
        }
        if (filter.age) {
            const lo = ageCodes.indexOf(setup.startAge), hi = ageCodes.indexOf(setup.endAge), target = ageCodes.indexOf(filter.age);
            if (target < lo || target > hi)
                return false;
        }
    } return true; }
    function divisionSearchModal(kind) { const f = divisionFilters[kind] || {}; const opts = (items, selected) => items.map(([v, label]) => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(label)}</option>`).join(''); modal(`<h3>Search ${kind === 'active' ? 'Active' : 'Completed'} Divisions</h3><p class="muted">All fields optional. Rank and age match divisions containing your selection.</p><div class="division-search-grid"><label>Competition Level<select id="searchDivisionLevel">${opts([['', 'All Levels'], ['R', 'Recreational'], ['C', 'Champion']], f.level)}</select></label><label>Division<select id="searchDivisionGender">${opts([['', 'All Divisions'], ['B', 'Boys'], ['G', 'Girls'], ['M', 'Men'], ['W', 'Women']], f.gender)}</select></label><label>Rank<select id="searchDivisionRank">${opts([['', 'All Ranks'], ...ranks], f.rank)}</select></label><label>Age Bracket<select id="searchDivisionAge">${opts([['', 'All Ages'], ...ageCodes.map((v, i) => [v, ['8 & Under', '9–10', '11–12', '13–14', '15–17', '18–29', '30–39', '40–49', '50–59', '60–69', '70+'][i]])], f.age)}</select></label><label>Packet #<input id="searchDivisionPacket" placeholder="Any packet" value="${esc(f.packet || '')}"></label></div><div class="modal-actions"><button class="primary" data-apply-division-search="${kind}">Search Divisions</button><button data-clear-division-search="${kind}">Clear Search</button></div>`); }
    function renderRingPanel() {
        const entries = [
            ['needsJudges', state.rings.filter(r => activeAtRing(r.id).length < ACTIVE_SLOTS)],
            ['openRings', state.rings.filter(r => r.event === 'OPEN')],
            ['activeDivisions', state.rings.filter(r => !!r.code && matchDivision(r, divisionFilters.active))],
        ];
        for (const [key, rings] of entries) {
            $(key + 'Count').textContent = rings.length;
            $(key + 'List').innerHTML = rings.map(r => { let count = state.judges.filter(j => j.ring === r.id).length; return `<button class="ring-jump" data-jump-ring="${r.id}"><strong>Ring ${r.id}</strong><small>${esc(r.code || 'No division')}${r.packet ? ' · Packet #' + esc(r.packet) : ''} · ${activeAtRing(r.id).length}/${ACTIVE_SLOTS} working ready</small></button>`; }).join('') || '<p class="muted">None right now.</p>';
        }
    }
    function renderAdmin() {
        const deleteButton = $('deleteTournamentBtn');
        if (deleteButton) deleteButton.hidden = remoteMode ? !window.RinggridLive?.isOwner?.() : false;
        $('adminManagementBtn').hidden = remoteMode ? !window.RinggridLive?.isOwner?.() : false;
        let assigned = state.judges.filter(j => j.ring).length, available = state.judges.filter(j => canWork(j) && !j.ring && !j.competing).length;
        $('summary').textContent = `${state.judges.length} judges · ${assigned} assigned · ${available} available · ${state.judges.filter(j => !j.checkedIn).length} not checked in · ${state.judges.filter(j => j.competing).length} competing`;
        $('competitionCount').textContent = state.competitionLedger.reduce((n, x) => n + (Number(x.bodyCount) || 0), 0).toLocaleString();
        $('competingCount').textContent = state.judges.filter(j => j.competing).length;
        $('registrationCount').textContent = state.pending.length;
        const openRTTL=(state.rttlRequests||[]).filter(x=>x.status!=='resolved');
        $('rttlCount').textContent=openRTTL.length;
        const inbox=$('adminRTTLInbox');if(inbox){inbox.classList.toggle('has-requests',openRTTL.length>0);if(openRTTL.length)inbox.open=true;}
        const rttlTime=x=>x?.createdAt?.seconds ? x.createdAt.seconds*1000 : (Date.parse(x?.createdAt||'')||0);
        $('rttlRequestsList').innerHTML=openRTTL.length?openRTTL.sort((a,b)=>rttlTime(b)-rttlTime(a)).map(x=>`<div class="rttl-request"><strong>${esc(x.reason==='break'?'Replacement for break':x.reason==='assignment'?'Need an assignment':'Other')}</strong><div>${esc(x.judgeName)} · Ring ${esc(x.ring)}</div>${x.details?`<p>${esc(x.details)}</p>`:''}<button class="primary" data-resolve-rttl="${esc(x.id)}">Mark Resolved</button></div>`).join(''):'<p class="muted">No open RTTL requests.</p>';
        $('pendingBadge').textContent = state.pending.length ? '(' + state.pending.length + ')' : '';
        $('rings').innerHTML = state.rings.map(r => {
            const js = state.judges.filter(j => j.ring === r.id);
            const ready = activeAtRing(r.id).length;
            const color = r.event === 'OPEN' ? (ready ? 'green' : 'red') : eventColor(r.event);
            const slots = SLOT_LABELS.map((label, slot) => {
                const j = js.find(x => x.slot === slot);
                return j ? `<div class="slot ${slot === 3 ? 'overflow-slot' : ''} ${j.onBreak ? 'on-break-slot' : ''}" draggable="true" data-drag="${esc(j.id)}" data-drop="${r.id}" data-slot="${slot}"><div><small class="position-label">${label}</small><div class="person"><button type="button" class="ring-judge-link" data-judge-actions="${esc(j.id)}" title="View details for ${esc(j.name)}">${esc(j.name)}</button>${fatigueBadge(j)}</div><small>${j.rank}° · ${esc(j.division)} · ${j.onBreak ? '☕ On Break' : j.checkedIn ? '✓ Checked In' : '⌛ Not Here Yet'}</small></div><button data-unassign="${esc(j.id)}" title="Remove">×</button></div>` : `<div class="slot empty ${slot === 3 ? 'overflow-slot' : ''}" data-drop="${r.id}" data-slot="${slot}"><strong>${label}</strong> · ${slot === 3 ? 'Extra judge or break' : 'Drop judge here'}</div>`;
            }).join('');
            return `<article class="ring event-${color}" data-ring="${r.id}"><div class="ring-top"><strong>Ring ${r.id}</strong><span class="status ${ready === ACTIVE_SLOTS ? 'confirmed' : 'pending'}">${ready}/${ACTIVE_SLOTS} working ready · ${js.length}/4 assigned</span></div><div class="ring-sub">Division <strong>${esc(r.code || 'Not configured')}</strong>${r.code ? ` · ${r.bodyCount || 0} competitors` : ''}${r.packet ? ` · Packet #${esc(r.packet)}` : ''}</div><label class="ring-sub">Current Event<select data-ring-event="${r.id}">${events.map(v => `<option value="${esc(v)}" ${v === r.event ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label><div class="slots">${slots}</div><div class="ring-actions"><button class="primary" data-configure="${r.id}">${r.code ? 'Edit Division' : '+ Create Division'}</button><button data-fill="${r.id}">+ Assign Judge</button>${r.code ? `<button class="archive-btn" data-archive="${r.id}">Archive Division</button>` : ''}<button data-remove-ring="${r.id}" ${r.code || js.length ? 'disabled' : ''}>Remove Ring</button></div></article>`;
        }).join('');
        $('archiveCount').textContent = state.archivedRings.length + ' archived';
        $('archivedRings').innerHTML = state.archivedRings.length ? state.archivedRings.map(r => `<div class="archived-item"><div><strong>Ring ${r.id}</strong><small>${esc(r.code)}${r.packet ? ' · Packet #' + esc(r.packet) : ''} · ${esc(r.event)} · ${r.judges.length} judges</small></div><button data-view-archive="${r.archiveId}">View History</button></div>`).join('') : '<p class="muted">No archived rings yet.</p>';
        $('judgeTotal').textContent = state.judges.length;
        $('availableCount').textContent = available;
        $('notCheckedInCount').textContent = state.judges.filter(j => !j.checkedIn).length;
        const rankOptions = '<option value="">All ranks</option>' + Array.from({ length: 8 }, (_, i) => { let n = 8 - i; return `<option value="${n}">${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} Degree</option>`; }).join('');
        for (const id of ['rankFilter', 'availableRank']) {
            let el = $(id);
            if (el && !el.options.length)
                el.innerHTML = rankOptions;
        }
        const matches = (j, prefix) => j.name.toLowerCase().includes($(prefix + 'Search').value.trim().toLowerCase()) && (!$(prefix + 'Rank').value || j.rank === Number($(prefix + 'Rank').value));
        const card = (j) => `<div class="judge-row ${j.ring ? 'judge-assigned' : ''} ${j.competing ? 'judge-competing' : ''} ${!j.checkedIn ? 'judge-absent' : ''}" draggable="true" data-drag="${j.id}"><div><strong>${esc(j.name)} ${fatigueBadge(j)}</strong>${j.onBreak ? '<span class="break-label">ON BREAK</span>' : ''}${j.ring ? `<span class="ring-label">RING ${j.ring} · ${position(j)}</span>` : j.competing ? '<span class="competing-label">COMPETING</span>' : !j.checkedIn ? '<span class="absent-label">NOT CHECKED IN</span>' : '<span class="present-label">CHECKED IN</span>'}<small>${j.rank}° · ${esc(j.division)} · ${j.ringsJudged} total · ${sinceBreak(j)} since break · ${j.division === 'JUDGE' ? 'JUDGE' : j.hasCompeted ? 'Competed' : 'Not competed'}</small></div><button data-judge-actions="${j.id}">Manage</button></div>`;
        let search = $('search').value.toLowerCase(), sort = $('judgeSort').value, rank = $('rankFilter').value;
        const sorted = [...state.judges].filter(j => j.name.toLowerCase().includes(search) && (!rank || j.rank === Number(rank))).sort((a, b) => sort === 'rank' ? b.rank - a.rank || a.name.localeCompare(b.name) : sort === 'ringsAsc' ? a.ringsJudged - b.ringsJudged || a.name.localeCompare(b.name) : sort === 'ringsDesc' ? b.ringsJudged - a.ringsJudged || a.name.localeCompare(b.name) : sort === 'competed' ? Number(b.hasCompeted) - Number(a.hasCompeted) || a.name.localeCompare(b.name) : sort === 'notCompeted' ? Number(a.hasCompeted) - Number(b.hasCompeted) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
        $('judgeList').innerHTML = sorted.map(j => card(j) + `<div class="judge-message">${messageLink(j)}</div>`).join('') || '<p class="muted">No matching judges.</p>';
        $('availableList').innerHTML = state.judges.filter(j => canWork(j) && !j.ring && !j.competing && matches(j, 'available')).sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name)).map(j => card(j) + `<div class="judge-message">${messageLink(j)}</div>`).join('') || '<p class="muted">No matching available judges.</p>';
        const resting = state.judges.filter(j => j.onBreak).sort((a,b) => (a.ring || a.breakFromRing || 999)-(b.ring || b.breakFromRing || 999) || a.name.localeCompare(b.name));
        $('breakJudgeCount').textContent = resting.length;
        $('breakJudgeList').innerHTML = resting.length ? resting.map(j => card(j) + `<div class="judge-message">${j.ring ? `Overflow in Ring ${j.ring}` : `Break list · from Ring ${esc(j.breakFromRing || '—')}`} · <button data-end-break="${esc(j.id)}">End Break</button></div>`).join('') : '<p class="muted">No judges currently on break.</p>';
        const missingQuery = $('notCheckedInSearch').value.trim().toLowerCase();
        $('notCheckedInList').innerHTML = state.judges.filter(j => !j.checkedIn && j.name.toLowerCase().includes(missingQuery)).sort((a, b) => a.name.localeCompare(b.name)).map(j => `<div class="judge-row judge-absent"><div><strong>${esc(j.name)}</strong><small>${j.rank}° · ${esc(j.division)}</small></div><button class="primary" data-admin-checkin="${j.id}">Check In</button></div>`).join('') || '<p class="muted">All matching judges have checked in.</p>';
        renderCompetitionControls();
        renderRingPanel();
        $('notificationList').innerHTML = state.activity.slice(0, 20).map(a => `<div class="activity-item">${esc(a.text)}<small>${esc(a.time)}</small></div>`).join('');
    }
    function renderJudge() {
        const resting = state.judges.filter(j => j.onBreak).sort((a,b) => a.name.localeCompare(b.name));
        const publicBreakList = $('judgeBreakList');
        if (publicBreakList) publicBreakList.innerHTML = resting.length ? resting.map(j => `<div class="break-roster-row"><strong>${esc(j.name)}</strong><small>${j.ring ? 'Ring ' + esc(j.ring) + ' · Overflow' : 'From Ring ' + esc(j.breakFromRing || '—') + ' · Break list'}</small></div>`).join('') : '<p class="muted">No judges currently on break.</p>';
        const publicCount = $('judgeBreakCount'); if (publicCount) publicCount.textContent = resting.length;
        const j = state.judges.find(x => x.id === activeJudge), profile = $('judgeProfile'), inbox = $('judgeNotifications');
        if (!j) {
            profile.hidden = true;
            inbox.hidden = true;
            return;
        }
        profile.hidden = false;
        inbox.hidden = false;
        const isShared = !j.phone && !j.hasPhone;
        profile.innerHTML = `<div class="profile-top"><span class="avatar">${esc(j.name.split(' ').map(x => x[0]).join(''))}</span><div><h3>${esc(j.name)} ${fatigueBadge(j)}</h3><p class="muted">${j.rank}° Black Belt · ${esc(j.division)} · ${j.ringsJudged} total divisions · ${sinceBreak(j)} since last break${j.onBreak ? ' · On Break' : ''}</p></div></div>
<div class="arrival-status ${j.checkedIn ? 'arrived' : 'absent'}"><strong>${j.checkedIn ? '✓ Checked In' : 'Not Checked In'}</strong><span>${j.onBreak ? 'You are on break. Your assignment stays on record.' : j.checkedIn ? 'You are marked present and ready to judge.' : 'Confirm arrival; any preassigned ring remains yours.'}</span></div>
${!j.checkedIn ? `${!j.hasPhone && !normalizePhone(j.phone) ? `<label class="required-checkin-phone">Mobile number required to check in<input id="checkinPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="12" placeholder="888-123-4567" required></label>` : ''}<button class="primary wide-button" data-judge-checkin="${j.id}">✓ I'm Here — Check In</button>` : ''}
<div class="assignment-label">YOUR CURRENT RING ASSIGNMENT</div>
<div class="assignment">${j.ring ? 'RING ' + j.ring : j.competing ? 'CURRENTLY COMPETING' : 'No Ring Assigned Yet'}</div>
<p class="muted">${j.ring ? 'Position: ' + position(j) + ' · ' + (j.onBreak ? 'On break' : j.checkedIn ? 'Checked in' : 'Not checked in yet') : j.onBreak ? 'On break from Ring ' + esc(j.breakFromRing || '—') + ' · Listed under Judges on Break' : j.competing ? 'You are temporarily unavailable for judging.' : j.checkedIn ? 'You are available when Admin assigns a ring.' : 'Check in to confirm your arrival.'}</p>

<div class="profile-update"><h3>My Mobile Number</h3><p class="muted">${isShared ? 'No mobile number on file. Please add your number.' : (j.phone ? 'Number on file: ' + esc(j.phone) : 'Phone number already on file')}</p>
<form id="updateJudgePhoneForm"><label for="judgePhoneUpdate">${isShared ? 'Enter your mobile number' : 'Update your number'}<input id="judgePhoneUpdate" type="tel" inputmode="tel" maxlength="12" placeholder="888-123-4567" value="${isShared ? '' : esc(j.phone)}" required></label>
<button class="primary" type="submit">${remoteMode && !window.RinggridLive?.isAdmin?.() ? 'Request Phone Update' : 'Save Mobile Number'}</button><p id="judgePhoneResult" class="registration-message" role="status"></p></form></div>
<p class="hint">Name search does not verify identity. Please only access your own judge profile.</p>`;
        inbox.innerHTML = '<h3>Assignment Updates</h3>' + (j.notifications.length ? j.notifications.map(n => `<div class="notice ${n.read ? '' : 'unread'}">${esc(n.text)}<small>${esc(n.time)}</small></div>`).join('') : '<p class="muted">No notifications yet.</p>');
        const unread=j.notifications.filter(n=>!n.read);
        if(unread.length){unread.forEach(n=>n.read=true);if(!remoteMode)save();}
    }
    function searchJudge() {
        const q = nameKey($('judgeNameSearch').value), result = $('judgeMatches');
        activeJudge = null;
        renderJudge();
        if (q.length < 2) {
            result.innerHTML = '<p class="error">Enter at least two characters of your name.</p>';
            return;
        }
        const matches = state.judges.filter(j => nameKey(j.name).includes(q)).sort((a, b) => a.name.localeCompare(b.name));
        result.innerHTML = matches.length ? `<p class="muted">Select your name from ${matches.length} match${matches.length === 1 ? '' : 'es'}:</p><div class="search-results">${matches.map(j => `<button type="button" class="judge-result" data-judge-pick="${j.id}"><strong>${esc(j.name)}</strong><small>${j.rank}° Black Belt · ${j.onBreak ? 'On Break' : j.checkedIn ? 'Checked In' : 'Not Checked In'}</small></button>`).join('')}</div>` : '<p class="muted">No judge found. Check the spelling or register below if you are new.</p>';
    }
    function modal(html) { $('modalContent').innerHTML = html; $('modal').showModal(); }
    function messageLink(j) { const phone = normalizePhone(j.phone); return phone ? `<a class="message-link" href="sms:+1${phone}" title="Open Messages for ${esc(j.name)} at ${esc(formatPhone(phone))}">✉ Message</a>` : ''; }
    function manage(id) {
        let j = state.judges.find(x => x.id === id);
        modal(`<h3>${esc(j.name)} ${fatigueBadge(j)}</h3><p><strong>Phone on file:</strong> ${esc(formatPhone(j.phone) || 'No phone')} ${messageLink(j)}</p><label>Correct Judge Phone<input id="adminJudgePhone" type="tel" inputmode="tel" maxlength="12" value="${esc(formatPhone(j.phone))}" placeholder="888-123-4567"></label><div class="modal-actions"><button data-save-judge-phone="${j.id}">Save Corrected Phone</button></div><p>${j.rank}° Black Belt · <button class="division-code-link" data-open-judge-division="${esc(j.division)}">${esc(j.division)} ↗</button> · ${j.ringsJudged} total divisions · <strong>${sinceBreak(j)} since last break</strong></p>
<p><strong>${j.checkedIn ? '✓ Checked In' : 'Not Checked In'}</strong> · ${j.competing ? 'Competing' : j.ring ? 'Ring ' + j.ring : 'Not assigned'}</p>
<div class="fatigue-break-control"><strong>Judge Fatigue: ${fatigue(j).emoji} ${fatigue(j).title}</strong><span>${sinceBreak(j)} division${sinceBreak(j)===1?'':'s'} since last break · ${j.ringsJudged} total</span>${j.onBreak ? `<button class="primary" data-end-break="${j.id}">End Break · Resume Judging</button>` : `<button data-give-break="${j.id}" ${!j.checkedIn||j.competing?'disabled':''}>☕ Give Judge a Break</button>`}<small>${j.onBreak?'Judges on break remain in Overflow or the Judges on Break list; they cannot work Center/A/B until break is ended.':'Breaks reset only the emoji count, never the lifetime total.'}</small></div>
<div class="modal-actions"><button class="primary" data-admin-checkin="${j.id}" ${j.checkedIn ? 'disabled' : ''}>Check In Judge</button>${j.checkedIn ? `<button data-admin-undo-checkin="${j.id}" ${j.competing || j.onBreak ? 'disabled' : ''}>Undo Check-In</button>` : ''}</div>
<label>Assign to ring<select id="moveTarget"><option value="">Unassigned</option>${state.rings.map(r => `<option value="${r.id}" ${j.ring === r.id ? 'selected' : ''}>Ring ${r.id} (${esc(r.code)})</option>`).join('')}</select></label><label>Position<select id="moveSlot"><option value="-1">First available</option>${SLOT_LABELS.map((name,n)=>`<option value="${n}" ${j.ring && j.slot===n ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
<div class="modal-actions"><button class="primary" data-modal-move="${j.id}">Save Assignment</button>${j.division === 'JUDGE' ? '' : `<button data-modal-compete="${j.id}">${j.competing ? 'Finished Competing' : 'Mark Competing'}</button>`}<button data-view-judge="${j.id}">View Judge Portal</button></div>
${!j.checkedIn ? '<p class="muted">This judge can be preassigned but is NOT PRESENT until checked in. Check-in is still required before competing.</p>' : ''}`);
    }
    function judgeDivision(rank, gender, age, level) { const r = Number(rank), group = r === 1 ? '1' : r <= 3 ? '23' : r <= 5 ? '45' : '68'; const g = gender === 'W' ? 'W' : 'M'; return g + group + age + level; }
    function normalizePhone(v) { let p = String(v || '').replace(/\D/g, ''); if (p.length === 11 && p[0] === '1')
        p = p.slice(1); return p.length === 10 ? p : ''; }
    function addJudgeRecord(record, { autoCheckIn = false } = {}) { const name = String(record.name || '').trim(), rank = Number(record.rank), gender = String(record.gender || 'M').trim().toUpperCase(), comp = String(record.competing || 'no').trim().toLowerCase(), level = String(record.level || 'C').trim().toUpperCase(), age = String(record.age || '').trim(), phone = normalizePhone(record.phone); if (!name || !Number.isInteger(rank) || rank < 1 || rank > 8 || !['M', 'W', 'MALE', 'FEMALE'].includes(gender) || !['yes', 'no'].includes(comp) || (autoCheckIn && !phone) || (comp === 'yes' && (!ageCodes.includes(age) || !['C', 'R', 'CHAMPION', 'RECREATIONAL'].includes(level))))
        return 'Invalid fields'; if (isNameTaken(name))
        return 'This name is already registered or pending'; const g = gender === 'FEMALE' ? 'W' : gender === 'MALE' ? 'M' : gender, l = level === 'CHAMPION' ? 'C' : level === 'RECREATIONAL' ? 'R' : level; state.judges.push({ id: 'J' + state.seq++, name, rank, division: comp === 'yes' ? judgeDivision(rank, g, age, l) : 'JUDGE', phone: phone ? phone.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3') : '', ring: null, checkedIn: autoCheckIn, competing: false, hasCompeted: false, eligibleToCompete: comp === 'yes', completedDivisions: [], ringsJudged: 0, ringsSinceBreak: 0, onBreak: false, creditedRingIds: [], response: 'none', notifications: [] }); return ''; }
    function parseCsv(text) { const rows = []; let row = [], cell = '', quoted = false; for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            if (quoted && text[i + 1] === '"') {
                cell += '"';
                i++;
            }
            else
                quoted = !quoted;
        }
        else if (c === ',' && !quoted) {
            row.push(cell);
            cell = '';
        }
        else if ((c === '\n' || c === '\r') && !quoted) {
            if (c === '\r' && text[i + 1] === '\n')
                i++;
            row.push(cell);
            if (row.some(v => v.trim()))
                rows.push(row);
            row = [];
            cell = '';
        }
        else
            cell += c;
    } row.push(cell); if (row.some(v => v.trim()))
        rows.push(row); const heads = (rows.shift() || []).map(v => v.trim().toLowerCase()); return rows.map(r => Object.fromEntries(heads.map((key, i) => [key, r[i] || '']))); }
    let pendingCsv = [];
    function showJudgeDivision(code) {
        if (code === 'JUDGE') {
            toast('Judge-only registrations have no competition division');
            return;
        }
        const members = state.judges.filter(j => j.division === code);
        const blocked = members.filter(j => j.checkedIn).some(j => j.onBreak || j.ring || j.competing || (j.completedDivisions || []).includes(code)) || !members.some(j => j.checkedIn);
        modal(`<h3>Division ${esc(code)}</h3><p class="muted">${members.length} registered judge(s)</p>` +
            members.map(j => `<div class="modal-row"><strong>${esc(j.name)}</strong><p class="muted">${j.rank}° · ${j.ring ? 'Judging Ring ' + j.ring : j.competing ? 'Currently competing' : (j.completedDivisions || []).includes(code) ? 'Completed division' : 'Available'}</p></div>`).join('') +
            (blocked ? '<p class="blocked-message">Cannot send: checked-in judges must be unassigned and not already competing or completed.</p>' : '') +
            `<div class="modal-actions"><button class="primary" data-send-judge-division="${esc(code)}" ${blocked || !members.length ? 'disabled' : ''}>Send Checked-In Members to Competition</button></div>`);
    }
    function sendWholeDivision(code) {
        const members = state.judges.filter(j => j.division === code && j.eligibleToCompete !== false);
        if (!members.length)
            return toast('No registered competitors in this division');
        const missing = members.filter(j => !j.checkedIn), present = members.filter(j => j.checkedIn);
        const resting = present.filter(j => j.onBreak);
        if (resting.length) return toast('End break before competition: ' + resting.map(j=>j.name).join(', '));
        if (!present.length)
            return toast('Nobody in this division is checked in. There is no one to send.');
        if (present.some(j => j.ring))
            return toast('Remove checked-in members from their judging rings first');
        if (present.some(j => j.competing || (j.completedDivisions || []).includes(code)))
            return toast('Some checked-in members are already competing or have finished');
        if (missing.length) {
            const msg = `Are you sure you want to send division ${code} to compete with ${missing.length} missing member(s)?\n\nNOT CHECKED IN:\n${missing.map(j => '• ' + j.name).join('\n')}\n\nOnly the ${present.length} checked-in member(s) will compete. Missing members remain on the roster and not competing.`;
            if (!confirm(msg))
                return;
        }
        present.forEach(j => { j.competing = true; j.hasCompeted = true; j.response = 'none'; notify(j, 'Your division ' + code + ' is now competing.'); });
        log(code + ' sent to competition: ' + present.length + ' checked in' + (missing.length ? ' (' + missing.length + ' no-shows skipped)' : ''));
        save();
        $('modal').close();
        renderAdmin();
        toast(present.length + ' checked-in judge(s) sent; ' + missing.length + ' missing left unchanged');
    }
    function declinedAlerts() { let declined = state.judges.filter(j => j.response === 'declined' && !j.declineCleared); modal('<h3>Declined Assignments</h3>' + (declined.length ? declined.map(j => `<div class="modal-row"><strong>${esc(j.name)}</strong><p class="muted">Ring ${j.ring || '—'} · ${esc(j.division)}</p><button data-clear-decline="${j.id}">Clear</button></div>`).join('') + '<div class="modal-actions"><button class="primary" data-clear-all-declines>Clear All Alerts</button></div>' : '<p class="muted">No outstanding declines.</p>') + '<p class="hint">Clear acknowledges the alert only. The declined response stays on record.</p>'); }
    function findRings() { let ranks = ['W', 'O', 'Y', 'C', 'G', 'P', 'BL', 'BR', 'R', '1BR', '1', '2', '3', '4', '5', '6', '7', '8']; modal(`<h3>Find Student's Ring</h3><p class="muted">Search by student details, or by ring number / division code. Results include active and archived divisions.</p><div class="configure-grid"><label>Division<select id="findGender"><option value="B">Boys</option><option value="G">Girls</option><option value="M">Men</option><option value="W">Women</option></select></label><label>Belt / Degree<select id="findBelt">${ranks.map((r, i) => `<option value="${r}">${['White', 'Orange', 'Yellow', 'Camo', 'Green', 'Purple', 'Blue', 'Brown', 'Red', '1st Black Recommended', '1st Degree', '2nd Degree', '3rd Degree', '4th Degree', '5th Degree', '6th Degree', '7th Degree', '8th Degree'][i]}</option>`).join('')}</select></label><label>Age<input id="findAge" type="number" min="1" max="100" value="9"></label><label>Competition Level<select id="findLevel"><option value="R">Recreational</option><option value="C">Champion</option></select></label></div><label>Or search code / ring number<input id="findRingQuery" placeholder="e.g. GGBR910C or Ring 4"></label><div id="findRingResults"></div>`); const ageBounds = c => ({ '8u': [0, 8], '910': [9, 10], '1112': [11, 12], '1314': [13, 14], '1516': [15, 16], '1718': [17, 18], '1829': [18, 29], '3039': [30, 39], '4049': [40, 49], '5059': [50, 59], '6069': [60, 69], '70u': [70, 150] })[c] || [0, 150]; const matches = r => { if (!r.code)
        return false; let q = $('findRingQuery').value.trim().toLowerCase(); if (q)
        return String(r.id).includes(q.replace(/^ring\s*/, '')) || r.code.toLowerCase().includes(q); let setup = r.setup; if (!setup)
        return false; let gender = $('findGender').value, rank = $('findBelt').value, age = +$('findAge').value, level = $('findLevel').value; let x = ranks.indexOf(rank), lo = ranks.indexOf(setup.startRank), hi = ranks.indexOf(setup.endRank), a = ageBounds(setup.startAge)[0], b = ageBounds(setup.endAge)[1]; return setup.gender === gender && setup.level === level && x >= lo && x <= hi && age >= a && age <= b; }; const update = () => { let rows = [...state.rings.filter(r => r.code).map(r => ({ ...r, archived: false })), ...state.archivedRings.map(r => ({ ...r, archived: true }))].filter(matches); $('findRingResults').innerHTML = rows.map(r => `<div class="modal-row"><strong>Ring ${r.id} · ${esc(r.code)}${r.packet ? ' · Packet #' + esc(r.packet) : ''}</strong><p class="muted">${r.archived ? 'ARCHIVED' : 'COMPETING / ACTIVE'} · ${esc(r.event || 'OPEN')} · ${r.bodyCount || 0} competitors</p></div>`).join('') || '<p class="muted">No matching active or archived rings found.</p>'; }; ['findGender', 'findBelt', 'findAge', 'findLevel', 'findRingQuery'].forEach(id => $(id).addEventListener('input', update)); update(); }
    function approvals() { modal('<h3>Pending Judge Registrations</h3>' + (state.pending.length ? state.pending.map(p => `<div class="modal-row"><strong>${esc(p.name)}</strong><p class="muted">${p.rank}° · ${esc(p.division)} · ${esc(p.phone)}</p><div class="modal-actions"><button class="primary" data-approve="${p.id}">Approve</button><button class="danger" data-reject="${p.id}">Reject</button></div></div>`).join('') : '<p class="muted">No pending registrations.</p>')); }
    function fill(r) { modal(`<h3>Assign Judge to Ring ${r}</h3><p class="muted">Search all unassigned judges, including those not yet checked in. Preassignment does not mark them present.</p><div class="division-search-grid"><label>Search by Name<input id="assignNameSearch" placeholder="Type a name…"></label><label>Search by Rank<select id="assignRankSearch"><option value="">All Ranks</option>${Array.from({ length: 8 }, (_, i) => 8 - i).map(n => `<option value="${n}">${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} Degree</option>`).join('')}</select></label></div><label>Available Judge<select id="fillJudge"></select></label><div id="assignJudgeResults" class="muted"></div><div class="modal-actions"><button class="primary" data-fill-confirm="${r}">Assign Judge</button></div>`); renderAssignOptions(); }
    function renderAssignOptions() { const input = $('assignNameSearch'); if (!input)
        return; const q = input.value.toLowerCase().trim(), rank = $('assignRankSearch').value, available = state.judges.filter(j => !j.ring && !j.competing && !j.onBreak && j.name.toLowerCase().includes(q) && (!rank || j.rank === +rank)).sort((a, b) => a.name.localeCompare(b.name)); const select = $('fillJudge'), old = select.value; select.innerHTML = available.map(j => `<option value="${j.id}">${esc(j.name)} · ${j.rank}° · ${esc(j.division)} · ${j.checkedIn ? 'Checked In' : 'PREASSIGN · Not Here Yet'} · ${j.ringsJudged} rings judged</option>`).join(''); if (available.some(j => j.id === old))
        select.value = old; $('assignJudgeResults').textContent = available.length + ' unassigned judge(s) match, including preregistered judges who have not checked in'; const button = document.querySelector('[data-fill-confirm]'); if (button)
        button.disabled = !available.length; }
    function register() {
        const name = $('regName').value.trim().replace(/\s+/g, ' '), phone = normalizePhone($('regPhone').value), rank = Number($('regRank').value), yes = $('regCompeting').value === 'yes';
        const result = $('registrationResult');
        result.textContent = '';
        result.className = 'registration-message';
        if (!name.includes(' ') || !name.split(' ').every(Boolean)) {
            result.textContent = 'Please enter your first and last name.';
            result.classList.add('error');
            return;
        }
        if (!phone) {
            result.textContent = 'Enter a valid 10-digit mobile phone number.';
            result.classList.add('error');
            return;
        }
        if (isNameTaken(name)) {
            result.textContent = 'Already Registered: this name is already on the roster or awaiting approval. Search above to check your assignment, or see tournament staff.';
            result.classList.add('error');
            return;
        }
        const cat = $('regCategory').value, age = $('regAge').value, g = $('regGender').value, level = $('regLevel').value === 'Champion' ? 'C' : 'R';
        const division = yes ? g + cat + age + level : 'JUDGE';
        const pending = { id: 'P' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), name, phone: formatPhone(phone), rank, division, eligibleToCompete: yes, checkedIn: false,
            gender: yes ? g : '', competitionRank: yes ? cat : '', ageGroup: yes ? age : '', ringLevel: yes ? (level === 'C' ? 'Champion' : 'Recreational') : '', ringDivision: yes ? cat : '' };
        state.pending.push(pending);
        log('New judge registration submitted: ' + name);
        save();
        if (remoteMode)
            window.RinggridLive?.submitRegistration?.(activeTournamentId, pending).catch(err => toast('Live registration failed: ' + err.message));
        $('registrationForm').reset();
        toggleReg();
        result.textContent = name + ' is pending Admin approval. You are not checked in yet.';
        result.classList.add('success');
        toast('Registration submitted for approval (demo only)');
    }
    function toggleReg() { let on = $('regCompeting').value === 'yes'; ['regCatWrap', 'regGenderWrap', 'regAgeWrap', 'regLevelWrap'].forEach(id => $(id).hidden = !on); }
    $('changeTournamentBtn').onclick = returnToTournaments;
    $('addTournamentBtn').onclick = () => { if (hostedNeedsFirebase())
        return toast('Connect and configure Firebase before creating tournaments on GitHub Pages'); $('tournamentAuthError').textContent = ''; show('tournamentAuth'); };
    $('cancelTournamentAuth').onclick = returnToTournaments;
    $('cancelTournamentCreate').onclick = returnToTournaments;
    $('tournamentAuthForm').onsubmit = async (e) => {
        e.preventDefault();
        $('tournamentAuthError').textContent = '';
        if (remoteMode) {
            try {
                await window.RinggridLive.login($('tournamentAuthUser').value.trim(), $('tournamentAuthPass').value);
                adminAuthenticated = true;
                if (!window.RinggridLive.isOwner()) {
                    $('tournamentAuthError').textContent = 'Only the Ringgrid Owner can create tournaments.';
                    return;
                }
                show('newTournament');
            }
            catch (err) {
                $('tournamentAuthError').textContent = err.message || 'Not authorized to create tournaments';
            }
            return;
        }
        if ($('tournamentAuthUser').value === 'admin' && $('tournamentAuthPass').value === 'ringgrid21') {
            adminAuthenticated = true;
            show('newTournament');
        }
        else
            $('tournamentAuthError').textContent = 'Incorrect demo Admin credentials';
    };
    $('tournamentCreateForm').onsubmit = createTournament;
    document.addEventListener('click', e => { let t = e.target.closest('[data-select-tournament]'); if (t)
        enterTournament(t.dataset.selectTournament); });
    $('adminEntry').onclick = () => { if (hostedNeedsFirebase())
        return toast('Firebase connection needed for Admin on GitHub Pages'); show('login'); };
    $('judgeEntry').onclick = () => { if (hostedNeedsFirebase())
        return toast('Firebase connection needed for check-in on GitHub Pages'); activeJudge = null; $('judgeNameSearch').value = ''; $('judgeMatches').innerHTML = ''; show('judge'); };
    $('homeBtn').onclick = returnToTournaments;
    $('judgeHome').onclick = () => show('welcome');
    $('loginForm').onsubmit = async (e) => {
        e.preventDefault();
        $('loginError').textContent = '';
        if (remoteMode) {
            try {
                await window.RinggridLive.login($('loginUser').value.trim(), $('loginPass').value);
                adminAuthenticated = true;
                show('admin');
            }
            catch (err) {
                $('loginError').textContent = err.message || 'Sign-in failed';
            }
            return;
        }
        if ($('loginUser').value === 'admin' && $('loginPass').value === 'ringgrid21') {
            adminAuthenticated = true;
            show('admin');
        }
        else
            $('loginError').textContent = 'Incorrect demo login';
    };
    $('adminLogout').onclick = async () => { adminAuthenticated = false; if (remoteMode)
        await window.RinggridLive.logout(); show('welcome'); };
    $('deleteTournamentBtn').onclick = () => { if (remoteMode && !window.RinggridLive?.isOwner?.())
        return toast('Only the Owner can delete tournaments'); const t = activeTournament(); modal(`<h3>Delete Tournament</h3><p><strong>${esc(t.name)}</strong></p><p class="blocked-message">This permanently deletes the tournament, all its registered judges, check-ins, ring assignments, registration requests and history. This cannot be undone.</p><label>Type the exact tournament name to confirm<input id="deleteTournamentName" autocomplete="off" placeholder="${esc(t.name)}"></label><p id="deleteTournamentError" class="error" role="alert"></p><div class="modal-actions"><button type="button" class="danger" data-confirm-delete-tournament="${esc(t.id)}">Permanently Delete Tournament</button><button type="button" data-cancel-delete-tournament>Cancel</button></div>`); };
    document.addEventListener('click', async (e) => { if (e.target.closest('[data-cancel-delete-tournament]')) {
        $('modal').close();
        return;
    } const button = e.target.closest('[data-confirm-delete-tournament]'); if (!button)
        return; const id = button.dataset.confirmDeleteTournament, t = activeTournament(); if (id !== activeTournamentId || id !== t.id) {
        $('deleteTournamentError').textContent = 'Selected tournament changed. Cancel and try again.';
        return;
    } if ($('deleteTournamentName').value.trim() !== t.name) {
        $('deleteTournamentError').textContent = 'Enter the exact tournament name to confirm deletion.';
        return;
    } button.disabled = true; button.textContent = 'Deleting tournament and its data…'; try {
        if (remoteMode) {
            await window.RinggridLive.deleteTournament(id);
            localStorage.removeItem(storePrefix + id);
        }
        else {
            tournaments = tournaments.filter(x => x.id !== id);
            localStorage.setItem(registryKey, JSON.stringify(tournaments));
            localStorage.removeItem(storePrefix + id);
        }
        $('modal').close();
        returnToTournaments();
        toast(t.name + ' permanently deleted');
    }
    catch (error) {
        $('deleteTournamentError').textContent = 'Deletion failed: ' + (error.message || error) + '. If partial, retry to finish deleting remaining records.';
        button.disabled = false;
        button.textContent = 'Retry Permanent Delete';
    } });
    $('phoneRequestsBtn').onclick = () => window.RinggridLive?.showPhoneRequests?.(activeTournamentId) || toast('No live phone requests in local demo');
    $('approvalBtn').onclick = approvals;
    $('sidebarRegistrations').onclick = approvals;
    $('competitionDivision').onchange = renderCompetitionControls;
    $('sendDivisionBtn').onclick = () => sendWholeDivision($('competitionDivision').value);
    $('findRingBtn').onclick = findRings;
    function configureRing(id) { let r = state.rings.find(x => x.id === id); if (!r)
        return; const ranks = [['W', 'White'], ['O', 'Orange'], ['Y', 'Yellow'], ['C', 'Camo'], ['G', 'Green'], ['P', 'Purple'], ['BL', 'Blue'], ['BR', 'Brown'], ['R', 'Red'], ['1BR', '1st Black Recommended'], ...Array.from({ length: 8 }, (_, i) => [String(i + 1), `${i + 1}${['st', 'nd', 'rd'][i] || 'th'} Degree`])]; let rankOptions = ranks.map(([v, l]) => `<option value="${v}">${l}</option>`).join(''); let ageOptions = ageCodes.map((v, i) => `<option value="${v}">${({ '8u': '8 & Under', '70u': '70 & Over', '910': '9–10', '1112': '11–12', '1314': '13–14', '1517': '15–17', '1829': '18–29', '3039': '30–39', '4049': '40–49', '5059': '50–59', '6069': '60–69' })[v] || v}</option>`).join(''); modal(`<h2>Configure Ring ${id}</h2><div class="configure-grid"><label>Competition level<select id="newRingLevel"><option value="R">Recreational</option><option value="C">Champion</option></select></label><label>Division<select id="newRingGender"><option value="B">Boys</option><option value="G">Girls</option><option value="M">Men</option><option value="W">Women</option></select></label><label>Starting rank<select id="newRingStartRank">${rankOptions}</select></label><label>Ending rank<select id="newRingEndRank">${rankOptions}</select></label><label>Starting age bracket<select id="newRingStartAge">${ageOptions}</select></label><label>Ending age bracket<select id="newRingEndAge">${ageOptions}</select></label><label>Body Count<input id="newRingBodyCount" type="number" min="0" step="1" value="${r.bodyCount || 0}"></label><label>Packet #<input id="newRingPacket" type="text" maxlength="30" placeholder="e.g. 125" value="${esc(r.packet || '')}"></label></div><div class="division-preview" id="newRingDivision"></div><div class="modal-actions"><button id="cancelRingConfig">Cancel</button><button class="primary" data-create-ring>Save Ring</button></div>`); $('modal').dataset.ringId = id; let saved = r.setup || {}; $('newRingLevel').value = saved.level || 'R'; $('newRingGender').value = saved.gender || 'B'; $('newRingStartRank').value = saved.startRank || 'W'; $('newRingEndRank').value = saved.endRank || 'W'; $('newRingStartAge').value = saved.startAge || '8u'; $('newRingEndAge').value = saved.endAge || '8u'; const update = () => { let start = ranks.findIndex(x => x[0] === $('newRingStartRank').value), end = ranks.findIndex(x => x[0] === $('newRingEndRank').value); if (start > end) {
        $('newRingEndRank').value = $('newRingStartRank').value;
        end = start;
    } let a = ageCodes.indexOf($('newRingStartAge').value), b = ageCodes.indexOf($('newRingEndAge').value); if (a > b) {
        $('newRingEndAge').value = $('newRingStartAge').value;
        b = a;
    } let rankPart = start === end ? ranks[start][0] : (start >= 10 && end >= 10 && start === 11 && end === 12 ? '23' : start >= 10 && end >= 10 && start === 13 && end === 14 ? '45' : ranks[start][0] + ranks[end][0]); let agePart = a === b ? ageCodes[a] : (ageCodes[a] === '8u' ? '8' : ageCodes[a].slice(0, 2)) + (ageCodes[b] === '70u' ? 'u' : ageCodes[b].slice(-2)); $('newRingDivision').textContent = $('newRingGender').value + rankPart + agePart + $('newRingLevel').value; }; ['newRingLevel', 'newRingGender', 'newRingStartRank', 'newRingEndRank', 'newRingStartAge', 'newRingEndAge'].forEach(k => $(k).addEventListener('change', update)); $('cancelRingConfig').onclick = () => $('modal').close(); update(); }
    ;

    function submitRTTLRequest(e){
        e.preventDefault();
        const judgeName=$('rttlName').value.trim().replace(/\s+/g,' '), ring=$('rttlRing').value.trim(), reason=$('rttlReason').value, details=$('rttlDetails').value.trim();
        const status=$('rttlStatus'); status.textContent=''; status.className='registration-message';
        if(!judgeName.includes(' ') || !ring || !['break','assignment','other'].includes(reason) || (reason==='other'&&!details)) {
            status.textContent='Enter your first and last name, ring (or N/A), and request details for Other.';status.classList.add('error');return;
        }
        const id='rttl-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
        const request={id,judgeName,ring,reason,details:reason==='other'?details:'',status:'open',createdAt:new Date().toISOString()};
        const button=$('sendRTTLBtn');button.disabled=true;button.textContent='Sending…';
        const done=()=>{status.textContent=(remoteMode?'Your request was sent to the RTTL.':'Your request is saved in this browser (LOCAL DEMO ONLY, not delivered to another device).')+' For emergencies or tournament problems, send a judge in person.';status.classList.add('success');toast('RTTL request sent');button.disabled=false;button.textContent='Send Request';};
        const fail=err=>{status.textContent='REQUEST NOT SENT. Please contact the RTTL in person. '+(err?.code==='permission-denied'?'Firestore permission denied; Admin must check the deployed RTTL security rules.':(err?.message||err));status.classList.add('error');button.disabled=false;button.textContent='Send Request';};
        if(remoteMode){const sender=window.RinggridLive?.sendRTTLRequest; if(typeof sender==='function')sender(activeTournamentId,request).then(done).catch(fail); else fail(Error('Live messaging is unavailable.'));}
        else if(hostedNeedsFirebase()){fail(Error('This page is not connected to Firebase. Check the connection status and reload.'));}
        else{state.rttlRequests??=[];state.rttlRequests.push(request);save();done();}
    }
    $('rttlForm').onsubmit=submitRTTLRequest;
    document.querySelectorAll('.judge-accordion').forEach(section=>section.addEventListener('toggle',()=>{if(section.open)document.querySelectorAll('.judge-accordion').forEach(other=>{if(other!==section)other.open=false})}));
    $('rttlReason').onchange=()=>{$('rttlDetailsWrap').hidden=$('rttlReason').value!=='other';$('rttlDetails').required=$('rttlReason').value==='other'};
    document.addEventListener('click',async e=>{
        const el=e.target.closest('[data-resolve-rttl]');if(!el)return;
        el.disabled=true;
        try{if(remoteMode)await window.RinggridLive.resolveRTTLRequest(activeTournamentId,el.dataset.resolveRttl);
        else{const r=state.rttlRequests.find(x=>x.id===el.dataset.resolveRttl);if(r)r.status='resolved';save();renderAdmin();}
        toast('RTTL request resolved');}catch(err){el.disabled=false;toast('Could not resolve request: '+err.message)}
    });
    $('adminManagementBtn').onclick=()=>{if(remoteMode){window.RinggridLive?.showAdminManager?.().catch(err=>toast(err.message));return;}modal('<h3>Admin Management</h3><p>Live Admin invitations require Firebase.</p>')};
    $('closeModal').onclick = () => $('modal').close();
    $('search').oninput = renderAdmin;
    ['rankFilter', 'availableRank'].forEach(id => $(id).onchange = renderAdmin);
    ['availableSearch', 'competingSearch', 'notCheckedInSearch'].forEach(id => $(id).oninput = renderAdmin);
    $('judgeSort').onchange = renderAdmin;
    $('judgeSearchForm').onsubmit = e => { e.preventDefault(); searchJudge(); };
    $('regCompeting').onchange = toggleReg;
    $('registrationForm').onsubmit = e => { e.preventDefault(); register(); };
    $('regRank').innerHTML = Array.from({ length: 8 }, (_, i) => `<option value="${i + 1}">${i + 1}${['st', 'nd', 'rd'][i] || 'th'} Degree</option>`).join('');
    $('addJudgeBtn').onclick = () => modal(`<h3>Add Judge</h3><div class="configure-grid">
<label>Name<input id="quickName" placeholder="Full name"></label>
<label>Rank<select id="quickRank">${Array.from({ length: 8 }, (_, i) => `<option value="${i + 1}">${i + 1}° Black Belt</option>`).join('')}</select></label>
<label>Gender<select id="quickGender"><option value="M">Male</option><option value="W">Female</option></select></label>
<label>Competing?<select id="quickCompeting"><option value="yes">Yes</option><option value="no">No</option></select></label>
<label class="quick-competition">Competition<select id="quickLevel"><option value="C">Champion</option><option value="R">Recreational</option></select></label>
<label class="quick-competition">Age Bracket<select id="quickAge">${ageCodes.map(a => `<option value="${a}">${a}</option>`).join('')}</select></label>
<label>Phone / Area Code<input id="quickPhone" type="tel" inputmode="tel" placeholder="888-123-4567" maxlength="14"></label>
</div><p class="muted">Non-competing judges are assigned division JUDGE. Judges added here are checked in immediately.</p><div class="modal-actions"><button class="primary" data-add-confirm>Add to Roster</button></div>`);
    $('importJudgesBtn').onclick = () => modal(`<h3>Import Judges CSV</h3><p class="muted">CSV headers: name,rank,gender,competing,level,age,phone</p><button data-download-template>Download CSV Template</button><p class="muted">To import your 113-judge private roster from this package, use the JSON import below. Do not upload that JSON file to GitHub.</p><label>Private roster JSON (.json)<input type="file" id="privateRosterFile" accept=".json,application/json"></label><div id="privateRosterPreview" class="muted"></div><div class="modal-actions"><button class="primary" data-private-roster-import disabled>Import Private Roster</button></div><label>Select CSV file<input type="file" id="judgeCsvFile" accept=".csv,text/csv"></label><div id="csvPreview"></div><div class="modal-actions"><button class="primary" data-import-confirm disabled>Import Valid Judges</button></div>`);
    ;
    document.addEventListener('click', e => {
        let t = e.target.closest('[data-give-break],[data-end-break],[data-judge-pick],[data-judge-checkin],[data-admin-checkin],[data-admin-undo-checkin],[data-confirm-checkin-phone],[data-download-template],[data-private-roster-import],[data-import-confirm],[data-open-judge-division],[data-send-judge-division],[data-search-divisions],[data-apply-division-search],[data-clear-division-search],[data-finish-division],[data-jump-ring],[data-unassign],[data-fill],[data-judge-actions],[data-respond],[data-self-compete],[data-modal-move],[data-modal-compete],[data-view-judge],[data-approve],[data-reject],[data-save-judge-phone],[data-fill-confirm],[data-add-confirm],[data-create-ring],[data-archive],[data-restore],[data-clear-decline],[data-clear-all-declines],[data-configure],[data-view-archive],[data-remove-ring]');
        if (!t)
            return;
        let d = t.dataset;
        if (d.giveBreak) { toggleBreak(d.giveBreak, true); return; }
        if (d.endBreak) { toggleBreak(d.endBreak, false); return; }
        if (d.judgePick) {
            activeJudge = d.judgePick;
            renderJudge();
            $('judgeProfile').scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        if (d.judgeCheckin) {
            if (activeJudge === d.judgeCheckin)
                checkInJudge(d.judgeCheckin, true);
            return;
        }
        if (d.adminCheckin) {
            if ($('modal').open) $('modal').close();
            checkInJudge(d.adminCheckin, true);
            return;
        }
        if (d.confirmCheckinPhone) { const id=d.confirmCheckinPhone, value=$('adminCheckinPhone')?.value || ''; if (!formatPhone(value)) return toast('Enter a valid 10-digit number'); $('modal').close(); checkInJudge(id,true,value); return; }
        if (d.adminUndoCheckin) {
            checkInJudge(d.adminUndoCheckin, false);
            if ($('modal').open) {
                $('modal').close();
            }
            return;
        }
        if (d.privateRosterImport !== undefined) {
            if (!Array.isArray(window.__privateRosterToImport) || !window.__privateRosterToImport.length)
                return toast('Choose a private roster JSON file first');
            const records = window.__privateRosterToImport;
            let added = 0, skipped = 0;
            for (const row of records) {
                if (!row.name || isNameTaken(row.name)) {
                    skipped++;
                    continue;
                }
                state.judges.push({ ...row, phone: formatPhone(row.phone), id: 'J' + state.seq++, ring: null, checkedIn: false, competing: false, hasCompeted: false, completedDivisions: [], creditedRingIds: [], ringsJudged: 0, ringsSinceBreak: 0, onBreak: false, response: 'none', declineCleared: false, notifications: [] });
                added++;
            }
            window.__privateRosterToImport = null;
            log('Private roster imported: ' + added + ' judges');
            save();
            $('modal').close();
            renderAdmin();
            toast(added + ' judges imported, ' + skipped + ' duplicates skipped');
            return;
        }
        if (d.downloadTemplate !== undefined) {
            const csv = 'name,rank,gender,competing,level,age,phone\nJohn Smith,3,M,yes,C,3039,888-123-4567\nSarah Jones,4,W,no,,,888-123-5678\n';
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
            a.download = 'ringgrid-judge-template.csv';
            a.click();
            URL.revokeObjectURL(a.href);
            return;
        }
        if (d.importConfirm !== undefined) {
            let added = 0, errors = [];
            pendingCsv.forEach((r, i) => { const err = addJudgeRecord(r); if (err)
                errors.push('Row ' + (i + 2) + ': ' + err);
            else
                added++; });
            save();
            $('modal').close();
            renderAdmin();
            toast(added + ' imported; ' + errors.length + ' skipped');
            if (errors.length)
                modal('<h3>Import Results</h3>' + errors.map(esc).join('<br>'));
            return;
        }
        if (d.openJudgeDivision) {
            showJudgeDivision(d.openJudgeDivision);
            return;
        }
        if (d.sendJudgeDivision) {
            sendWholeDivision(d.sendJudgeDivision);
            return;
        }
        if (d.searchDivisions) {
            divisionSearchModal(d.searchDivisions);
            return;
        }
        if (d.applyDivisionSearch) {
            divisionFilters[d.applyDivisionSearch] = { level: $('searchDivisionLevel').value, gender: $('searchDivisionGender').value, rank: $('searchDivisionRank').value, age: $('searchDivisionAge').value, packet: $('searchDivisionPacket').value.trim() };
            $('modal').close();
            renderRingPanel();
            return;
        }
        if (d.clearDivisionSearch) {
            divisionFilters[d.clearDivisionSearch] = null;
            $('modal').close();
            renderRingPanel();
            return;
        }
        if (d.jumpRing) {
            show('admin');
            const ring = document.querySelector(`[data-ring="${d.jumpRing}"]`);
            if (ring) {
                ring.scrollIntoView({ behavior: 'smooth', block: 'center' });
                ring.classList.add('ring-highlight');
                setTimeout(() => ring.classList.remove('ring-highlight'), 1800);
            }
            return;
        }
        if (d.finishDivision) {
            const members = state.judges.filter(j => j.competing && j.division === d.finishDivision);
            members.forEach(j => { j.competing = false; j.completedDivisions ??= []; if (!j.completedDivisions.includes(d.finishDivision))
                j.completedDivisions.push(d.finishDivision); notify(j, 'Division ' + d.finishDivision + ' finished. You are available for judging again.'); });
            log(d.finishDivision + ' finished competing (' + members.length + ' judges)');
            save();
            renderAdmin();
            toast(d.finishDivision + ' finished');
            return;
        }
        if ('clearAllDeclines' in d) {
            state.judges.filter(j => j.response === 'declined').forEach(j => j.declineCleared = true);
            save();
            renderAdmin();
            declinedAlerts();
        }
        else if (d.clearDecline) {
            let j = state.judges.find(j => j.id === d.clearDecline);
            if (j)
                j.declineCleared = true;
            save();
            renderAdmin();
            declinedAlerts();
        }
        else if (d.configure) {
            configureRing(Number(d.configure));
        }
        else if (d.viewArchive) {
            let a = state.archivedRings.find(x => String(x.archiveId) === String(d.viewArchive));
            if (a)
                modal(`<h3>Archived Ring ${a.id}</h3><p>Division: <strong>${esc(a.code)}</strong> ${a.packet ? ' · Packet #' + esc(a.packet) : ''} · ${esc(a.event)}</p><p>Judges assigned:</p>${a.judges.map(j => `<div class="modal-row">${esc(j.name)}</div>`).join('') || '<p class="muted">No judges assigned</p>'}<p>Judges credited (Center/A/B, checked in, not on break):</p>${a.creditedJudges ? a.creditedJudges.map(j => `<div class="modal-row">${esc(j.name)}</div>`).join('') || '<p class="muted">None credited</p>' : '<p class="muted">Detailed credits unavailable for this earlier archive.</p>'}`);
        }
        else if ('createRing' in d) {
            let id = Number($('modal').dataset.ringId || 0), r = state.rings.find(x => x.id === id);
            if (!r)
                return toast('Ring not found');
            let count = Number($('newRingBodyCount').value);
            if (!Number.isInteger(count) || count < 0)
                return toast('Enter a valid body count');
            r.setup = { level: $('newRingLevel').value, gender: $('newRingGender').value, startRank: $('newRingStartRank').value, endRank: $('newRingEndRank').value, startAge: $('newRingStartAge').value, endAge: $('newRingEndAge').value };
            r.code = $('newRingDivision').textContent;
            r.bodyCount = count;
            r.packet = $('newRingPacket').value.trim();
            r.divisionId ??= 'D' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
            let existing = state.competitionLedger.find(x => x.id === r.divisionId);
            if (existing) {
                existing.bodyCount = count;
                existing.code = r.code;
            }
            else
                state.competitionLedger.push({ id: r.divisionId, code: r.code, bodyCount: count });
            log('Ring ' + id + ' configured as ' + r.code + ' with ' + count + ' competitors');
            save();
            $('modal').close();
            renderAdmin();
            toast('Ring ' + id + ' saved · Competition Count updated');
        }
        else if (d.archive) {
            let id = Number(d.archive), r = state.rings.find(r => r.id === id);
            if (!r || !r.code)
                return;
            let judges = state.judges.filter(j => j.ring === id);
            // Only Center/A/B actually judged this division. Overflow may be
            // occupied by a fourth active judge without that judge earning credit.
            const workingJudges = judges.filter(j => canWork(j) && j.slot >= 0 && j.slot < ACTIVE_SLOTS);
            if (!confirm('Archive division in Ring ' + id + '? The ' + judges.length + ' judges will stay in the ring.'))
                return;
            let archiveId = 'A' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
            state.archivedRings.push({ ...r, archiveId, judges: judges.map(j => ({ id: j.id, name: j.name })), creditedJudges: workingJudges.map(j => ({ id: j.id, name: j.name })) });
            workingJudges.forEach(j => { if (!j.creditedRingIds.includes(r.divisionId)) {
                j.creditedRingIds.push(r.divisionId);
                const previousSinceBreak=sinceBreak(j);
                j.ringsJudged++;
                j.ringsSinceBreak = j.fatigueResetAtTotal != null ? sinceBreak(j) : previousSinceBreak+1;
            } j.response = 'none'; notify(j, 'Ring ' + id + ' division archived. You remain assigned to the ring.'); });
            r.code = '';
            r.event = 'OPEN';
            r.bodyCount = 0;
            r.packet = '';
            r.divisionId = null;
            r.setup = null;
            log('Ring ' + id + ' division archived; judges retained; ' + workingJudges.length + ' present judges eligible for credit');
            save();
            renderAdmin();
            toast('Division archived; judges remain in Ring ' + id);
        }
        else if (d.restore) {
            let id = Number(d.restore), r = state.archivedRings.find(r => r.id === id);
            if (!r)
                return;
            state.rings.push({ id: r.id, code: '', event: 'OPEN', capacity: r.capacity || 3 });
            state.rings.sort((a, b) => a.id - b.id);
            state.archivedRings = state.archivedRings.filter(r => r.id !== id);
            log('Ring ' + id + ' restored (judges remain unassigned)');
            save();
            renderAdmin();
            toast('Ring ' + id + ' restored');
        }
        else if (d.removeRing) {
            let id = +d.removeRing, r = state.rings.find(x => x.id === id);
            if (r && !r.code && !state.judges.some(j => j.ring === id)) {
                state.rings = state.rings.filter(x => x.id !== id);
                save();
                renderAdmin();
                toast('Ring station removed');
            }
        }
        else if (d.unassign)
            assign(d.unassign, null);
        else if (d.fill)
            fill(+d.fill);
        else if (d.judgeActions)
            manage(d.judgeActions);
        else if (d.respond)
            response(activeJudge, d.respond);
        else if ('selfCompete' in d) {
            setCompete(activeJudge);
            renderJudge();
        }
        else if (d.modalMove) {
            assign(d.modalMove, Number($('moveTarget').value) || null, Number($('moveSlot')?.value ?? -1));
            $('modal').close();
        }
        else if (d.modalCompete) {
            setCompete(d.modalCompete);
            $('modal').close();
        }
        else if (d.viewJudge) {
            activeJudge = d.viewJudge;
            $('modal').close();
            show('judge');
        }
        else if (d.approve || d.reject) {
            let id = d.approve || d.reject, p = state.pending.find(x => x.id === id), approvedJudge = null;
            if (!p)
                return;
            if (d.approve) {
                if (state.judges.some(j => nameKey(j.name) === nameKey(p.name))) {
                    toast('Duplicate name: judge already exists');
                    return;
                }
                // The registration's entered mobile number is authoritative. Never copy the shared roster placeholder.
                const approvedPhone = formatPhone(p.phone);
                if (!approvedPhone) {
                    toast('Registration has an invalid phone number. Ask the judge to resubmit.');
                    return;
                }
                approvedJudge = { ...p, id: 'J' + state.seq++, phone: approvedPhone, ring: null, checkedIn: true, competing: false, hasCompeted: false, ringsJudged: 0, ringsSinceBreak: 0, onBreak: false, creditedRingIds: [], completedDivisions: [], response: 'none', notifications: [{ text: 'Registration approved — you are checked in and available for judging!', time: 'Just now', read: false }] };
                state.judges.push(approvedJudge);
                log(p.name + ' approved and checked in');
            }
            else
                log(p.name + ' registration rejected');
            state.pending = state.pending.filter(x => x.id !== id);
            save();
            if (remoteMode) {
                // In live mode, presence is authoritative in the individual Firestore check-ins collection.
                if (approvedJudge)
                    window.RinggridLive?.setCheckin?.(activeTournamentId, approvedJudge.id, true).catch(err => toast('Firebase check-in failed for ' + approvedJudge.name + ': ' + err.message));
                window.RinggridLive?.deleteRegistration?.(activeTournamentId, id).catch(err => toast('Cloud approval cleanup failed: ' + err.message));
            }
            $('modal').close();
            renderAdmin();
            toast(d.approve ? 'Judge approved and checked in' : 'Registration rejected');
        }
        else if (d.saveJudgePhone) {
            const judge = state.judges.find(j => j.id === d.saveJudgePhone);
            const entered = formatPhone($('adminJudgePhone')?.value);
            if (!judge || !entered)
                return toast('Enter a valid 10-digit phone number');
            judge.phone = entered;
            log(judge.name + ' phone corrected by Admin');
            save();
            $('modal').close();
            renderAdmin();
            toast(judge.name + ' number saved: ' + entered);
        }
        else if (d.fillConfirm) {
            let id = $('fillJudge').value;
            if (!id)
                return toast('Select an available judge');
            $('modal').close();
            assign(id, +d.fillConfirm);
        }
        else if ('addConfirm' in d) {
            let err = addJudgeRecord({ name: $('quickName').value, rank: $('quickRank').value, gender: $('quickGender').value, competing: $('quickCompeting').value, level: $('quickLevel').value, age: $('quickAge').value, phone: $('quickPhone').value }, { autoCheckIn: true });
            if (err)
                return toast(err);
            const added = state.judges[state.judges.length - 1];
            log(added.name + ' added by Admin and checked in');
            save();
            if (remoteMode)
                window.RinggridLive?.setCheckin?.(activeTournamentId, added.id, true).catch(error => toast('Judge saved but Firebase check-in failed: ' + error.message));
            $('modal').close();
            renderAdmin();
            toast(added.name + ' added and checked in');
        }
    });
    document.addEventListener('submit', e => {
        if (e.target.id !== 'updateJudgePhoneForm')
            return;
        e.preventDefault();
        const j = state.judges.find(x => x.id === activeJudge);
        if (!j)
            return;
        const formatted = formatPhone($('judgePhoneUpdate').value);
        if (!formatted) {
            $('judgePhoneResult').textContent = 'Enter a valid 10-digit phone number.';
            $('judgePhoneResult').className = 'registration-message error';
            return;
        }
        if (remoteMode && !window.RinggridLive?.isAdmin?.()) {
            const result = $('judgePhoneResult');
            result.textContent = 'Submitting phone update for Admin approval…';
            window.RinggridLive?.requestPhoneUpdate?.(activeTournamentId, j.id, formatted).then(() => {
                const status = $('judgePhoneResult');
                if (status) {
                    status.textContent = 'Submitted: ' + formatted + '. Admin approval is required before messaging uses this number.';
                    status.className = 'registration-message success';
                }
                toast('Phone change submitted for Admin approval');
            }).catch(err => { const status = $('judgePhoneResult'); if (status) {
                status.textContent = 'Phone update not sent: ' + err.message;
                status.className = 'registration-message error';
            } ; toast('Phone request failed'); });
        }
        else {
            j.phone = formatted;
            log(j.name + ' updated their phone number');
            save();
            renderJudge();
            toast('Mobile number saved: ' + formatted);
        }
    });
    document.addEventListener('change', async (e) => { if (e.target.id === 'privateRosterFile') {
        try {
            const obj = JSON.parse(await e.target.files[0].text());
            const records = Array.isArray(obj) ? obj : obj.judges;
            if (!Array.isArray(records) || !records.every(x => x.name && x.rank && x.division)) {
                throw Error('Invalid roster format');
            }
            window.__privateRosterToImport = records;
            $('privateRosterPreview').textContent = records.length + ' judge profiles ready to import; all will start unchecked and unassigned.';
            document.querySelector('[data-private-roster-import]').disabled = false;
        }
        catch (err) {
            window.__privateRosterToImport = null;
            $('privateRosterPreview').textContent = 'Could not read roster: ' + err.message;
        }
    } if (e.target.id === 'judgeCsvFile') {
        const file = e.target.files[0];
        if (!file)
            return;
        pendingCsv = parseCsv(await file.text());
        $('csvPreview').textContent = pendingCsv.length + ' rows loaded. Import will skip invalid and duplicate entries.';
        document.querySelector('[data-import-confirm]').disabled = !pendingCsv.length;
    } if (e.target.id === 'quickCompeting') {
        document.querySelectorAll('.quick-competition').forEach(el => el.hidden = e.target.value === 'no');
    } });
    document.addEventListener('input', e => { if (['regPhone', 'quickPhone', 'judgePhoneUpdate', 'adminJudgePhone', 'checkinPhone', 'adminCheckinPhone'].includes(e.target.id)) {
        let digits = e.target.value.replace(/\D/g, '').slice(0, 10);
        e.target.value = digits.replace(/^(\d{3})(\d{0,3})(\d{0,4})$/, (m, a, b, c) => a + (b ? '-' + b : '') + (c ? '-' + c : ''));
    } if (e.target.id === 'assignNameSearch')
        renderAssignOptions(); });
    document.addEventListener('change', e => { if (e.target.id === 'assignRankSearch')
        renderAssignOptions(); if (e.target.matches('[data-ring-event]')) {
        let r = state.rings.find(r => r.id === +e.target.dataset.ringEvent);
        if (!r)
            return;
        r.event = e.target.value;
        log('Ring ' + r.id + ' event set to ' + r.event);
        save();
        renderAdmin();
    } });
    document.addEventListener('dragstart', e => { let el = e.target.closest('[data-drag]'); if (el)
        e.dataTransfer.setData('text/plain', el.dataset.drag); });
    document.addEventListener('dragover', e => { if (e.target.closest('[data-ring]'))
        e.preventDefault(); });
    document.addEventListener('drop', e => { let ring = e.target.closest('[data-ring]'); if (ring) {
        e.preventDefault();
        assign(e.dataTransfer.getData('text/plain'), +ring.dataset.ring, Number(e.target.closest('[data-slot]')?.dataset.slot ?? -1));
    }
     });
    if ('serviceWorker' in navigator && location.protocol.startsWith('http'))
        navigator.serviceWorker.register('./sw.js').catch(() => { });
    $('addRingBtn').onclick = () => { let id = Math.max(0, ...state.rings.map(r => r.id)) + 1; state.rings.push({ id, code: '', event: 'OPEN', capacity: 3 }); save(); renderAdmin(); toast('Ring ' + id + ' added'); };
    $('archivePageBtn').onclick = () => { show('archives'); $('archivePageList').innerHTML = state.archivedRings.map(r => `<div class="card"><strong>Ring ${r.id} · ${esc(r.code)}${r.packet ? ' · Packet #' + esc(r.packet) : ''}</strong><p>${esc(r.event)} · ${r.bodyCount || 0} competitors · ${r.judges.map(j => esc(j.name)).join(', ') || 'No judges'}</p><button data-view-archive="${r.archiveId}">View Details</button></div>`).join('') || '<p class="muted">No archived divisions yet.</p>'; };
    $('backFromArchives').onclick = () => show('admin');
    toggleReg();
    show('tournaments');
})();
