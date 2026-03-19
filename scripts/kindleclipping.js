// ── DOM Elements ──
const fileInput = document.getElementById('fileInput');
const fileStatus = document.getElementById('fileStatus');
const bookFilter = document.getElementById('bookFilter');
const bookList = document.getElementById('bookList');
const bookCountBadge = document.getElementById('bookCountBadge');
const editor = document.getElementById('editor');
const statsBar = document.getElementById('statsBar');
const contentSearch = document.getElementById('contentSearch');
const paginationBar = document.getElementById('paginationBar');
const pageNumbers = document.getElementById('pageNumbers');
const pageInfo = document.getElementById('pageInfo');
const pageSizeSelect = document.getElementById('pageSize');

// ── State ──
let allBooks = {};       // { bookTitle: [ {type, location, page, date, content}, ... ] }
let selectedBook = null; // null = show all, string = specific book title
let currentPage = 1;
let itemsPerPage = 20;

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
        currentPage = 1;
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

        // Determine clip type (multilingual Kindle support)
        // Supported: English, Chinese, German, French, Spanish, Portuguese, Italian, Dutch, Japanese, Korean, Turkish, Polish, Russian, Swedish
        let clipType = 'highlight';
        const metaLower = metaLine.toLowerCase();
        if (
            /your note/i.test(metaLine) ||                          // English
            /笔记/.test(metaLine) ||                                 // Chinese
            /\bNotiz\b/i.test(metaLine) ||                          // German
            /\bvotre note\b/i.test(metaLine) ||                     // French
            /\b(?:tu |su )?nota\b/i.test(metaLine) ||              // Spanish / Italian / Portuguese
            /\bnotitie\b/i.test(metaLine) ||                        // Dutch
            /メモ/.test(metaLine) ||                                  // Japanese
            /메모/.test(metaLine) ||                                  // Korean
            /\bnotatk[aię]/i.test(metaLine) ||                      // Polish
            /заметк[аи]/i.test(metaLine) ||                          // Russian
            /\banteckning\b/i.test(metaLine) ||                      // Swedish
            /\bnot\b/i.test(metaLine)                                // Turkish
        ) {
            clipType = 'note';
        } else if (
            /your bookmark/i.test(metaLine) ||                       // English
            /书签/.test(metaLine) ||                                  // Chinese
            /\bLesezeichen\b/i.test(metaLine) ||                    // German
            /\bsignet\b/i.test(metaLine) ||                         // French
            /\bmarcador\b/i.test(metaLine) ||                       // Spanish / Portuguese
            /\bsegnalibro\b/i.test(metaLine) ||                     // Italian
            /\bbladwijzer\b/i.test(metaLine) ||                      // Dutch
            /ブックマーク/.test(metaLine) ||                           // Japanese
            /북마크/.test(metaLine) ||                                 // Korean
            /\bzakładk[aię]/i.test(metaLine) ||                     // Polish
            /закладк[аи]/i.test(metaLine) ||                         // Russian
            /\bbokmärke\b/i.test(metaLine) ||                       // Swedish
            /\byer ?imi\b/i.test(metaLine)                           // Turkish
        ) {
            clipType = 'bookmark';
        } else if (
            /your highlight/i.test(metaLine) ||                      // English
            /标注/.test(metaLine) || /高亮/.test(metaLine) ||         // Chinese
            /\bMarkierung\b/i.test(metaLine) ||                     // German
            /\bsurlignement\b/i.test(metaLine) ||                   // French
            /\b(?:subrayado|resaltado)\b/i.test(metaLine) ||        // Spanish
            /\bdestaque\b/i.test(metaLine) ||                       // Portuguese
            /\bevidenziazione\b/i.test(metaLine) ||                 // Italian
            /\bmarkering\b/i.test(metaLine) ||                      // Dutch
            /ハイライト/.test(metaLine) ||                             // Japanese
            /하이라이트/.test(metaLine) ||                              // Korean
            /\bpodkreślen/i.test(metaLine) ||                        // Polish
            /выделени[еяй]/i.test(metaLine) ||                      // Russian
            /\bmarkering\b/i.test(metaLine) ||                      // Swedish
            /\bvurgulama\b/i.test(metaLine)                          // Turkish
        ) {
            clipType = 'highlight';
        }

        // Extract location/position (multilingual)
        // English: "Location 100-110" / "Loc. 100-110"
        // German: "Pos. 2919-28"
        // French: "Emplacement 100" / "Position 100"
        // Spanish/Portuguese/Italian: "Posición/Posição/Posizione 100"
        // Chinese: "位置 #100-110"
        // Japanese/Korean: 位置
        // Dutch: "Locatie 100" / "Positie 100"
        const locMatch = metaLine.match(/(?:location|loc\.?|pos\.?|emplacement|posición|posição|posizione|positie|locatie)\s+([\d-]+)/i) ||
            metaLine.match(/位置\s*#?([\d-]+)/i);
        const location = locMatch ? locMatch[1] : '';

        // Extract page (multilingual)
        // English: "page 42"
        // German: "Seite 42"
        // French: "page 42"
        // Spanish: "página 42"
        // Portuguese: "página 42"
        // Italian: "pagina 42"
        // Dutch: "pagina 42"
        // Chinese: "第 42 页"
        // Turkish: "sayfa 42"
        // Polish: "strona 42"
        // Russian: "страница 42"
        // Swedish: "sida 42"
        const pageMatch = metaLine.match(/(?:page|seite|página|pagina|sayfa|strona|страница|sida)\s+([\d-]+)/i) ||
            metaLine.match(/第\s*([\d-]+)\s*页/);
        const page = pageMatch ? pageMatch[1] : '';

        // Extract date (multilingual)
        // English: "Added on Monday, ..."
        // German: "Hinzugefügt am Sonntag, ..."
        // French: "Ajouté le ..."
        // Spanish: "Añadido el ..."
        // Portuguese: "Adicionado em ..."
        // Italian: "Aggiunto il ..."
        // Dutch: "Toegevoegd op ..."
        // Chinese: "添加于 ..."
        // Turkish: "Eklenme Tarihi: ..."
        // Polish: "Dodano: ..." / "Dodano dnia ..."
        // Russian: "Добавлено: ..."
        // Swedish: "Tillagd den ..."
        // Japanese: "追加日" / Korean: "추가한 날짜"
        const dateMatch = metaLine.match(/Added on\s+(.+)$/i) ||
            metaLine.match(/Hinzugefügt am\s+(.+)$/i) ||
            metaLine.match(/Ajouté le\s+(.+)$/i) ||
            metaLine.match(/Añadido el\s+(.+)$/i) ||
            metaLine.match(/Adicionado em\s+(.+)$/i) ||
            metaLine.match(/Aggiunto il\s+(.+)$/i) ||
            metaLine.match(/Toegevoegd op\s+(.+)$/i) ||
            metaLine.match(/Eklenme Tarihi:?\s+(.+)$/i) ||
            metaLine.match(/Dodano:?\s+(?:dnia\s+)?(.+)$/i) ||
            metaLine.match(/Добавлено:?\s+(.+)$/i) ||
            metaLine.match(/Tillagd den\s+(.+)$/i) ||
            metaLine.match(/添加于\s+(.+)$/) ||
            metaLine.match(/追加日\s*(.+)$/) ||
            metaLine.match(/추가한 날짜\s*(.+)$/);
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

// ── Get filtered books for rendering ──
function getFilteredBooks() {
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

    return booksToRender;
}

// ── Flatten books into a flat list of {bookTitle, clip} for pagination ──
function flattenClips(booksToRender) {
    const flat = [];
    for (const [title, clips] of Object.entries(booksToRender)) {
        for (const clip of clips) {
            flat.push({ bookTitle: title, clip });
        }
    }
    return flat;
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
            currentPage = 1;
            renderBookList();
            renderEditor();
        });
    });
}

// ── Render Editor ──
function renderEditor() {
    const booksToRender = getFilteredBooks();
    const bookTitles = Object.keys(booksToRender);
    const searchText = contentSearch ? contentSearch.value.trim().toLowerCase() : '';

    if (bookTitles.length === 0) {
        editor.innerHTML = `<div class="empty-state">
            <div class="icon">📂</div>
            <div class="title">${searchText ? 'No matching clippings' : 'No clippings to display'}</div>
            <div class="subtitle">${searchText ? 'Try a different search term' : 'Select a book from the left panel'}</div>
        </div>`;
        updateStats(0, 0, 0, 0);
        paginationBar.style.display = 'none';
        return;
    }

    // Flatten all clips for pagination
    const allFlat = flattenClips(booksToRender);
    const totalClips = allFlat.length;

    // Calculate total stats from all clips (not just current page)
    let totalHighlights = 0, totalNotes = 0, totalBookmarks = 0;
    for (const { clip } of allFlat) {
        if (clip.type === 'highlight' || clip.type === 'highlight-with-note') totalHighlights++;
        if (clip.type === 'note' || clip.type === 'highlight-with-note') totalNotes++;
        if (clip.type === 'bookmark') totalBookmarks++;
    }

    // Determine page slice
    let pageClips;
    let totalPages;

    if (itemsPerPage === 0) {
        // Show all
        pageClips = allFlat;
        totalPages = 1;
        currentPage = 1;
    } else {
        totalPages = Math.ceil(totalClips / itemsPerPage);
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIdx = (currentPage - 1) * itemsPerPage;
        const endIdx = startIdx + itemsPerPage;
        pageClips = allFlat.slice(startIdx, endIdx);
    }

    // Group the page clips back by book title (preserving order)
    const pageBooks = new Map();
    for (const { bookTitle, clip } of pageClips) {
        if (!pageBooks.has(bookTitle)) {
            pageBooks.set(bookTitle, []);
        }
        pageBooks.get(bookTitle).push(clip);
    }

    // Render HTML
    let html = '';

    for (const [title, entries] of pageBooks) {
        const totalForBook = booksToRender[title].length;

        html += `<div class="book-group">`;
        html += `<div class="book-title-header">`;
        html += `<span class="book-icon">📖</span>`;
        html += `<span>${escapeHtml(title)}</span>`;
        html += `<span class="book-count">${totalForBook} clip${totalForBook > 1 ? 's' : ''}</span>`;
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
    editor.scrollTop = 0;
    updateStats(bookTitles.length, totalHighlights, totalNotes, totalBookmarks);
    renderPagination(totalClips, totalPages);
}

// ── Render Pagination Controls ──
function renderPagination(totalClips, totalPages) {
    if (totalPages <= 1 && itemsPerPage === 0) {
        paginationBar.style.display = 'none';
        // Still show the bar if items exist, for page size selection
        if (totalClips > 10) {
            paginationBar.style.display = 'flex';
            pageNumbers.innerHTML = '';
            document.getElementById('pageFirst').style.display = 'none';
            document.getElementById('pagePrev').style.display = 'none';
            document.getElementById('pageNext').style.display = 'none';
            document.getElementById('pageLast').style.display = 'none';
            pageInfo.textContent = `Showing all ${totalClips} clippings`;
        }
        return;
    }

    if (totalPages <= 1) {
        // Only 1 page, but show the bar for page size selection if there are clips
        paginationBar.style.display = totalClips > 0 ? 'flex' : 'none';
        pageNumbers.innerHTML = '';
        document.getElementById('pageFirst').style.display = 'none';
        document.getElementById('pagePrev').style.display = 'none';
        document.getElementById('pageNext').style.display = 'none';
        document.getElementById('pageLast').style.display = 'none';
        pageInfo.textContent = `Showing ${totalClips} clipping${totalClips !== 1 ? 's' : ''}`;
        return;
    }

    paginationBar.style.display = 'flex';
    document.getElementById('pageFirst').style.display = '';
    document.getElementById('pagePrev').style.display = '';
    document.getElementById('pageNext').style.display = '';
    document.getElementById('pageLast').style.display = '';

    // Enable/disable nav buttons
    document.getElementById('pageFirst').disabled = currentPage === 1;
    document.getElementById('pagePrev').disabled = currentPage === 1;
    document.getElementById('pageNext').disabled = currentPage === totalPages;
    document.getElementById('pageLast').disabled = currentPage === totalPages;

    // Build page number buttons with ellipsis
    let numbersHtml = '';
    const maxVisible = 7; // max page buttons to show

    if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) {
            numbersHtml += `<button class="page-btn${i === currentPage ? ' active' : ''}" data-page="${i}">${i}</button>`;
        }
    } else {
        // Always show first page
        numbersHtml += `<button class="page-btn${1 === currentPage ? ' active' : ''}" data-page="1">1</button>`;

        let startPage = Math.max(2, currentPage - 2);
        let endPage = Math.min(totalPages - 1, currentPage + 2);

        // Adjust range to show at least 5 middle buttons
        if (currentPage <= 3) {
            endPage = Math.min(totalPages - 1, 5);
        }
        if (currentPage >= totalPages - 2) {
            startPage = Math.max(2, totalPages - 4);
        }

        if (startPage > 2) {
            numbersHtml += `<span class="page-ellipsis">…</span>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            numbersHtml += `<button class="page-btn${i === currentPage ? ' active' : ''}" data-page="${i}">${i}</button>`;
        }

        if (endPage < totalPages - 1) {
            numbersHtml += `<span class="page-ellipsis">…</span>`;
        }

        // Always show last page
        numbersHtml += `<button class="page-btn${totalPages === currentPage ? ' active' : ''}" data-page="${totalPages}">${totalPages}</button>`;
    }

    pageNumbers.innerHTML = numbersHtml;

    // Page info text
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalClips);
    pageInfo.textContent = `${startItem}–${endItem} of ${totalClips}`;

    // Attach click handlers to page number buttons
    pageNumbers.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const p = parseInt(btn.getAttribute('data-page'));
            if (p && p !== currentPage) {
                currentPage = p;
                renderEditor();
            }
        });
    });
}

// ── Pagination Navigation Handlers ──
document.getElementById('pageFirst').addEventListener('click', () => {
    if (currentPage !== 1) {
        currentPage = 1;
        renderEditor();
    }
});

document.getElementById('pagePrev').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderEditor();
    }
});

document.getElementById('pageNext').addEventListener('click', () => {
    currentPage++;
    renderEditor();
});

document.getElementById('pageLast').addEventListener('click', () => {
    // Calculate total pages
    const booksToRender = getFilteredBooks();
    const totalClips = flattenClips(booksToRender).length;
    const totalPages = itemsPerPage === 0 ? 1 : Math.ceil(totalClips / itemsPerPage);
    if (currentPage !== totalPages) {
        currentPage = totalPages;
        renderEditor();
    }
});

pageSizeSelect.addEventListener('change', () => {
    itemsPerPage = parseInt(pageSizeSelect.value);
    currentPage = 1;
    renderEditor();
});

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
    currentPage = 1;
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
    const inlineHtml = buildInlineStyledHtml();
    const htmlBlob = new Blob([inlineHtml], { type: 'text/html' });
    const textBlob = new Blob([editor.innerText], { type: 'text/plain' });

    navigator.clipboard.write([
        new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })
    ]).then(() => {
        const btn = document.getElementById('btnCopyHtml');
        const orig = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => btn.textContent = orig, 1500);
    }).catch(() => {
        // Fallback: select and copy editor content
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand('copy');
        sel.removeAllRanges();

        const btn = document.getElementById('btnCopyHtml');
        const orig = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => btn.textContent = orig, 1500);
    });
});

// ── Toolbar: Send to OneNote ──
document.getElementById('btnSendOneNote').addEventListener('click', () => {
    const btn = document.getElementById('btnSendOneNote');
    const orig = btn.innerHTML;

    // Copy rich HTML with inline styles for OneNote compatibility
    const inlineHtml = buildInlineStyledHtml();
    const htmlBlob = new Blob([inlineHtml], { type: 'text/html' });
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

// ── Toolbar: Export as PDF ──
document.getElementById('btnExportPdf').addEventListener('click', () => {
    const btn = document.getElementById('btnExportPdf');
    const orig = btn.textContent;

    // Build full HTML content (all clips, not just current page) respecting book selection and search filter
    const pdfHtml = buildPdfHtml();
    if (!pdfHtml) {
        btn.textContent = '⚠ No clippings!';
        setTimeout(() => btn.textContent = orig, 2000);
        return;
    }

    btn.textContent = '⏳ Generating...';

    const pdfWin = window.open('', '_blank');
    if (!pdfWin) {
        btn.textContent = '⚠ Popup blocked!';
        setTimeout(() => btn.textContent = orig, 2500);
        return;
    }

    // Determine title for the PDF
    let pdfTitle = 'Kindle Clippings';
    if (selectedBook) {
        pdfTitle = selectedBook;
    }

    pdfWin.document.write(buildPdfDocument(pdfTitle, pdfHtml));
    pdfWin.document.close();

    // Wait for content to render, then trigger print
    pdfWin.onload = () => {
        setTimeout(() => {
            pdfWin.print();
            btn.textContent = orig;
        }, 300);
    };

    // Fallback if onload doesn't fire (some browsers)
    setTimeout(() => {
        btn.textContent = orig;
    }, 3000);
});

// ── Build PDF HTML content (all matching clips, ignoring pagination) ──
function buildPdfHtml() {
    let booksToRender = {};
    if (selectedBook === null) {
        booksToRender = allBooks;
    } else if (allBooks[selectedBook]) {
        booksToRender = { [selectedBook]: allBooks[selectedBook] };
    }

    // Apply content search filter
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
    if (bookTitles.length === 0) return null;

    let html = '';

    for (const title of bookTitles) {
        const entries = booksToRender[title];

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

    return html;
}

// ── Build full PDF document with print-optimized styles ──
function buildPdfDocument(title, bodyHtml) {
    const c = getCurrentColors();
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(title)} – Kindle Clippings</title>
    <style>
        /* ── Reset & Base ── */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #333;
            padding: 20px 30px;
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
        }

        /* ── PDF Header ── */
        .pdf-header {
            text-align: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 2px solid #2c3e50;
        }
        .pdf-header h1 {
            font-size: 22px;
            color: #2c3e50;
            margin-bottom: 4px;
        }
        .pdf-header .pdf-subtitle {
            font-size: 12px;
            color: #999;
        }

        /* ── Book Group ── */
        .book-group {
            margin-bottom: 20px;
        }
        .book-title-header {
            font-size: 15px;
            font-weight: 700;
            color: #2c3e50;
            padding: 6px 0;
            margin-bottom: 8px;
            border-bottom: 2px solid #3498db;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .book-title-header .book-icon { font-size: 16px; }
        .book-title-header .book-count {
            font-size: 10px;
            color: #999;
            font-weight: 400;
            margin-left: auto;
        }

        /* ── Clip Entries ── */
        .clip-entry {
            margin-bottom: 10px;
            padding: 8px 12px;
            border-radius: 4px;
            border-left: 4px solid;
            page-break-inside: avoid;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .clip-entry.highlight {
            background-color: ${c.hlBg};
            border-left-color: ${c.hlBorder};
        }
        .clip-entry.note {
            background-color: ${c.ntBg};
            border-left-color: ${c.ntBorder};
        }
        .clip-entry.bookmark {
            background-color: ${c.bkBg};
            border-left-color: ${c.bkBorder};
        }
        .clip-entry.highlight-with-note {
            background: linear-gradient(135deg, ${c.hlBg} 0%, ${c.hlBg} 70%, ${c.ntBg} 100%);
            border-left-color: ${c.hlBorder};
            border-right: 3px solid ${c.ntBorder};
        }

        /* ── Meta & Badges ── */
        .clip-meta {
            font-size: 10px;
            color: #999;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
        }
        .clip-meta-sep { color: #ccc; margin: 0 2px; }
        .clip-type-badge {
            display: inline-block;
            padding: 1px 7px;
            border-radius: 8px;
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .clip-entry.highlight .clip-type-badge { background: ${c.hlBadgeBg}; color: ${c.hlBadgeText}; }
        .clip-entry.note .clip-type-badge { background: ${c.ntBadgeBg}; color: ${c.ntBadgeText}; }
        .clip-entry.bookmark .clip-type-badge { background: ${c.bkBadgeBg}; color: ${c.bkBadgeText}; }
        .clip-entry.highlight-with-note .hl-badge { background: ${c.hlBadgeBg}; color: ${c.hlBadgeText}; }
        .clip-entry.highlight-with-note .nt-badge { background: ${c.ntBadgeBg}; color: ${c.ntBadgeText}; }

        /* ── Content ── */
        .clip-content {
            font-size: 13px;
            line-height: 1.5;
            color: #2c3e50;
        }
        .clip-entry.highlight .clip-content { color: ${c.hlText}; }
        .clip-entry.note .clip-content { font-style: italic; color: ${c.ntText}; }
        .clip-entry.bookmark .clip-content { color: ${c.bkText}; }
        .clip-entry.highlight-with-note .clip-content { color: ${c.hlText}; }

        /* ── Attached Notes ── */
        .attached-note {
            margin-top: 6px;
            padding-top: 6px;
            border-top: 1px dashed #ccc;
        }
        .attached-note-label {
            font-size: 10px;
            font-weight: 600;
            color: ${c.ntText};
            margin-bottom: 2px;
        }
        .attached-note-content {
            font-size: 12px;
            line-height: 1.4;
            color: ${c.ntText};
            font-style: italic;
        }

        /* ── PDF Footer ── */
        .pdf-footer {
            margin-top: 24px;
            padding-top: 12px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 10px;
            color: #bbb;
        }

        /* ── Print-specific rules ── */
        @media print {
            body { padding: 0; }
            .pdf-header { margin-bottom: 16px; }
            .book-group { page-break-inside: avoid; }
            .clip-entry { page-break-inside: avoid; }
            .no-print { display: none !important; }
        }

        /* ── Print instruction banner (hidden in print) ── */
        .print-instruction {
            background: ${c.ntBg};
            border: 1px solid ${c.ntBorder};
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 20px;
            font-size: 13px;
            color: #2c3e50;
            text-align: center;
        }
        .print-instruction strong { color: ${c.ntText}; }

        @media print {
            .print-instruction { display: none; }
        }
    </style>
</head>
<body>
    <div class="print-instruction no-print">
        💡 <strong>To save as PDF:</strong> In the Print dialog, select <strong>"Save as PDF"</strong> as the destination, then click <strong>Save</strong>.
    </div>

    <div class="pdf-header">
        <h1>📚 ${escapeHtml(title)}</h1>
        <div class="pdf-subtitle">Exported from Kindle Clipping Reader · ${new Date().toLocaleDateString()}</div>
    </div>

    ${bodyHtml}

    <div class="pdf-footer">
        Generated by Kindle Clipping Reader · ${new Date().toLocaleDateString()}
    </div>
</body>
</html>`;
}

// ── Get current color values from CSS custom properties ──
function getCurrentColors() {
    const root = document.documentElement;
    const get = (varName, fallback) => getComputedStyle(root).getPropertyValue(varName).trim() || fallback;
    return {
        hlBg: get('--hl-bg', '#fef9e7'),
        hlBorder: get('--hl-border', '#f1c40f'),
        hlText: get('--hl-text', '#2c3e50'),
        hlBadgeBg: get('--hl-badge-bg', '#f1c40f'),
        hlBadgeText: get('--hl-badge-text', '#7d6608'),
        ntBg: get('--nt-bg', '#eaf2f8'),
        ntBorder: get('--nt-border', '#3498db'),
        ntText: get('--nt-text', '#2471a3'),
        ntBadgeBg: get('--nt-badge-bg', '#3498db'),
        ntBadgeText: get('--nt-badge-text', '#ffffff'),
        bkBg: get('--bk-bg', '#f0faf0'),
        bkBorder: get('--bk-border', '#27ae60'),
        bkText: get('--bk-text', '#2c3e50'),
        bkBadgeBg: get('--bk-badge-bg', '#27ae60'),
        bkBadgeText: get('--bk-badge-text', '#ffffff'),
    };
}

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

// ── Build HTML with inline styles for clipboard compatibility ──
// OneNote/Word strip <style> blocks and CSS classes; they only honor inline style="" attributes.
function buildInlineStyledHtml() {
    let booksToRender = {};
    if (selectedBook === null) {
        booksToRender = allBooks;
    } else if (allBooks[selectedBook]) {
        booksToRender = { [selectedBook]: allBooks[selectedBook] };
    }

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
    if (bookTitles.length === 0) return '<p>No clippings to copy.</p>';

    const c = getCurrentColors();
    let html = '<div style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;color:#333;">';

    for (const title of bookTitles) {
        const entries = booksToRender[title];

        html += '<div style="margin-bottom:24px;">';
        html += `<div style="font-size:16px;font-weight:700;color:#2c3e50;padding:8px 0;margin-bottom:8px;border-bottom:2px solid #3498db;">`;
        html += `<span style="font-size:18px;">📖</span> ${escapeHtml(title)} `;
        html += `<span style="font-size:11px;color:#999;font-weight:400;">${entries.length} clip${entries.length > 1 ? 's' : ''}</span></div>`;

        for (const clip of entries) {
            let bgColor, borderLeftColor, borderRightStyle = '', contentColor;
            if (clip.type === 'highlight-with-note') {
                bgColor = c.hlBg; borderLeftColor = c.hlBorder; contentColor = c.hlText;
                borderRightStyle = `border-right:3px solid ${c.ntBorder};`;
            } else if (clip.type === 'highlight') {
                bgColor = c.hlBg; borderLeftColor = c.hlBorder; contentColor = c.hlText;
            } else if (clip.type === 'note') {
                bgColor = c.ntBg; borderLeftColor = c.ntBorder; contentColor = c.ntText;
            } else {
                bgColor = c.bkBg; borderLeftColor = c.bkBorder; contentColor = c.bkText;
            }

            html += `<div style="margin-bottom:12px;padding:10px 14px;border-radius:6px;border-left:4px solid ${borderLeftColor};background-color:${bgColor};${borderRightStyle}">`;
            html += `<div style="font-size:11px;color:#999;margin-bottom:6px;">`;
            if (clip.type === 'highlight-with-note') {
                html += `<span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;background:${c.hlBadgeBg};color:${c.hlBadgeText};">highlight</span> `;
                html += `<span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;background:${c.ntBadgeBg};color:${c.ntBadgeText};">+ note</span>`;
            } else {
                let badgeBg, badgeColor;
                if (clip.type === 'highlight') { badgeBg = c.hlBadgeBg; badgeColor = c.hlBadgeText; }
                else if (clip.type === 'note') { badgeBg = c.ntBadgeBg; badgeColor = c.ntBadgeText; }
                else { badgeBg = c.bkBadgeBg; badgeColor = c.bkBadgeText; }
                html += `<span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;background:${badgeBg};color:${badgeColor};">${clip.type}</span>`;
            }
            if (clip.page) html += `<span style="color:#ccc;margin:0 2px;"> · </span><span>Page ${escapeHtml(clip.page)}</span>`;
            if (clip.location) html += `<span style="color:#ccc;margin:0 2px;"> · </span><span>Loc ${escapeHtml(clip.location)}</span>`;
            if (clip.date) html += `<span style="color:#ccc;margin:0 2px;"> · </span><span>${escapeHtml(clip.date)}</span>`;
            html += `</div>`;

            if (clip.content) {
                const italicStyle = clip.type === 'note' ? 'font-style:italic;' : '';
                html += `<div style="font-size:14px;line-height:1.5;color:${contentColor};${italicStyle}">${escapeHtml(clip.content)}</div>`;
            } else if (clip.type === 'bookmark') {
                html += `<div style="font-size:14px;line-height:1.5;color:#999;">(bookmark)</div>`;
            }

            if (clip.attachedNote) {
                html += `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #ccc;">`;
                html += `<div style="font-size:11px;font-weight:600;color:${c.ntText};margin-bottom:3px;">📝 Note:</div>`;
                html += `<div style="font-size:13px;line-height:1.5;color:${c.ntText};font-style:italic;">${escapeHtml(clip.attachedNote)}</div>`;
                html += `</div>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
    }

    html += '</div>';
    return html;
}

function getClipStyles() {
    const c = getCurrentColors();
    return `
        .book-group { margin-bottom: 24px; }
        .book-title-header { font-size: 16px; font-weight: 700; color: #2c3e50; padding: 8px 0; margin-bottom: 8px; border-bottom: 2px solid #3498db; display: flex; align-items: center; gap: 8px; }
        .book-title-header .book-icon { font-size: 18px; }
        .book-title-header .book-count { font-size: 11px; color: #999; font-weight: 400; margin-left: auto; }
        .clip-entry { margin-bottom: 12px; padding: 10px 14px; border-radius: 6px; border-left: 4px solid; }
        .clip-entry.highlight { background-color: ${c.hlBg}; border-left-color: ${c.hlBorder}; }
        .clip-entry.note { background-color: ${c.ntBg}; border-left-color: ${c.ntBorder}; }
        .clip-entry.bookmark { background-color: ${c.bkBg}; border-left-color: ${c.bkBorder}; }
        .clip-meta { font-size: 11px; color: #999; margin-bottom: 6px; }
        .clip-meta > span { margin-right: 4px; }
        .clip-meta-sep { color: #ccc; }
        .clip-type-badge { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .clip-entry.highlight .clip-type-badge { background: ${c.hlBadgeBg}; color: ${c.hlBadgeText}; }
        .clip-entry.note .clip-type-badge { background: ${c.ntBadgeBg}; color: ${c.ntBadgeText}; }
        .clip-entry.bookmark .clip-type-badge { background: ${c.bkBadgeBg}; color: ${c.bkBadgeText}; }
        .clip-content { font-size: 14px; line-height: 1.5; color: #2c3e50; }
        .clip-entry.highlight .clip-content { color: ${c.hlText}; }
        .clip-entry.note .clip-content { font-style: italic; color: ${c.ntText}; }
        .clip-entry.bookmark .clip-content { color: ${c.bkText}; }
        .clip-entry.highlight-with-note { background: linear-gradient(135deg, ${c.hlBg} 0%, ${c.hlBg} 70%, ${c.ntBg} 100%); border-left-color: ${c.hlBorder}; border-right: 3px solid ${c.ntBorder}; }
        .clip-entry.highlight-with-note .hl-badge { background: ${c.hlBadgeBg}; color: ${c.hlBadgeText}; }
        .clip-entry.highlight-with-note .nt-badge { background: ${c.ntBadgeBg}; color: ${c.ntBadgeText}; }
        .clip-entry.highlight-with-note .clip-content { color: ${c.hlText}; }
        .attached-note { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #ccc; }
        .attached-note-label { font-size: 11px; font-weight: 600; color: ${c.ntText}; margin-bottom: 3px; }
        .attached-note-content { font-size: 13px; line-height: 1.5; color: ${c.ntText}; font-style: italic; }
    `;
}
