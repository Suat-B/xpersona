/**
 * Mobile-First Speed Reader Logic
 * Uses IndexedDB for storage and RSVP for reading.
 */

// --- IndexedDB Wrapper ---
const DB_NAME = 'XPersonaReader';
const STORE_NAME = 'books';
const DB_VERSION = 1;

const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = e => reject(e);
    request.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            store.createIndex('lastRead', 'lastRead');
        }
    };
    request.onsuccess = e => resolve(e.target.result);
});

async function saveBook(bookData) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        // Ensure standard fields
        const record = {
            title: bookData.title || 'Untitled',
            author: bookData.author || 'Unknown',
            type: bookData.type,
            content: bookData.content, // Array of words
            progressIndex: 0,
            dateAdded: new Date(),
            lastRead: new Date(),
            coverUrl: bookData.coverUrl || null
        };
        const req = store.add(record);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function getBooks() {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result.reverse()); // Newest first
        req.onerror = () => reject(req.error);
    });
}

async function getBook(id) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function updateBookProgress(id, index) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => {
            const data = req.result;
            if (!data) return;
            data.progressIndex = index;
            data.lastRead = new Date();
            store.put(data);
            resolve();
        };
    });
}

async function deleteBook(id) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve();
    });
}


// --- App Logic ---

let currentBook = null;
let currentBookId = null;
let isPlaying = false;
let wpm = 300;
let intervalId = null;
let currentIndex = 0;

// DOM Elements
const fileInput = document.getElementById('file-input');
const bookshelfGrid = document.getElementById('books-grid');
const emptyState = document.getElementById('empty-state');
const readerView = document.getElementById('reader-view');
const loader = document.getElementById('loader');

// Reader DOM
const rsvpWord = document.getElementById('rsvp-word');
const progressSlider = document.getElementById('progress-slider');
const progressText = document.getElementById('progress-text');
const wpmDisplay = document.getElementById('wpm-display');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const playBtn = document.getElementById('play-btn');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadBookshelf();

    fileInput.addEventListener('change', handleFileUpload);
});

async function loadBookshelf() {
    bookshelfGrid.innerHTML = '';
    const books = await getBooks();

    if (books.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    books.forEach(book => {
        const percent = Math.round((book.progressIndex / book.content.length) * 100) || 0;
        const card = document.createElement('div');
        card.className = 'book-card';
        card.innerHTML = `
            <div class="book-cover">
                ${book.coverUrl ? `<img src="${book.coverUrl}">` : '📖'}
                <button class="delete-btn" onclick="event.stopPropagation(); removeBook(${book.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
            <div class="book-info">
                <div class="book-title">${book.title}</div>
                <div class="book-meta">${book.author}</div>
                <div class="book-progress">
                    <div class="progress-bar" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
        card.onclick = () => openReader(book.id);
        bookshelfGrid.appendChild(card);
    });
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    showLoader(true);

    try {
        let content = [];
        let title = file.name.replace(/\.[^/.]+$/, "");

        if (file.type === 'text/plain') {
            const text = await file.text();
            content = processText(text);
        } else if (file.type === 'application/pdf') {
            content = await parsePDF(file);
        } else if (file.type === 'application/epub+zip' || file.name.endsWith('.epub')) {
            const data = await parseEPUB(file);
            content = data.content;
            if (data.title) title = data.title;
        } else {
            alert('Unsupported file type');
            showLoader(false);
            return;
        }

        if (content.length === 0) {
            throw new Error('No text found in file');
        }

        await saveBook({
            title: title,
            type: file.type,
            content: content
        });

        showLoader(false);
        loadBookshelf();

    } catch (err) {
        console.error(err);
        alert('Error reading file: ' + err.message);
        showLoader(false);
    }

    fileInput.value = ''; // Reset
}

async function removeBook(id) {
    if (confirm('Delete this book?')) {
        await deleteBook(id);
        loadBookshelf();
    }
}


// --- Text Processing ---

function processText(text) {
    // Split by whitespace but keep logic to not break words weirdly
    // Basic split:
    return text.split(/\s+/).filter(w => w.length > 0);
}

// PDF Parsing using PDF.js
async function parsePDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ') + ' ';
    }

    return processText(fullText);
}

// EPUB Parsing using epub.js
async function parseEPUB(file) {
    const book = ePub(file);
    await book.ready;

    // Metadata
    const metadata = await book.loaded.metadata;

    // Text
    let fullText = '';
    // Spin through spine items
    const spine = book.spine;

    for (const item of spine.items) {
        // Note: This is a heavy operation for large books, doing it simply for now
        // ideally we load chapter by chapter but for RSVR we need the array
        try {
            const doc = await item.load(book.load.bind(book));
            // Extract text from the chapter document
            fullText += doc.body.textContent + ' ';
        } catch (e) {
            console.warn('Skipping chapter', e);
        }
    }

    return {
        title: metadata.title,
        content: processText(fullText)
    };
}


// --- Speed Reader Engine ---

async function openReader(id) {
    currentBookId = id;
    currentBook = await getBook(id);
    if (!currentBook) return;

    currentIndex = currentBook.progressIndex || 0;

    // Update UI
    document.getElementById('reader-title').textContent = currentBook.title;
    readerView.classList.add('active');

    updateDisplay();
}

function closeReader() {
    stop();
    readerView.classList.remove('active');
    loadBookshelf(); // Refresh progress bars
}

function togglePlay() {
    if (isPlaying) {
        stop();
    } else {
        start();
    }
}

function start() {
    if (currentIndex >= currentBook.content.length) {
        currentIndex = 0;
    }

    isPlaying = true;
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
    playBtn.style.background = '#e5e5e7'; // Dim
    playBtn.style.color = '#1d1d1f';

    const delay = 60000 / wpm;

    intervalId = setInterval(() => {
        if (currentIndex < currentBook.content.length) {
            updateDisplay();
            currentIndex++;

            // Save progress every 50 words to avoid hammering DB
            if (currentIndex % 50 === 0) {
                updateBookProgress(currentBookId, currentIndex);
            }
        } else {
            stop();
            currentIndex = 0; // Reset for next time or leave at end?
            updateBookProgress(currentBookId, currentBook.content.length);
        }
    }, delay);
}

function stop() {
    isPlaying = false;
    clearInterval(intervalId);
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    playBtn.style.background = '#0066cc'; // Active color
    playBtn.style.color = 'white';

    if (currentBookId) {
        updateBookProgress(currentBookId, currentIndex);
    }
}

function updateDisplay() {
    const word = currentBook.content[currentIndex];
    if (!word) return;

    // Highlight logic (ORP - Optimal Recognition Point)
    // Simple heuristic: Middle of word
    const middle = Math.floor(word.length / 2);
    const pre = word.slice(0, middle);
    const mid = word[middle];
    const post = word.slice(middle + 1);

    rsvpWord.innerHTML = `${pre}<span class="highlight">${mid}</span>${post}`;

    // Progress
    const progress = (currentIndex / currentBook.content.length) * 100;
    progressSlider.value = progress;
    progressText.textContent = `${Math.round(progress)}%`;

    // Time left
    const wordsLeft = currentBook.content.length - currentIndex;
    const minsLeft = Math.ceil(wordsLeft / wpm);
    document.getElementById('time-left').textContent = `${minsLeft} min left`;
}

function seek(percent) {
    const wasPlaying = isPlaying;
    if (wasPlaying) stop();

    currentIndex = Math.floor((percent / 100) * currentBook.content.length);
    updateDisplay();

    if (wasPlaying) start();
}

function updateWPM(val) {
    wpm = parseInt(val);
    wpmDisplay.textContent = `${wpm} WPM`;

    if (isPlaying) {
        // Restart interval with new speed
        clearInterval(intervalId);
        const delay = 60000 / wpm;
        intervalId = setInterval(() => {
            if (currentIndex < currentBook.content.length) {
                updateDisplay();
                currentIndex++;
            } else {
                stop();
            }
        }, delay);
    }
}

function rewind() {
    currentIndex = Math.max(0, currentIndex - 10);
    updateDisplay();
}

function forward() {
    currentIndex = Math.min(currentBook.content.length - 1, currentIndex + 10);
    updateDisplay();
}

function showLoader(show) {
    loader.style.display = show ? 'block' : 'none';
}
