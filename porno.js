document.addEventListener('DOMContentLoaded', () => {
	const input = document.getElementById('textInput');
	const btn = document.getElementById('checkBtn');
	const msg = document.getElementById('message');
	const result = document.getElementById('result');

	const STORAGE_KEY = 'jb_assignments';

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

	function checkInput() {
		const res = validate(input.value);
		if (!res.ok) {
			showMessage(res.message, 'error');
			return false;
		}

		const val = input.value.trim().toLowerCase();
		// 'sıfırla' yazılırsa eski çekilişi sil, yeni çekiliş oluşturup öncekiyle farklı olana kadar yeniden dene
		if (val === 'sıfırla') {
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
			let assign = loadAssignments();
			let persisted = true;
			if (!assign) {
				assign = derangement(participants);
				persisted = false;
				if (!assign) {
					showMessage('Atama yapılamadı, tekrar deneyin.', 'error');
					return false;
				}
				saveAssignments(assign);
			}
			showSingleAssignment(val, assign, persisted);
			if (!persisted) showMessage('Çekiliş yapıldı ve kaydedildi.', 'success');
			return true;
		}

		showMessage(res.message, 'success');
		return true;
	}

	// yüklenmiş çekiliş varsa uyarı göster (kullanıcı ismini girip kimin çıktığını görebilir)
	const saved = loadAssignments();
	if (saved) {
		showMessage('Kayıtlı çekiliş bulundu. İsim girip kimin çıktığını görebilirsiniz.', 'success');
	}

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
