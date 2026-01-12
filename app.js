// ==================== FIREBASE CONFIG ====================
// BookTracker Firebase Configuration

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCA_BtNApJ3po9Vlh8KWY7hXN8QQTS-BIA",
    authDomain: "booktrackerdatabase.firebaseapp.com",
    databaseURL: "https://booktrackerdatabase-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "booktrackerdatabase",
    storageBucket: "booktrackerdatabase.firebasestorage.app",
    messagingSenderId: "317901356294",
    appId: "1:317901356294:web:941851195aa0dd08d53287"
};

let firebaseApp = null;
let database = null;
let firebaseEnabled = false;
let firebaseUsers = [];

// Initialize Firebase if config is set
function initFirebase() {
    if (FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
        console.log('Firebase not configured - leaderboard will be local only');
        return false;
    }
    
    try {
        firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
        database = firebase.database();
        firebaseEnabled = true;
        console.log('Firebase initialized');
        
        // Listen for leaderboard changes in real-time
        database.ref('users').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                firebaseUsers = Object.values(data);
                if (document.getElementById('page-leaderboard').classList.contains('active')) {
                    refreshLeaderboard();
                }
            }
        });
        
        return true;
    } catch (error) {
        console.error('Firebase init error:', error);
        return false;
    }
}

// Sync current user stats to Firebase
function syncUserToFirebase() {
    if (!firebaseEnabled || !database) return;
    
    const stats = calculateStats();
    const userData = {
        id: currentUser.id,
        name: currentUser.name,
        pagesRead: stats.totalPages,
        booksCompleted: stats.completedBooks,
        lastUpdated: Date.now()
    };
    
    database.ref('users/' + currentUser.id).set(userData)
        .then(() => console.log('Synced to Firebase'))
        .catch(err => console.error('Firebase sync error:', err));
}

// ==================== DATA STORE ====================
const Store = {
    getUser() {
        const data = localStorage.getItem('booktracker_user');
        if (data) return JSON.parse(data);
        return {
            id: this.generateId(),
            name: 'Reader',
            email: 'reader@booktracker.app',
            createdAt: new Date().toISOString()
        };
    },
    
    saveUser(user) {
        localStorage.setItem('booktracker_user', JSON.stringify(user));
    },
    
    getBooks() {
        const data = localStorage.getItem('booktracker_books');
        return data ? JSON.parse(data) : [];
    },
    
    saveBooks(books) {
        localStorage.setItem('booktracker_books', JSON.stringify(books));
    },
    
    getProgress() {
        const data = localStorage.getItem('booktracker_progress');
        return data ? JSON.parse(data) : [];
    },
    
    saveProgress(progress) {
        localStorage.setItem('booktracker_progress', JSON.stringify(progress));
    },
    
    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    },
    
    clearAll() {
        localStorage.removeItem('booktracker_user');
        localStorage.removeItem('booktracker_books');
        localStorage.removeItem('booktracker_progress');
    },
    
    exportAll() {
        return JSON.stringify({
            user: this.getUser(),
            books: this.getBooks(),
            progress: this.getProgress()
        }, null, 2);
    },
    
    importAll(data) {
        const parsed = JSON.parse(data);
        if (parsed.user) this.saveUser(parsed.user);
        if (parsed.books) this.saveBooks(parsed.books);
        if (parsed.progress) this.saveProgress(parsed.progress);
    }
};

// ==================== OPEN LIBRARY API ====================
const BookAPI = {
    baseURL: 'https://openlibrary.org',
    
    async search(query) {
        const encoded = encodeURIComponent(query);
        const response = await fetch(`${this.baseURL}/search.json?q=${encoded}&limit=15`);
        const data = await response.json();
        
        return (data.docs || []).map(doc => ({
            id: Store.generateId(),
            isbn: doc.isbn?.[0] || '',
            title: doc.title || 'Unknown Title',
            authors: doc.author_name || ['Unknown Author'],
            pageCount: doc.number_of_pages_median || 0,
            coverURL: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
            publishedDate: doc.first_publish_year?.toString() || '',
            publisher: doc.publisher?.[0] || ''
        }));
    },
    
    async fetchByISBN(isbn) {
        const cleanISBN = isbn.replace(/-/g, '').trim();
        const response = await fetch(`${this.baseURL}/isbn/${cleanISBN}.json`);
        
        if (!response.ok) {
            throw new Error('Book not found');
        }
        
        const data = await response.json();
        
        let authors = ['Unknown Author'];
        if (data.authors) {
            const authorPromises = data.authors.map(async (author) => {
                if (author.name) return author.name;
                if (author.key) {
                    try {
                        const res = await fetch(`${this.baseURL}${author.key}.json`);
                        const authorData = await res.json();
                        return authorData.name || 'Unknown Author';
                    } catch {
                        return 'Unknown Author';
                    }
                }
                return 'Unknown Author';
            });
            authors = await Promise.all(authorPromises);
        }
        
        return {
            id: Store.generateId(),
            isbn: cleanISBN,
            title: data.title || 'Unknown Title',
            authors,
            pageCount: data.number_of_pages || 0,
            coverURL: data.covers?.[0] ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-M.jpg` : null,
            description: typeof data.description === 'string' ? data.description : data.description?.value || '',
            publishedDate: data.publish_date || '',
            publisher: data.publishers?.[0] || ''
        };
    },
    
    // Try to get page count from ISBN lookup or editions
    async getPageCount(book) {
        // If we already have page count, return it
        if (book.pageCount && book.pageCount > 0) {
            return book.pageCount;
        }
        
        // Try ISBN lookup first
        if (book.isbn) {
            try {
                const cleanISBN = book.isbn.replace(/-/g, '').trim();
                const response = await fetch(`${this.baseURL}/isbn/${cleanISBN}.json`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.number_of_pages && data.number_of_pages > 0) {
                        return data.number_of_pages;
                    }
                }
            } catch (e) {
                console.log('ISBN lookup failed:', e);
            }
        }
        
        // Try searching for editions by title
        try {
            const encoded = encodeURIComponent(book.title);
            const response = await fetch(`${this.baseURL}/search.json?title=${encoded}&limit=5`);
            const data = await response.json();
            
            if (data.docs && data.docs.length > 0) {
                // Look for a doc with page count
                for (const doc of data.docs) {
                    if (doc.number_of_pages_median && doc.number_of_pages_median > 0) {
                        return doc.number_of_pages_median;
                    }
                }
                
                // Try to get from first edition with ISBN
                const docWithIsbn = data.docs.find(d => d.isbn && d.isbn.length > 0);
                if (docWithIsbn && docWithIsbn.isbn[0]) {
                    try {
                        const isbnResponse = await fetch(`${this.baseURL}/isbn/${docWithIsbn.isbn[0]}.json`);
                        if (isbnResponse.ok) {
                            const isbnData = await isbnResponse.json();
                            if (isbnData.number_of_pages && isbnData.number_of_pages > 0) {
                                return isbnData.number_of_pages;
                            }
                        }
                    } catch (e) {
                        console.log('Edition ISBN lookup failed:', e);
                    }
                }
            }
        } catch (e) {
            console.log('Title search failed:', e);
        }
        
        return 0; // Could not find page count
    }
};

// ==================== APP STATE ====================
let currentUser = Store.getUser();
let books = Store.getBooks();
let progress = Store.getProgress();
let currentBookId = null;
let currentFilter = 'all';
let currentPeriod = 'weekly';
let videoStream = null;
let searchResults = []; // Store search results for adding

// ==================== NAVIGATION ====================
function showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const page = document.getElementById(`page-${pageName}`);
    if (page) {
        page.classList.add('active');
    }
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });
    
    const titles = {
        home: 'BookTracker',
        library: 'My Library',
        add: 'Add Book',
        leaderboard: 'Leaderboard',
        profile: 'Profile',
        'book-detail': 'Book Details'
    };
    document.getElementById('page-title').textContent = titles[pageName] || 'BookTracker';
    
    switch (pageName) {
        case 'home':
            refreshHome();
            break;
        case 'library':
            refreshLibrary();
            break;
        case 'leaderboard':
            refreshLeaderboard();
            break;
        case 'profile':
            refreshProfile();
            break;
    }
    
    if (pageName !== 'add' && videoStream) {
        stopCamera();
    }
}

// ==================== HOME PAGE ====================
function refreshHome() {
    const stats = calculateStats();
    document.getElementById('stat-pages').textContent = stats.totalPages;
    document.getElementById('stat-books').textContent = stats.completedBooks;
    document.getElementById('stat-streak').textContent = stats.streak;
    
    const currentlyReading = getUserBooks().filter(b => b.status === 'reading');
    const completed = getUserBooks().filter(b => b.status === 'completed').slice(0, 5);
    
    const readingContainer = document.getElementById('currently-reading');
    const completedContainer = document.getElementById('recently-completed');
    const emptyState = document.getElementById('empty-home');
    
    if (currentlyReading.length === 0 && completed.length === 0) {
        readingContainer.innerHTML = '';
        completedContainer.innerHTML = '';
        emptyState.classList.remove('hidden');
        document.querySelectorAll('#page-home .section').forEach(s => s.classList.add('hidden'));
    } else {
        emptyState.classList.add('hidden');
        document.querySelectorAll('#page-home .section').forEach(s => s.classList.remove('hidden'));
        
        readingContainer.innerHTML = currentlyReading.map(ub => createBookCard(ub, true)).join('');
        completedContainer.innerHTML = completed.map(ub => createBookCard(ub, false)).join('');
        
        if (currentlyReading.length === 0) {
            readingContainer.parentElement.classList.add('hidden');
        }
        if (completed.length === 0) {
            completedContainer.parentElement.classList.add('hidden');
        }
    }
}

function calculateStats() {
    let totalPages = 0;
    let completedBooks = 0;
    
    progress.forEach(p => {
        totalPages += p.currentPage || 0;
        if (p.isCompleted) completedBooks++;
    });
    
    return {
        totalPages,
        completedBooks,
        streak: Math.min(completedBooks, 7)
    };
}

function getUserBooks() {
    return books.map(book => {
        const prog = progress.find(p => p.bookId === book.id) || { currentPage: 0, isCompleted: false };
        let status = 'want';
        if (prog.isCompleted) status = 'completed';
        else if (prog.currentPage > 0) status = 'reading';
        
        return {
            ...book,
            progress: prog,
            status,
            percentComplete: book.pageCount > 0 ? Math.round((prog.currentPage / book.pageCount) * 100) : 0
        };
    });
}

function createBookCard(userBook, horizontal = false) {
    const coverImg = userBook.coverURL 
        ? `<img src="${userBook.coverURL}" alt="${escapeHtml(userBook.title)}" class="book-cover">`
        : `<div class="book-cover">📖</div>`;
    
    const progressBar = userBook.pageCount > 0 ? `
        <div class="book-progress">
            <div class="progress-bar">
                <div class="progress-fill ${userBook.status === 'completed' ? 'complete' : ''}" 
                     style="width: ${userBook.percentComplete}%"></div>
            </div>
            <span class="progress-text">${userBook.percentComplete}%</span>
        </div>
    ` : `<span class="page-warning">No page count</span>`;
    
    return `
        <div class="book-card" onclick="showBookDetail('${userBook.id}')">
            ${coverImg}
            <div class="book-info">
                <div class="book-title">${escapeHtml(userBook.title)}</div>
                <div class="book-author">${escapeHtml(userBook.authors?.join(', ') || 'Unknown')}</div>
                ${horizontal ? '' : progressBar}
            </div>
        </div>
    `;
}

// ==================== LIBRARY PAGE ====================
function refreshLibrary() {
    const searchText = document.getElementById('library-search').value.toLowerCase();
    let filtered = getUserBooks();
    
    if (currentFilter !== 'all') {
        filtered = filtered.filter(b => b.status === currentFilter);
    }
    
    if (searchText) {
        filtered = filtered.filter(b => 
            b.title.toLowerCase().includes(searchText) ||
            (b.authors?.join(' ') || '').toLowerCase().includes(searchText)
        );
    }
    
    const container = document.getElementById('library-list');
    const emptyState = document.getElementById('empty-library');
    
    if (filtered.length === 0) {
        container.innerHTML = '';
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        container.innerHTML = filtered.map(ub => createBookCard(ub, false)).join('');
    }
}

// ==================== ADD BOOK PAGE ====================
async function searchBooks() {
    const query = document.getElementById('book-search').value.trim();
    if (!query) return;
    
    const resultsContainer = document.getElementById('search-results');
    const loading = document.getElementById('search-loading');
    
    loading.classList.remove('hidden');
    resultsContainer.innerHTML = '';
    
    try {
        searchResults = await BookAPI.search(query);
        loading.classList.add('hidden');
        
        if (searchResults.length === 0) {
            resultsContainer.innerHTML = '<div class="empty-state"><p>No books found</p></div>';
        } else {
            resultsContainer.innerHTML = searchResults.map((book, index) => createSearchResult(book, index)).join('');
        }
    } catch (error) {
        loading.classList.add('hidden');
        resultsContainer.innerHTML = `<div class="empty-state"><p>Search failed: ${error.message}</p></div>`;
    }
}

function createSearchResult(book, index) {
    const isInLibrary = books.some(b => (b.isbn === book.isbn && book.isbn) || b.title === book.title);
    const coverImg = book.coverURL 
        ? `<img src="${book.coverURL}" alt="${escapeHtml(book.title)}" class="book-cover">`
        : `<div class="book-cover">📖</div>`;
    
    const pageInfo = book.pageCount > 0 
        ? `<span class="progress-text">${book.pageCount} pages</span>`
        : `<span class="page-warning">Page count unknown</span>`;
    
    return `
        <div class="book-card search-result">
            ${coverImg}
            <div class="book-info">
                <div class="book-title">${escapeHtml(book.title)}</div>
                <div class="book-author">${escapeHtml(book.authors?.join(', ') || 'Unknown')}</div>
                ${pageInfo}
            </div>
            <button class="add-book-btn ${isInLibrary ? 'added' : ''}" 
                    data-index="${index}"
                    ${isInLibrary ? 'disabled' : ''}>
                ${isInLibrary ? '✓' : '+'}
            </button>
        </div>
    `;
}

function handleAddBookClick(e) {
    const btn = e.target.closest('.add-book-btn');
    if (!btn || btn.disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const index = parseInt(btn.dataset.index);
    if (isNaN(index) || !searchResults[index]) return;
    
    // Show loading state
    btn.disabled = true;
    btn.textContent = '...';
    
    const book = { ...searchResults[index] };
    book.id = Store.generateId();
    
    // Try to get page count if missing
    if (!book.pageCount || book.pageCount === 0) {
        BookAPI.getPageCount(book).then(pageCount => {
            book.pageCount = pageCount;
            
            const success = addBook(book);
            if (success) {
                btn.classList.add('added');
                btn.textContent = '✓';
                if (pageCount > 0) {
                    showToast(`Book added! (${pageCount} pages)`);
                } else {
                    showToast('Book added! Set page count in library.');
                }
                syncUserToFirebase();
            } else {
                btn.disabled = false;
                btn.textContent = '+';
                showToast('Book already in library');
            }
        }).catch(() => {
            const success = addBook(book);
            if (success) {
                btn.classList.add('added');
                btn.textContent = '✓';
                showToast('Book added! Set page count in library.');
                syncUserToFirebase();
            } else {
                btn.disabled = false;
                btn.textContent = '+';
                showToast('Book already in library');
            }
        });
    } else {
        const success = addBook(book);
        if (success) {
            btn.classList.add('added');
            btn.textContent = '✓';
            showToast('Book added to library!');
            syncUserToFirebase();
        } else {
            btn.disabled = false;
            btn.textContent = '+';
            showToast('Book already in library');
        }
    }
}

function addBook(book) {
    // Check if already exists by title (more reliable than ISBN)
    const exists = books.some(b => 
        b.title.toLowerCase() === book.title.toLowerCase() ||
        (b.isbn && book.isbn && b.isbn === book.isbn)
    );
    
    if (exists) {
        return false;
    }
    
    if (!book.id) {
        book.id = Store.generateId();
    }
    
    books.push(book);
    Store.saveBooks(books);
    
    progress.push({
        id: Store.generateId(),
        userId: currentUser.id,
        bookId: book.id,
        currentPage: 0,
        isCompleted: false,
        dateStarted: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
    });
    Store.saveProgress(progress);
    
    return true;
}

// ==================== BARCODE SCANNER ====================
async function startCamera() {
    const video = document.getElementById('scanner-video');
    const btn = document.getElementById('start-scan-btn');
    
    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        video.srcObject = videoStream;
        video.play();
        btn.textContent = 'Stop Camera';
        btn.onclick = stopCamera;
        
        scanBarcode();
    } catch (error) {
        showToast('Camera access denied');
        console.error(error);
    }
}

function stopCamera() {
    const video = document.getElementById('scanner-video');
    const btn = document.getElementById('start-scan-btn');
    
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    video.srcObject = null;
    btn.textContent = 'Start Camera';
    btn.onclick = startCamera;
}

async function scanBarcode() {
    if (!videoStream) return;
    
    if ('BarcodeDetector' in window) {
        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        const video = document.getElementById('scanner-video');
        
        const scan = async () => {
            if (!videoStream) return;
            
            try {
                const barcodes = await detector.detect(video);
                if (barcodes.length > 0) {
                    const isbn = barcodes[0].rawValue;
                    stopCamera();
                    handleScannedISBN(isbn);
                    return;
                }
            } catch (e) {
                console.error(e);
            }
            
            requestAnimationFrame(scan);
        };
        
        scan();
    } else {
        showToast('Barcode scanning not supported. Use manual entry.');
    }
}

async function handleScannedISBN(isbn) {
    showToast('Looking up book...');
    
    try {
        const book = await BookAPI.fetchByISBN(isbn);
        showScannedBookModal(book);
    } catch (error) {
        showToast('Book not found for this ISBN');
    }
}

function showScannedBookModal(book) {
    window.scannedBook = book;
    
    const modal = document.getElementById('modal-content');
    const coverImg = book.coverURL 
        ? `<img src="${book.coverURL}" alt="${escapeHtml(book.title)}" style="width: 100px; height: 150px; object-fit: cover; border-radius: 8px; margin: 0 auto; display: block;">`
        : '';
    
    modal.innerHTML = `
        <div class="modal-header">
            <h3>Book Found!</h3>
            <button class="modal-close" onclick="hideModal()">×</button>
        </div>
        ${coverImg}
        <h3 style="text-align: center; margin: 1rem 0 0.5rem;">${escapeHtml(book.title)}</h3>
        <p style="text-align: center; color: var(--text-secondary);">${escapeHtml(book.authors?.join(', ') || 'Unknown')}</p>
        <p style="text-align: center; font-size: 0.875rem; color: var(--text-secondary);">
            ${book.pageCount > 0 ? book.pageCount + ' pages' : '<span style="color: var(--warning);">Page count unknown</span>'}
        </p>
        <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem;">
            <button class="btn btn-secondary" style="flex: 1;" onclick="hideModal()">Cancel</button>
            <button class="btn btn-primary" style="flex: 1;" onclick="addScannedBook()">Add to Library</button>
        </div>
    `;
    
    showModal();
}

function addScannedBook() {
    if (!window.scannedBook) return;
    
    const success = addBook(window.scannedBook);
    window.scannedBook = null;
    hideModal();
    
    if (success) {
        showToast('Book added to library!');
        syncUserToFirebase();
        showPage('library');
    } else {
        showToast('Book already in library');
    }
}

// ==================== MANUAL ENTRY ====================
function handleManualSubmit(e) {
    e.preventDefault();
    
    const book = {
        id: Store.generateId(),
        title: document.getElementById('manual-title').value.trim(),
        authors: [document.getElementById('manual-author').value.trim()],
        pageCount: parseInt(document.getElementById('manual-pages').value) || 0,
        isbn: document.getElementById('manual-isbn').value.trim(),
        coverURL: null
    };
    
    const success = addBook(book);
    
    if (success) {
        showToast('Book added to library!');
        document.getElementById('manual-form').reset();
        syncUserToFirebase();
        showPage('library');
    } else {
        showToast('Book already in library');
    }
}

// ==================== BOOK DETAIL ====================
function showBookDetail(bookId) {
    currentBookId = bookId;
    const book = books.find(b => b.id === bookId);
    const prog = progress.find(p => p.bookId === bookId) || { currentPage: 0 };
    
    if (!book) return;
    
    const coverImg = document.getElementById('detail-cover');
    if (book.coverURL) {
        coverImg.src = book.coverURL;
        coverImg.style.display = 'block';
    } else {
        coverImg.style.display = 'none';
    }
    
    document.getElementById('detail-title').textContent = book.title;
    document.getElementById('detail-author').textContent = book.authors?.join(', ') || 'Unknown';
    document.getElementById('detail-publisher').textContent = book.publisher || '';
    
    const percent = book.pageCount > 0 ? Math.round((prog.currentPage / book.pageCount) * 100) : 0;
    
    if (book.pageCount > 0) {
        document.getElementById('progress-section').classList.remove('hidden');
        document.getElementById('no-pages-warning').classList.add('hidden');
        document.getElementById('update-progress-btn').classList.remove('hidden');
        
        document.getElementById('progress-percent').textContent = percent + '%';
        document.getElementById('pages-read').textContent = `${prog.currentPage} / ${book.pageCount}`;
        document.getElementById('pages-remaining').textContent = book.pageCount - prog.currentPage;
        
        const ring = document.getElementById('progress-ring-fill');
        const circumference = 2 * Math.PI * 45;
        const offset = circumference - (percent / 100) * circumference;
        ring.style.strokeDashoffset = offset;
        ring.classList.toggle('complete', percent >= 100);
    } else {
        document.getElementById('progress-section').classList.add('hidden');
        document.getElementById('no-pages-warning').classList.remove('hidden');
        document.getElementById('update-progress-btn').classList.add('hidden');
    }
    
    showPage('book-detail');
}

function showUpdateProgress() {
    const book = books.find(b => b.id === currentBookId);
    const prog = progress.find(p => p.bookId === currentBookId) || { currentPage: 0 };
    
    if (!book || book.pageCount === 0) return;
    
    const modal = document.getElementById('modal-content');
    modal.innerHTML = `
        <div class="modal-header">
            <h3>Update Progress</h3>
            <button class="modal-close" onclick="hideModal()">×</button>
        </div>
        <p style="text-align: center; margin-bottom: 1rem;">
            Current: <strong>${prog.currentPage}</strong> / ${book.pageCount} pages
        </p>
        <div class="form-group">
            <label for="progress-input">Enter current page:</label>
            <input type="number" id="progress-input" value="${prog.currentPage}" min="0" max="${book.pageCount}">
        </div>
        <input type="range" class="progress-slider" id="progress-slider" 
               min="0" max="${book.pageCount}" value="${prog.currentPage}">
        <div class="slider-labels">
            <span>0</span>
            <span>${book.pageCount}</span>
        </div>
        <div class="quick-add-btns">
            <button class="quick-add-btn" onclick="quickAddPages(10)">+10</button>
            <button class="quick-add-btn" onclick="quickAddPages(25)">+25</button>
            <button class="quick-add-btn" onclick="quickAddPages(50)">+50</button>
        </div>
        <button class="btn btn-primary btn-block" onclick="saveProgress()">Save Progress</button>
    `;
    
    const slider = document.getElementById('progress-slider');
    const input = document.getElementById('progress-input');
    slider.oninput = () => input.value = slider.value;
    input.oninput = () => slider.value = input.value;
    
    showModal();
}

function quickAddPages(amount) {
    const book = books.find(b => b.id === currentBookId);
    const input = document.getElementById('progress-input');
    const slider = document.getElementById('progress-slider');
    const current = parseInt(input.value) || 0;
    const newValue = Math.min(current + amount, book.pageCount);
    input.value = newValue;
    slider.value = newValue;
}

function saveProgress() {
    const newPage = parseInt(document.getElementById('progress-input').value) || 0;
    const book = books.find(b => b.id === currentBookId);
    
    const progIndex = progress.findIndex(p => p.bookId === currentBookId);
    if (progIndex >= 0) {
        progress[progIndex].currentPage = Math.min(newPage, book.pageCount);
        progress[progIndex].lastUpdated = new Date().toISOString();
        
        if (newPage >= book.pageCount) {
            progress[progIndex].isCompleted = true;
            progress[progIndex].dateCompleted = new Date().toISOString();
        }
    }
    
    Store.saveProgress(progress);
    hideModal();
    showBookDetail(currentBookId);
    showToast('Progress updated!');
    syncUserToFirebase();
}

function showEditBook() {
    const book = books.find(b => b.id === currentBookId);
    if (!book) return;
    
    const modal = document.getElementById('modal-content');
    modal.innerHTML = `
        <div class="modal-header">
            <h3>Edit Book</h3>
            <button class="modal-close" onclick="hideModal()">×</button>
        </div>
        <form id="edit-book-form" class="form" onsubmit="saveBookEdit(event)">
            <div class="form-group">
                <label for="edit-title">Title</label>
                <input type="text" id="edit-title" value="${escapeHtml(book.title)}" required>
            </div>
            <div class="form-group">
                <label for="edit-author">Author</label>
                <input type="text" id="edit-author" value="${escapeHtml(book.authors?.join(', ') || '')}" required>
            </div>
            <div class="form-group">
                <label for="edit-pages">Number of Pages</label>
                <input type="number" id="edit-pages" value="${book.pageCount || ''}" min="1">
            </div>
            <div class="form-group">
                <label for="edit-isbn">ISBN</label>
                <input type="text" id="edit-isbn" value="${book.isbn || ''}">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Save Changes</button>
        </form>
    `;
    
    showModal();
}

function saveBookEdit(e) {
    e.preventDefault();
    
    const bookIndex = books.findIndex(b => b.id === currentBookId);
    if (bookIndex < 0) return;
    
    books[bookIndex].title = document.getElementById('edit-title').value.trim();
    books[bookIndex].authors = document.getElementById('edit-author').value.split(',').map(a => a.trim());
    books[bookIndex].pageCount = parseInt(document.getElementById('edit-pages').value) || 0;
    books[bookIndex].isbn = document.getElementById('edit-isbn').value.trim();
    
    Store.saveBooks(books);
    hideModal();
    showBookDetail(currentBookId);
    showToast('Book updated!');
}

function confirmDeleteBook() {
    const book = books.find(b => b.id === currentBookId);
    if (!book) return;
    
    const modal = document.getElementById('modal-content');
    modal.innerHTML = `
        <div class="modal-header">
            <h3>Remove Book</h3>
            <button class="modal-close" onclick="hideModal()">×</button>
        </div>
        <p style="margin-bottom: 1.5rem;">Are you sure you want to remove "<strong>${escapeHtml(book.title)}</strong>" from your library?</p>
        <div style="display: flex; gap: 0.75rem;">
            <button class="btn btn-secondary" style="flex: 1;" onclick="hideModal()">Cancel</button>
            <button class="btn btn-danger" style="flex: 1;" onclick="deleteBook()">Remove</button>
        </div>
    `;
    
    showModal();
}

function deleteBook() {
    books = books.filter(b => b.id !== currentBookId);
    progress = progress.filter(p => p.bookId !== currentBookId);
    
    Store.saveBooks(books);
    Store.saveProgress(progress);
    
    hideModal();
    showPage('library');
    showToast('Book removed');
    syncUserToFirebase();
}

// ==================== LEADERBOARD ====================
function refreshLeaderboard() {
    let entries = [];
    
    // Add current user
    const stats = calculateStats();
    entries.push({
        id: currentUser.id,
        name: currentUser.name,
        pagesRead: stats.totalPages,
        booksCompleted: stats.completedBooks,
        isCurrent: true
    });
    
    // Add Firebase users (if enabled)
    if (firebaseEnabled && firebaseUsers.length > 0) {
        firebaseUsers.forEach(user => {
            if (user.id !== currentUser.id) {
                entries.push({
                    id: user.id,
                    name: user.name,
                    pagesRead: user.pagesRead || 0,
                    booksCompleted: user.booksCompleted || 0,
                    isCurrent: false
                });
            }
        });
    }
    
    // Sort by pages read
    entries.sort((a, b) => b.pagesRead - a.pagesRead);
    entries.forEach((entry, i) => entry.rank = i + 1);
    
    // Update user rank card
    const currentEntry = entries.find(e => e.isCurrent);
    document.getElementById('user-rank').textContent = currentEntry?.rank || 1;
    document.getElementById('user-pages-rank').textContent = currentEntry?.pagesRead || 0;
    
    // Update Firebase status
    const statusEl = document.getElementById('firebase-status');
    if (statusEl) {
        if (firebaseEnabled) {
            statusEl.textContent = `Connected • ${entries.length} reader${entries.length !== 1 ? 's' : ''}`;
            statusEl.style.color = 'var(--success)';
        } else {
            statusEl.textContent = 'Set up Firebase to sync with friends';
            statusEl.style.color = 'var(--text-secondary)';
        }
    }
    
    // Render leaderboard
    const container = document.getElementById('leaderboard-list');
    container.innerHTML = entries.map(entry => {
        const rankClass = entry.rank === 1 ? 'gold' : entry.rank === 2 ? 'silver' : entry.rank === 3 ? 'bronze' : '';
        const initial = entry.name.charAt(0).toUpperCase();
        
        return `
            <div class="leaderboard-item ${entry.isCurrent ? 'current-user' : ''}">
                <div class="leaderboard-rank ${rankClass}">${entry.rank}</div>
                <div class="leaderboard-avatar">${initial}</div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name">${escapeHtml(entry.name)} ${entry.isCurrent ? '(You)' : ''}</div>
                    <div class="leaderboard-books">${entry.booksCompleted} books completed</div>
                </div>
                <div class="leaderboard-pages">
                    <div class="leaderboard-pages-value">${entry.pagesRead}</div>
                    <div class="leaderboard-pages-label">pages</div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== PROFILE ====================
function refreshProfile() {
    const stats = calculateStats();
    
    document.getElementById('profile-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
    document.getElementById('profile-name').textContent = currentUser.name;
    document.getElementById('profile-email').textContent = currentUser.email;
    document.getElementById('profile-pages').textContent = stats.totalPages;
    document.getElementById('profile-books').textContent = stats.completedBooks;
}

function showEditProfile() {
    const modal = document.getElementById('modal-content');
    modal.innerHTML = `
        <div class="modal-header">
            <h3>Edit Profile</h3>
            <button class="modal-close" onclick="hideModal()">×</button>
        </div>
        <form id="profile-form" class="form" onsubmit="saveProfile(event)">
            <div class="form-group">
                <label for="profile-name-input">Name</label>
                <input type="text" id="profile-name-input" value="${escapeHtml(currentUser.name)}" required>
            </div>
            <div class="form-group">
                <label for="profile-email-input">Email</label>
                <input type="email" id="profile-email-input" value="${escapeHtml(currentUser.email)}" required>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Save</button>
        </form>
    `;
    
    showModal();
}

function saveProfile(e) {
    e.preventDefault();
    
    currentUser.name = document.getElementById('profile-name-input').value.trim();
    currentUser.email = document.getElementById('profile-email-input').value.trim();
    
    Store.saveUser(currentUser);
    hideModal();
    refreshProfile();
    showToast('Profile updated!');
    syncUserToFirebase();
}

function exportData() {
    const data = Store.exportAll();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'booktracker-backup.json';
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('Data exported!');
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            Store.importAll(text);
            
            currentUser = Store.getUser();
            books = Store.getBooks();
            progress = Store.getProgress();
            
            showPage('home');
            showToast('Data imported!');
            syncUserToFirebase();
        } catch (error) {
            showToast('Import failed: invalid file');
        }
    };
    
    input.click();
}

function confirmResetData() {
    const modal = document.getElementById('modal-content');
    modal.innerHTML = `
        <div class="modal-header">
            <h3>Reset All Data</h3>
            <button class="modal-close" onclick="hideModal()">×</button>
        </div>
        <p style="margin-bottom: 1.5rem;">This will delete all your books and reading progress. This cannot be undone!</p>
        <div style="display: flex; gap: 0.75rem;">
            <button class="btn btn-secondary" style="flex: 1;" onclick="hideModal()">Cancel</button>
            <button class="btn btn-danger" style="flex: 1;" onclick="resetData()">Reset Everything</button>
        </div>
    `;
    
    showModal();
}

function resetData() {
    Store.clearAll();
    
    currentUser = Store.getUser();
    books = [];
    progress = [];
    
    hideModal();
    showPage('home');
    showToast('All data reset');
    syncUserToFirebase();
}

// ==================== UTILITIES ====================
function showModal() {
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function hideModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 2500);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    initFirebase();
    
    // Sync user on load
    setTimeout(() => syncUserToFirebase(), 1000);
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => showPage(item.dataset.page));
    });
    
    // Library search
    document.getElementById('library-search').addEventListener('input', refreshLibrary);
    
    // Library filter chips
    document.querySelectorAll('#page-library .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#page-library .chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            refreshLibrary();
        });
    });
    
    // Add book tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
            
            if (tab.dataset.tab !== 'scan' && videoStream) {
                stopCamera();
            }
        });
    });
    
    // Book search
    document.getElementById('search-btn').addEventListener('click', searchBooks);
    document.getElementById('book-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchBooks();
    });
    
    // Add book button clicks (event delegation - FIXED)
    document.getElementById('search-results').addEventListener('click', handleAddBookClick);
    
    // Scanner
    document.getElementById('start-scan-btn').addEventListener('click', startCamera);
    
    // Manual form
    document.getElementById('manual-form').addEventListener('submit', handleManualSubmit);
    
    // Leaderboard period filter
    document.querySelectorAll('.period-filter .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.period-filter .chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentPeriod = chip.dataset.period;
            refreshLeaderboard();
        });
    });
    
    // Modal close on overlay click
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) hideModal();
    });
    
    // Initialize
    showPage('home');
});

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err));
}
