const SK_API = 'https://socketkill.com/api';
const ESI = 'https://esi.evetech.net/latest';
const ESI_IMG = 'https://images.evetech.net';

async function searchCharacter(name) {
    const res = await fetch(`${SK_API}/character/search/${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error('Character not found');
    const data = await res.json();
    if (!data.id) throw new Error('Character not found');
    return data.id;
}

function generateGuid() {
    return crypto.randomUUID();
}

async function getCharacterInfo(id) {
    const res = await fetch(`${ESI}/characters/${id}/`);
    if (!res.ok) throw new Error('Character lookup failed');
    return res.json();
}

async function getCorpHistory(id) {
    const res = await fetch(`${ESI}/characters/${id}/corporationhistory/`);
    if (!res.ok) return [];
    return res.json();
}

async function resolveName(category, id) {
    try {
        if (category === 'corporations') {
            const res = await fetch(`${SK_API}/corporation/${id}`);
            const data = await res.json();
            return data.name || 'Unknown';
        }
        // Alliances not in SK API yet — fall back to ESI directly
        const res = await fetch(`${ESI}/alliances/${id}/`);
        const data = await res.json();
        return data.name || 'Unknown';
    } catch {
        return 'Unknown';
    }
}
function formatDate(dateStr) {
    if (!dateStr) return '';
    return dateStr.replace('T', ' ').substring(0, 16);
}

function setVisible(screen) {
    document.getElementById('search-screen').style.display = screen === 'search' ? 'flex' : 'none';
    document.getElementById('loading').style.display = screen === 'loading' ? 'block' : 'none';
    const profile = document.getElementById('profile-screen');
    profile.style.display = screen === 'profile' ? 'block' : 'none';
    if (screen === 'profile') profile.classList.add('visible');
    else profile.classList.remove('visible');
}

async function lookup(name) {
    const errEl = document.getElementById('search-error');
    errEl.textContent = '';
    setVisible('loading');

    try {
        const charId = await searchCharacter(name);
        const info = await getCharacterInfo(charId);
        const corpHistory = await getCorpHistory(charId);

        // Resolve corp and alliance names
        const corpName = await resolveName('corporations', info.corporation_id, '/corporations');
        const allianceName = info.alliance_id
            ? await resolveName('alliances', info.alliance_id, '/alliances')
            : 'None';

        // Populate profile
        document.getElementById('char-name').textContent = info.name;
        document.getElementById('char-id').textContent = charId;
        document.getElementById('char-corp').innerHTML = corpName;
        document.getElementById('char-alliance').textContent = allianceName;

        // Portrait and logos
        document.getElementById('char-portrait').src = `${ESI_IMG}/characters/${charId}/portrait?size=256`;
        document.getElementById('corp-logo').src = `${ESI_IMG}/corporations/${info.corporation_id}/logo?size=64`;

        const allianceLogo = document.getElementById('alliance-logo');
        if (info.alliance_id) {
            allianceLogo.src = `${ESI_IMG}/alliances/${info.alliance_id}/logo?size=64`;
            allianceLogo.style.display = 'block';
        } else {
            allianceLogo.style.display = 'none';
        }

        // Links
        document.getElementById('zkill-link').href = `https://zkillboard.com/character/${charId}/`;
        document.getElementById('sk-link').href = `https://socketkill.com`;

        // Corp history
        const historyEl = document.getElementById('corp-history');
        historyEl.innerHTML = '';
        for (const entry of corpHistory.slice(0, 20)) {
            const cName = await resolveName('corporations', entry.corporation_id, '/corporations');
            const div = document.createElement('div');
            div.className = 'history-entry';
            div.innerHTML = `
                <img class="history-logo" src="${ESI_IMG}/corporations/${entry.corporation_id}/logo?size=32" alt="">
                <div class="history-corp">
                    <div class="history-corp-name">${cName}</div>
                    <div class="history-dates">
                        ${!entry.leave_date
                            ? '<span class="history-current">CURRENT</span>'
                            : `LEFT: ${formatDate(entry.leave_date)}`}
                        &nbsp;//&nbsp; JOINED: ${formatDate(entry.start_date)}
                    </div>
                </div>
            `;
            historyEl.appendChild(div);
        }

        // Update page title and URL
        document.title = `${info.name} // WHOAMI`;
        history.pushState({ charId, name: info.name }, '', `?q=${encodeURIComponent(info.name)}`);

        setVisible('profile');

    } catch (e) {
        setVisible('search');
        errEl.textContent = `> ${e.message.toUpperCase()}`;
    }
}

// Event listeners
document.getElementById('search-btn').addEventListener('click', () => {
    const val = document.getElementById('search-input').value.trim();
    if (val) lookup(val);
});

document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (val) lookup(val);
    }
});

document.getElementById('back-btn').addEventListener('click', () => {
    setVisible('search');
    document.title = 'WHOAMI // SOCKET.KILL';
    const guid = crypto.randomUUID();
    history.pushState({ charId, guid}, '', `?id=${guid}&q=${encodeURIComponent(name)}`);
});

// Check for ?q= on load
window.addEventListener('DOMContentLoaded', async () => {
    await loadCache();
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
        document.getElementById('search-input').value = q;
        lookup(q);
    }
});