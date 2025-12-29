const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'assignments.json');
const PARTICIPANTS = ['ibo','adnan','ahmet'];
const MAX_ATTEMPTS = 1000;

function shuffle(arr) {
	const a = arr.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function derangement(arr, maxAttempts = MAX_ATTEMPTS) {
	const n = arr.length;
	let attempts = 0;
	while (attempts < maxAttempts) {
		const shuffled = shuffle(arr);
		let ok = true;
		for (let i = 0; i < n; i++) {
			if (shuffled[i] === arr[i]) { ok = false; break; }
		}
		if (ok) {
			const map = {};
			for (let i = 0; i < n; i++) map[arr[i]] = shuffled[i];
			return map;
		}
		attempts++;
	}
	return null;
}

async function readAssignments() {
	try {
		const data = await fs.readFile(DATA_FILE, 'utf8');
		return JSON.parse(data);
	} catch (err) {
		// file missing or unreadable
		console.log('[server] No assignments file or unreadable');
		return null;
	}
}

async function writeAssignments(assign) {
	try {
		await fs.writeFile(DATA_FILE, JSON.stringify(assign, null, 2), 'utf8');
		console.log('[server] assignments written to', DATA_FILE);
	} catch (err) {
		console.error('[server] Failed to write assignments:', err);
		throw err;
	}
}

// GET /api/assignments: return assignments if present; DO NOT auto-create on GET
app.get('/api/assignments', async (req, res) => {
	let current = await readAssignments();
	if (!current) {
		console.log('[API] No assignments found — not creating (policy: no auto-create on GET)');
		return res.status(204).end();
	}
	console.log('[API] Returning existing assignments:', current);
	res.json({ assignments: current, created: false });
});

// Import an assignment from a client if server has none (validation applies)
app.post('/api/assignments/import', async (req, res) => {
	const candidate = req.body && req.body.assignments;
	if (!candidate || typeof candidate !== 'object') {
		return res.status(400).json({ error: 'Geçersiz payload' });
	}
	// basic validation: keys must match participants, values must be a permutation and no one mapped to themselves
	const keys = Object.keys(candidate).sort();
	const expected = PARTICIPANTS.slice().sort();
	if (JSON.stringify(keys) !== JSON.stringify(expected)) {
		return res.status(400).json({ error: 'Atama formatı hatalı (isimler uyumsuz)' });
	}
	const values = Object.values(candidate);
	// values must be a permutation of participants
	const valuesSorted = values.slice().sort();
	if (JSON.stringify(valuesSorted) !== JSON.stringify(expected)) {
		return res.status(400).json({ error: 'Atama hedefleri geçersiz' });
	}
	// no fixed points
	for (const p of PARTICIPANTS) {
		if (candidate[p] === p) return res.status(400).json({ error: 'Kendi kendine atama yok.' });
	}
	// if server already has assignments, refuse to overwrite
	const existing = await readAssignments();
	if (existing) return res.status(409).json({ error: 'Server zaten atama içeriyor', assignments: existing });
	try {
		await writeAssignments(candidate);
		console.log('[API] Imported assignments from client:', candidate);
		return res.status(201).json({ assignments: candidate, message: 'Atama sunucuya import edildi ve kaydedildi.' });
	} catch (e) {
		console.error('[API] Import write failed', e);
		return res.status(500).json({ error: 'Kaydetme başarısız' });
	}
});

// Force reset: generate a new assignment different from previous (if possible)
app.post('/api/assignments/reset', async (req, res) => {
	const prev = await readAssignments();
	let attempts = 0;
	let newAssign = null;
	while (attempts < MAX_ATTEMPTS) {
		newAssign = derangement(PARTICIPANTS);
		if (!newAssign) break;
		if (!prev) break;
		const isDifferent = PARTICIPANTS.some(p => newAssign[p] !== prev[p]);
		if (isDifferent) break;
		attempts++;
	}
	if (!newAssign) return res.status(500).json({ error: 'Yeni atama oluşturulamadı' });
	try {
		await writeAssignments(newAssign);
		console.log('[API] Reset: new assignments saved:', newAssign);
	} catch (e) {
		console.error('[API] Reset write failed', e);
	}
	res.json({ assignments: newAssign, message: attempts === MAX_ATTEMPTS ? 'Yeni çekiliş oluşturuldu ama önceki ile aynı kaldı.' : 'Yeni çekiliş oluşturuldu ve kaydedildi.' });
});

// Optionally serve static files from this folder for easier local testing
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}`);
});
