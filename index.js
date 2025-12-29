document.addEventListener('DOMContentLoaded', () => {
	const input = document.getElementById('textInput');
	const btn = document.getElementById('checkBtn');
	const msg = document.getElementById('message');
	const result = document.getElementById('result');

	const STORAGE_KEY = 'jb_assignments';
	// API base can be configured from the page (e.g. set window.API_BASE = 'https://abcd-1234.ngrok.io')
	const API_BASE = window.API_BASE || '';
	const serverInfoEl = document.getElementById('serverInfo');

	function saveAssignments(assign) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(assign));
	}

	function loadAssignments() {
		const v = localStorage.getItem(STORAGE_KEY);
		return v ? JSON.parse(v) : null;
	}

	function clearAssignments() {
		localStorage.removeItem(STORAGE_KEY);
	}

	function showMessage(text, type) {
		msg.textContent = text;
		msg.className = 'message ' + (type === 'error' ? 'error' : 'success');
	}

	function validate(value) {
		const v = value.trim();
		if (!v) return { ok: false, message: 'Girdi boş olamaz.' };
		if (v.length < 3) return { ok: false, message: 'En az 3 karakter girin.' };
		const pattern = /^[A-Za-z0-9ığüşöçİĞÜŞÖÇ\s.,!?-]+$/u;
		if (!pattern.test(v)) return { ok: false, message: 'Geçersiz karakterler var.' };
		return { ok: true, message: 'Girdi geçerli.' };
	}

	const participants = ['ibo','adnan','ahmet'];

	function displayAssignments(assign, persisted=false) {
		// Tüm atamaları göster (input etkin tutulur ki kullanıcı kendi ismini kontrol edebilsin)
		const lines = Object.keys(assign).map(p => `${p} → ${assign[p]}`);
		msg.innerHTML = lines.join('<br>');
		msg.className = 'message success';
		if (persisted) {
			showMessage('Kayıtlı çekiliş yüklendi.', 'success');
		}
		// Not: artık reset butonu yok, sıfırlama için inputa 'sıfırla' yazılacak
	}

	function capitalize(name) {
		return name.charAt(0).toUpperCase() + name.slice(1);
	}

	function showSingleAssignment(name, assign, persisted=false) {
		const target = assign[name];
		if (!target) {
			showMessage('Seçilen isim için atama bulunamadı.', 'error');
			if (result) { result.textContent = ''; result.className = 'result error'; }
			return;
		}
		if (result) {
			result.textContent = `${capitalize(name)} → ${capitalize(target)}`;
			result.className = 'result success';
		}
		if (persisted) {
			showMessage('Kayıtlı çekiliş yüklendi.', 'success');
		}
		// Not: artık reset butonu yok, sıfırlama için inputa 'sıfırla' yazılacak
	}

	function fisherYatesShuffle(a) {
		const arr = a.slice();
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	}

	function derangement(arr, maxAttempts = 1000) {
		const n = arr.length;
		let attempts = 0;
		while (attempts < maxAttempts) {
			const shuffled = fisherYatesShuffle(arr);
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

	async function checkInput() {
		const res = validate(input.value);
		if (!res.ok) {
			showMessage(res.message, 'error');
			return false;
		}

		const val = input.value.trim().toLowerCase();
		// 'sıfırla' yazılırsa önce sunucuya reset isteği gönder, başarısızsa lokal fallback
		if (val === 'sıfırla') {
			try {
				const resp = await fetch(API_BASE + '/api/assignments/reset', { method: 'POST' });
				if (resp.ok) {
					const data = await resp.json();
					saveAssignments(data.assignments);
					displayAssignments(data.assignments, false);
					if (result) { result.textContent = ''; result.className = 'result'; }
					input.value = '';
					showMessage(data.message || 'Eski çekiliş silindi. Yeni çekiliş yapıldı ve kaydedildi.', 'success');
					return true;
				}
			} catch (err) {
				// sunucuya ulaşılamadı; devam et ve lokal olarak sıfırla
			}

			const prev = loadAssignments();
			clearAssignments();
			let assign = null;
			const maxAttempts = 1000;
			let attempts = 0;
			while (attempts < maxAttempts) {
				assign = derangement(participants, maxAttempts);
				if (!assign) break; // derangement failed
				if (!prev) break; // no previous to compare, accept
				const isDifferent = participants.some(p => assign[p] !== prev[p]);
				if (isDifferent) break; // found a different mapping
				attempts++;
			}
			if (!assign) {
				showMessage('Atama yapılamadı, tekrar deneyin.', 'error');
				return false;
			}
			saveAssignments(assign);
			displayAssignments(assign, false);
			if (result) { result.textContent = ''; result.className = 'result'; }
			input.value = '';
			if (attempts === maxAttempts) {
				showMessage('Yeni çekiliş oluşturuldu, ancak önceki çekiliş ile aynı kaldı.', 'success');
			} else {
				showMessage('Eski çekiliş silindi. Yeni çekiliş yapıldı ve kaydedildi.', 'success');
			}
			return true;
		}

		if (participants.includes(val)) {
			// Use server or saved assignment; DO NOT create a new assignment automatically on name check
			let assign = (typeof currentAssign !== 'undefined' && currentAssign) ? currentAssign : loadAssignments();
			if (!assign) {
				const serverAssign = await fetchAssignmentsFromServer();
				if (serverAssign) {
					assign = serverAssign;
					currentAssign = assign;
					showSingleAssignment(val, assign, true);
					return true;
				}
				// No assignment exists anywhere — instruct user to reset (create) explicitly
				showMessage("Kayıtlı çekiliş yok. Yeni çekiliş oluşturmak için inputa 'sıfırla' yazıp Kontrol Et'e basın.", 'error');
				return false;
			}
			// assignment exists (server or saved)
			currentAssign = assign;
			showSingleAssignment(val, assign, true);
			return true;
		}

		showMessage(res.message, 'success');
		return true;
	}

	// sunucuya bağlanarak paylaşılan çekilişi getir (başarısız olursa localStorage'a geri dön)
	let currentAssign = null;

	async function fetchAssignmentsFromServer() {
		try {
			console.debug('[client] GET /api/assignments (no create) at', API_BASE + '/api/assignments');
			const resp = await fetch(API_BASE + '/api/assignments');
			if (resp.status === 204) {
				console.debug('[client] server has no assignments (server empty)');
				if (serverInfoEl) serverInfoEl.textContent = 'Sunucu: ' + (API_BASE || location.origin) + ' (boş)';
				// Show import button if local assignment exists; do NOT auto-import
				const local = loadAssignments();
				if (local && importBtn) {
					importBtn.style.display = 'inline-block';
				} else if (importBtn) {
					importBtn.style.display = 'none';
				}
				showMessage("Sunucu çekilişi yok. Sunucuya yüklemek için 'Import' butonunu kullanın veya yeni çekiliş oluşturmak için inputa 'sıfırla' yazın.", 'error');
				return null;
			}

			if (!resp.ok) {
				console.warn('[client] fetch returned non-ok', resp.status);
				if (serverInfoEl) serverInfoEl.textContent = 'Sunucu: hata (' + resp.status + ')';
				return null;
			}
			const data = await resp.json();
			console.debug('[client] got assignments from server', data);
			if (data && data.assignments) {
				currentAssign = data.assignments;
				saveAssignments(currentAssign); // cache locally as a fallback
				if (serverInfoEl) serverInfoEl.textContent = 'Sunucu: ' + (API_BASE || location.origin) + ' (OK, last sync: ' + new Date().toLocaleTimeString() + ')';
				if (importBtn) importBtn.style.display = 'none';
				return currentAssign;
			}
			return null;
		} catch (e) {
			console.error('[client] fetch error', e);
			if (serverInfoEl) serverInfoEl.textContent = 'Sunucu: (erişilemedi)';
			return null;
		}
	}

	const importBtn = document.getElementById('importBtn');
	if (importBtn) {
		importBtn.style.display = 'none';
		importBtn.addEventListener('click', async () => {
			const local = loadAssignments();
			if (!local) { showMessage('Local atama yok, önce local bir çekiliş oluşturun.', 'error'); return; }
			try {
				const resp = await fetch(API_BASE + '/api/assignments/import', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ assignments: local })
				});
				if (resp.ok) {
					const data = await resp.json();
					currentAssign = data.assignments;
					saveAssignments(currentAssign);
					displayAssignments(currentAssign, true);
					showMessage(data.message || 'Atama sunucuya yüklendi.', 'success');
					importBtn.style.display = 'none';
				} else {
					const err = await resp.json().catch(() => ({}));
					showMessage('Import başarısız: ' + (err.error || resp.status), 'error');
				}
			} catch (e) {
				showMessage('Import isteği başarısız: ' + e.message, 'error');
			}
		});
	}

	(async () => {
		const serverAssign = await fetchAssignmentsFromServer();
		if (serverAssign) {
			displayAssignments(serverAssign, true);
			showMessage('Kayıtlı çekiliş yüklendi (sunucu: ' + (API_BASE || location.origin) + ').', 'success');
		} else {
			const saved = loadAssignments();
			if (saved) {
				currentAssign = saved;
				displayAssignments(saved, true);
				showMessage('Kayıtlı çekiliş bulundu (yerel). Sunucuya yüklemek için Import butonunu kullanın veya yeni çekiliş oluşturmak için inputa \"sıfırla\" yazıp Kontrol Et\'e basın.', 'success');
				if (importBtn) importBtn.style.display = 'inline-block';
			}
		}
	})();

	btn.addEventListener('click', checkInput);

	input.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') checkInput();
	});
	input.addEventListener('input', () => {
		msg.textContent = '';
		msg.className = 'message';
		if (result) { result.textContent = ''; result.className = 'result'; }
	});
});