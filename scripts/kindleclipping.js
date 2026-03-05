// ── DOM Elements ──
const fileInput = document.getElementById('fileInput');
const fileStatus = document.getElementById('fileStatus');
const bookFilter = document.getElementById('bookFilter');
const bookList = document.getElementById('bookList');
const bookCountBadge = document.getElementById('bookCountBadge');
const editor = document.getElementById('editor');
const statsBar = document.getElementById('statsBar');
const contentSearch = document.getElementById('contentSearch');

// ── State ──
let allBooks = {};       // { bookTitle: [ {type, location, page, date, content}, ... ] }
let selectedBook = null; // null = show all, string = specific book title

// ── File Input Handler ──
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    fileStatus.textContent = `Loading: ${file.name}...`;

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target.result;
        allBooks = parseClippings(text);
        const bookCount = Object.keys(allBooks).length;

        if (bookCount === 0) {
            fileStatus.textContent = `⚠ No valid clippings found in ${file.name}`;
            return;
        }

        fileStatus.textContent = `✓ ${file.name} — ${bookCount} book${bookCount > 1 ? 's' : ''} loaded`;
        selectedBook = null;
        renderBookList();
        renderEditor();
    };
    reader.readAsText(file);
});

// ── Parse Kindle Clippings ──
function parseClippings(text) {
    const books = {};
    // Strip BOM character that Kindle files often have at the start
    text = text.replace(/^\uFEFF/, '');
    const entries = text.split('==========');

    for (const entry of entries) {
        const trimmed = entry.trim();
        if (!trimmed) continue;

        const lines = trimmed.split('\n').map(l => l.trim());
        if (lines.length < 2) continue;

        const bookTitle = lines[0].replace(/^\uFEFF/, '') || 'Unknown Title';

        // Find the metadata line (starts with "- ")
        let metaLineIndex = -1;
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].startsWith('-') || lines[i].startsWith('\u2013') || lines[i].startsWith('\u2014')) {
                metaLineIndex = i;
                break;
            }
        }
        const metaLine = metaLineIndex >= 0 ? lines[metaLineIndex] : (lines[1] || '');

        // Determine clip type (supports English and Chinese Kindle formats)
        let clipType = 'highlight';
        if (/your note/i.test(metaLine) || /笔记/.test(metaLine)) {
            clipType = 'note';
        } else if (/your bookmark/i.test(metaLine) || /书签/.test(metaLine)) {
            clipType = 'bookmark';
        } else if (/your highlight/i.test(metaLine) || /标注/.test(metaLine) || /高亮/.test(metaLine)) {
            clipType = 'highlight';
        }

        // Extract location (English: "Location 100-110" or "Loc. 100-110"; Chinese: "位置 #100-110")
        const locMatch = metaLine.match(/(?:location|loc\.?)\s+([\d-]+)/i) ||
            metaLine.match(/位置\s*#?([\d-]+)/i);
        const location = locMatch ? locMatch[1] : '';

        // Extract page (English: "page 42"; Chinese: "第 42 页")
        const pageMatch = metaLine.match(/page\s+([\d-]+)/i) ||
            metaLine.match(/第\s*([\d-]+)\s*页/);
        const page = pageMatch ? pageMatch[1] : '';

        // Extract date (English: "Added on Monday, ..."; Chinese: "添加于 ...")
        const dateMatch = metaLine.match(/Added on\s+(.+)$/i) ||
            metaLine.match(/添加于\s+(.+)$/);
        const date = dateMatch ? dateMatch[1].trim() : '';

        // Content is everything after the metadata line (skip empty lines)
        const contentStartIndex = metaLineIndex >= 0 ? metaLineIndex + 1 : 2;
        const contentLines = lines.slice(contentStartIndex).filter(l => l.length > 0);
        const content = contentLines.join('\n');

        if (!books[bookTitle]) {
            books[bookTitle] = [];
        }

        books[bookTitle].push({
            type: clipType,
            location: location,
            page: page,
            date: date,
            content: content
        });
    }

    // Post-process: merge notes with their corresponding highlights
    for (const title of Object.keys(books)) {
        books[title] = mergeNotesWithHighlights(books[title]);
    }

    return books;
}

// ── Merge notes with corresponding highlights ──
function mergeNotesWithHighlights(clips) {
    // Separate highlights and notes
    const highlights = [];
    const notes = [];
    const others = []; // bookmarks, etc.

    for (const clip of clips) {
        if (clip.type === 'note') {
            notes.push(clip);
        } else if (clip.type === 'highlight') {
            highlights.push({ ...clip, attachedNote: null });
        } else {
            others.push(clip);
        }
    }

    // Helper to parse a location string into [start, end] range
    function parseLocRange(loc) {
        const parts = loc.split('-').map(s => parseInt(s.trim()));
        const start = parts[0] || 0;
        const end = parts.length > 1 ? (parts[1] || start) : start;
        return [start, end];
    }

    // Check if two ranges overlap
    function rangesOverlap(a, b) {
        return a[0] <= b[1] && b[0] <= a[1];
    }

    // Try to match each note to a highlight by overlapping location
    const matchedNoteIndices = new Set();

    for (const hl of highlights) {
        if (!hl.location) continue;
        const hlRange = parseLocRange(hl.location);

        for (let i = 0; i < notes.length; i++) {
            if (matchedNoteIndices.has(i)) continue;
            const note = notes[i];
            if (!note.location) continue;
            const noteRange = parseLocRange(note.location);

            if (rangesOverlap(hlRange, noteRange)) {
                hl.attachedNote = note.content;
                hl.type = 'highlight-with-note';
                matchedNoteIndices.add(i);
                break;
            }
        }
    }

    // Collect unmatched notes
    const unmatchedNotes = notes.filter((_, i) => !matchedNoteIndices.has(i));

    // Rebuild the list: highlights (some with notes), unmatched notes, others
    // Maintain original order by sorting by location
    const result = [...highlights, ...unmatchedNotes, ...others];

    // Sort by location (numeric start) to maintain reading order
    result.sort((a, b) => {
        const locA = parseInt((a.location || '0').split('-')[0]) || 0;
        const locB = parseInt((b.location || '0').split('-')[0]) || 0;
        return locA - locB;
    });

    return result;
}

// ── Render Book List ──
function renderBookList() {
    const titles = Object.keys(allBooks);
    bookCountBadge.textContent = titles.length;

    const filterText = bookFilter.value.trim().toLowerCase();

    let html = '';

    // "Show All" item
    const allClipCount = Object.values(allBooks).reduce((sum, clips) => sum + clips.length, 0);
    const allClass = selectedBook === null ? 'selected' : '';
    html += `<div class="book-item show-all ${allClass}" data-book="__ALL__">
        <span class="book-name">📚 All Books</span>
        <span class="clip-count">${allClipCount}</span>
    </div>`;

    for (const title of titles) {
        if (filterText && !title.toLowerCase().includes(filterText)) continue;

        const clips = allBooks[title];
        const hlCount = clips.filter(c => c.type === 'highlight' || c.type === 'highlight-with-note').length;
        const ntCount = clips.filter(c => c.type === 'note' || c.type === 'highlight-with-note').length;
        const isSelected = selectedBook === title ? 'selected' : '';

        html += `<div class="book-item ${isSelected}" data-book="${escapeAttr(title)}">
            <span class="book-name" title="${escapeAttr(title)}">${escapeHtml(title)}</span>`;
        if (hlCount > 0) html += `<span class="highlight-count">${hlCount}H</span>`;
        if (ntCount > 0) html += `<span class="note-count">${ntCount}N</span>`;
        html += `</div>`;
    }

    bookList.innerHTML = html;

    // Attach click handlers
    bookList.querySelectorAll('.book-item').forEach(item => {
        item.addEventListener('click', () => {
            const bookKey = item.getAttribute('data-book');
            if (bookKey === '__ALL__') {
                selectedBook = null;
            } else {
                selectedBook = bookKey;
            }
            renderBookList();
            renderEditor();
        });
    });
}

// ── Render Editor ──
function renderEditor() {
    let booksToRender = {};

    if (selectedBook === null) {
        booksToRender = allBooks;
    } else if (allBooks[selectedBook]) {
        booksToRender = { [selectedBook]: allBooks[selectedBook] };
    }

    // Filter clips by content search text
    const searchText = contentSearch ? contentSearch.value.trim().toLowerCase() : '';
    if (searchText) {
        const filtered = {};
        for (const [title, clips] of Object.entries(booksToRender)) {
            const matched = clips.filter(c =>
                (c.content && c.content.toLowerCase().includes(searchText)) ||
                (c.attachedNote && c.attachedNote.toLowerCase().includes(searchText))
            );
            if (matched.length > 0) filtered[title] = matched;
        }
        booksToRender = filtered;
    }

    const bookTitles = Object.keys(booksToRender);
    if (bookTitles.length === 0) {
        editor.innerHTML = `<div class="empty-state">
            <div class="icon">📂</div>
            <div class="title">${searchText ? 'No matching clippings' : 'No clippings to display'}</div>
            <div class="subtitle">${searchText ? 'Try a different search term' : 'Select a book from the left panel'}</div>
        </div>`;
        updateStats(0, 0, 0, 0);
        return;
    }

    let html = '';
    let totalHighlights = 0, totalNotes = 0, totalBookmarks = 0;

    for (const title of bookTitles) {
        const entries = booksToRender[title];
        const hl = entries.filter(e => e.type === 'highlight' || e.type === 'highlight-with-note').length;
        const nt = entries.filter(e => e.type === 'note' || e.type === 'highlight-with-note').length;
        const bk = entries.filter(e => e.type === 'bookmark').length;
        totalHighlights += hl;
        totalNotes += nt;
        totalBookmarks += bk;

        html += `<div class="book-group">`;
        html += `<div class="book-title-header">`;
        html += `<span class="book-icon">📖</span>`;
        html += `<span>${escapeHtml(title)}</span>`;
        html += `<span class="book-count">${entries.length} clip${entries.length > 1 ? 's' : ''}</span>`;
        html += `</div>`;

        for (const clip of entries) {
            const entryClass = clip.type === 'highlight-with-note' ? 'highlight-with-note' : clip.type;
            html += `<div class="clip-entry ${entryClass}">`;
            html += `<div class="clip-meta">`;

            if (clip.type === 'highlight-with-note') {
                html += `<span class="clip-type-badge hl-badge">highlight</span>`;
                html += ` <span class="clip-type-badge nt-badge">+ note</span>`;
            } else {
                html += `<span class="clip-type-badge">${clip.type}</span>`;
            }

            if (clip.page) html += `<span class="clip-meta-sep"> · </span><span>Page ${escapeHtml(clip.page)}</span>`;
            if (clip.location) html += `<span class="clip-meta-sep"> · </span><span>Loc ${escapeHtml(clip.location)}</span>`;
            if (clip.date) html += `<span class="clip-meta-sep"> · </span><span>${escapeHtml(clip.date)}</span>`;
            html += `</div>`;

            if (clip.content) {
                html += `<div class="clip-content">${escapeHtml(clip.content)}</div>`;
            } else if (clip.type === 'bookmark') {
                html += `<div class="clip-content" style="color:#999;">(bookmark)</div>`;
            }

            // Show attached note if this is a combined entry
            if (clip.attachedNote) {
                html += `<div class="attached-note">`;
                html += `<div class="attached-note-label">📝 Note:</div>`;
                html += `<div class="attached-note-content">${escapeHtml(clip.attachedNote)}</div>`;
                html += `</div>`;
            }

            html += `</div>`;
        }

        html += `</div>`;
    }

    editor.innerHTML = html;
    updateStats(bookTitles.length, totalHighlights, totalNotes, totalBookmarks);
}

// ── Update Stats Bar ──
function updateStats(books, highlights, notes, bookmarks) {
    if (books === 0) {
        statsBar.innerHTML = '<span class="stat-item">No clippings to display</span>';
        return;
    }
    let html = '';
    html += `<span class="stat-item"><strong>${books}</strong> book${books > 1 ? 's' : ''}</span>`;
    html += `<span class="stat-item"><span class="stat-dot hl"></span> ${highlights} highlight${highlights !== 1 ? 's' : ''}</span>`;
    html += `<span class="stat-item"><span class="stat-dot nt"></span> ${notes} note${notes !== 1 ? 's' : ''}</span>`;
    if (bookmarks > 0) {
        html += `<span class="stat-item"><span class="stat-dot bk"></span> ${bookmarks} bookmark${bookmarks !== 1 ? 's' : ''}</span>`;
    }
    statsBar.innerHTML = html;
}

// ── Filter Books ──
bookFilter.addEventListener('input', () => {
    renderBookList();
});

// ── Content Search ──
contentSearch.addEventListener('input', () => {
    renderEditor();
});

// ── Toolbar: Copy as plain text ──
document.getElementById('btnCopyText').addEventListener('click', () => {
    const booksToExport = selectedBook ? { [selectedBook]: allBooks[selectedBook] } : allBooks;
    let text = '';
    for (const [bookTitle, clips] of Object.entries(booksToExport)) {
        text += `═══ ${bookTitle} ═══\n\n`;
        for (const clip of clips) {
            const typeLabel = clip.type.charAt(0).toUpperCase() + clip.type.slice(1);
            text += `[${typeLabel}]`;
            if (clip.page) text += ` Page ${clip.page}`;
            if (clip.location) text += ` Loc ${clip.location}`;
            text += '\n';
            if (clip.content) text += `${clip.content}\n`;
            text += '\n';
        }
    }
    copyToClipboard(text, 'btnCopyText');
});

// ── Toolbar: Copy as rich text (HTML) ──
document.getElementById('btnCopyHtml').addEventListener('click', () => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('copy');
    selection.removeAllRanges();

    const btn = document.getElementById('btnCopyHtml');
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => btn.textContent = orig, 1500);
});

// ── Toolbar: Send to OneNote ──
document.getElementById('btnSendOneNote').addEventListener('click', () => {
    const btn = document.getElementById('btnSendOneNote');
    const orig = btn.innerHTML;

    // Copy rich HTML to clipboard for pasting into OneNote
    const styledHtml = `<html><head><style>${getClipStyles()}</style></head><body>${editor.innerHTML}</body></html>`;
    const htmlBlob = new Blob([styledHtml], { type: 'text/html' });
    const textBlob = new Blob([editor.innerText], { type: 'text/plain' });

    navigator.clipboard.write([
        new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })
    ]).then(() => {
        btn.innerHTML = '✓ Copied! Opening OneNote...';
        window.open('https://www.onenote.com/notebooks', '_blank');
        setTimeout(() => btn.innerHTML = orig, 3000);
    }).catch(() => {
        // Fallback: select and copy editor content
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand('copy');
        sel.removeAllRanges();
        btn.innerHTML = '✓ Copied! Opening OneNote...';
        window.open('https://www.onenote.com/notebooks', '_blank');
        setTimeout(() => btn.innerHTML = orig, 3000);
    });
});

// ── Toolbar: View in new tab ──
document.getElementById('btnViewTab').addEventListener('click', () => {
    const newWin = window.open('', '_blank');
    if (newWin) {
        newWin.document.write(`<!DOCTYPE html>
            <html><head><meta charset="UTF-8"><title>Kindle Clippings</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 20px; background: #f5f5f5; color: #333; max-width: 800px; margin: 0 auto; }
                ${getClipStyles()}
            </style></head>
            <body>${editor.innerHTML}</body></html>`);
        newWin.document.close();
    }
});

// ── Utility Functions ──
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function copyToClipboard(text, btnId) {
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById(btnId);
        const orig = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => btn.textContent = orig, 1500);
    }).catch(() => {
        alert('Failed to copy to clipboard');
    });
}

function getClipStyles() {
    return `
        .book-group { margin-bottom: 24px; }
        .book-title-header { font-size: 16px; font-weight: 700; color: #2c3e50; padding: 8px 0; margin-bottom: 8px; border-bottom: 2px solid #3498db; display: flex; align-items: center; gap: 8px; }
        .book-title-header .book-icon { font-size: 18px; }
        .book-title-header .book-count { font-size: 11px; color: #999; font-weight: 400; margin-left: auto; }
        .clip-entry { margin-bottom: 12px; padding: 10px 14px; border-radius: 6px; border-left: 4px solid; }
        .clip-entry.highlight { background-color: #fef9e7; border-left-color: #f1c40f; }
        .clip-entry.note { background-color: #eaf2f8; border-left-color: #3498db; }
        .clip-entry.bookmark { background-color: #f0faf0; border-left-color: #27ae60; }
        .clip-meta { font-size: 11px; color: #999; margin-bottom: 6px; }
        .clip-meta > span { margin-right: 4px; }
        .clip-meta-sep { color: #ccc; }
        .clip-type-badge { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .clip-entry.highlight .clip-type-badge { background: #f1c40f; color: #7d6608; }
        .clip-entry.note .clip-type-badge { background: #3498db; color: #fff; }
        .clip-entry.bookmark .clip-type-badge { background: #27ae60; color: #fff; }
        .clip-content { font-size: 14px; line-height: 1.5; color: #2c3e50; }
        .clip-entry.note .clip-content { font-style: italic; }
        .clip-entry.highlight-with-note { background: linear-gradient(135deg, #fef9e7 0%, #fef9e7 70%, #eaf2f8 100%); border-left-color: #f1c40f; border-right: 3px solid #3498db; }
        .clip-entry.highlight-with-note .hl-badge { background: #f1c40f; color: #7d6608; }
        .clip-entry.highlight-with-note .nt-badge { background: #3498db; color: #fff; }
        .attached-note { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #ccc; }
        .attached-note-label { font-size: 11px; font-weight: 600; color: #2471a3; margin-bottom: 3px; }
        .attached-note-content { font-size: 13px; line-height: 1.5; color: #2471a3; font-style: italic; }
    `;
}