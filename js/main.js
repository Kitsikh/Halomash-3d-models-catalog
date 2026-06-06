// Репозиторий с моделями на GitHub
const REPO_OWNER = "Kitsikh";
const REPO_NAME = "halomesh-assets";

// Список авторов
const AUTHORS = [
    "Kitsikh",
    "Alex3D",
    "ModelMaster",
    "PrintCraft",
    "DesignPro"
];

// Делаем красивое название из имени файла
function formatTitle(filename) {
    return filename
        .replace(/\.[^/.]+$/, "")
        .replace(/[_-]/g, " ")
        .replace(/\b\w/g, l => l.toUpperCase());
}

// Получаем список файлов из папки на GitHub через API
async function getFilesFromFolder(folderName) {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${folderName}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);
        
        const data = await response.json();
        // Оставляем только файлы, игнорируем папки
        return data.filter(item => item.type === "file");
        
    } catch (error) {
        console.error(`Не удалось загрузить папку ${folderName}:`, error);
        return [];
    }
}

// Собираем все данные о моделях: .glb файлы + картинки
async function fetchModelsData() {
    // Загружаем списки файлов из обеих папок параллельно
    const [modelsFiles, imagesFiles] = await Promise.all([
        getFilesFromFolder("models"),
        getFilesFromFolder("images")
    ]);
    
    // Фильтруем только .glb файлы
    const glbFiles = modelsFiles.filter(f => f.name.toLowerCase().endsWith('.glb'));
    
    // Формируем массив объектов для каталога
    return glbFiles.map((glbFile, index) => {
        const baseName = glbFile.name.replace(/\.glb$/i, "");
        
        // Ищем подходящую картинку (похожее имя)
        const matchingImage = imagesFiles.find(img => {
            const imgName = img.name.toLowerCase();
            return imgName.startsWith(baseName.toLowerCase()) || 
                   imgName.includes(baseName.toLowerCase());
        });
        
        // Распределяем авторов по id (стабильно)
        const authorIndex = index % AUTHORS.length;
        const author = AUTHORS[authorIndex];
        
        return {
            id: index + 1,
            title: formatTitle(glbFile.name),
            author: author,
            modelSrc: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/models/${glbFile.name}`,
            downloadSrc: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/models/${glbFile.name}`,
            image: matchingImage ? `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/images/${matchingImage.name}` : null
        };
    });
}

// Каталог
async function loadCatalog(searchQuery = '') {
    const catalog = document.getElementById("catalog");
    const loading = document.getElementById("catalog-loading");
    
    if (!catalog) return;

    if (loading) loading.style.display = 'block';
    catalog.innerHTML = '';
    
    try {
        let catalogData = await fetchModelsData();
        
        // Фильтруем по названию или автору
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            catalogData = catalogData.filter(model => 
                model.title.toLowerCase().includes(query) ||
                model.author.toLowerCase().includes(query)
            );
        }
        
        // Сохраняем в глобальную переменную
        window.catalogData = catalogData;
        
        if (catalogData.length === 0) {
            catalog.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-secondary);">Ничего не найдено</p>';
            if (loading) loading.style.display = 'none';
            return;
        }
        
        // Проверяем что уже в избранном
        const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        
        // Рендерим карточки
        catalog.innerHTML = catalogData.map((model, index) => {
            const isFavorite = favorites.includes(model.id);
            return `
                <div class="masonry-item" style="animation-delay: ${index * 0.05}s">
                    <div class="masonry-image-wrapper">
                        <a href="model.html?id=${model.id}" class="masonry-link">
                            ${model.image 
                                ? `<img src="${model.image}" alt="${model.title}" loading="lazy">`
                                : `<div class="masonry-placeholder">${model.title.charAt(0)}</div>`
                            }
                        </a>
                        <div class="masonry-overlay">
                            <button class="overlay-btn overlay-save ${isFavorite ? 'saved' : ''}" onclick="toggleFavoriteFromGrid(${model.id}, this)">
                                ${isFavorite ? 'сохранено' : 'сохранить'}
                            </button>
                            <button class="overlay-btn overlay-download" onclick="handleDownload('${model.downloadSrc}', '${model.title}.glb')">
                                скачать
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error("Ошибка при загрузке каталога:", error);
        catalog.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-secondary);">Ошибка загрузки. Проверьте интернет.</p>';
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

// Страница модели
async function loadModelPage() {
    const container = document.getElementById("model-page-content");
    if (!container) return;
    
    // Получаем id модели из URL
    const urlParams = new URLSearchParams(window.location.search);
    const modelId = parseInt(urlParams.get("id"));
    
    container.innerHTML = '<div style="text-align:center; padding:60px; color:var(--text-secondary);">Загрузка...</div>';
    
    try {
        // Если данные ещё не загружены — грузим
        if (!window.catalogData) window.catalogData = await fetchModelsData();
        
        // Ищем нужную модель по id
        const model = window.catalogData.find(m => m.id === modelId);
        if (!model) {
            container.innerHTML = '<div style="text-align:center; padding:60px; color:var(--text-secondary);">Модель не найдена</div>';
            return;
        }
        
        // Проверяем, в избранном ли модель
        const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        const isFavorite = favorites.includes(modelId);
        
        // Другие модели
        const otherModels = window.catalogData.filter(m => m.id !== modelId).slice(0, 8);
        
        // Собираем всю разметку страницы
        container.innerHTML = `
            <div class="viewer-wrapper">
                <model-viewer 
                    src="${model.modelSrc}" 
                    alt="${model.title}"
                    camera-controls 
                    auto-rotate
                    shadow-intensity="1"
                    style="width: 100%; height: 100%;">
                </model-viewer>
            </div>
            
            <div class="model-actions">
                <button class="btn-action btn-download" onclick="handleDownload('${model.downloadSrc}', '${model.title}.glb')">
                    Скачать
                </button>
                <button class="btn-action" onclick="toggleFavorite(${modelId}, this)">
                    ${isFavorite ? 'в избранном' : 'в избранное'}
                </button>
            </div>
            
            <div class="model-info-block">
                <h1 class="model-title">${model.title}</h1>
                <p class="model-subtitle">3D Model</p>
                
                <div class="author-row">
                    <a href="author.html?name=${encodeURIComponent(model.author)}" class="author-link">
                        <div class="author-avatar-small">${model.author.charAt(0)}</div>
                        <span class="author-name-small">${model.author}</span>
                    </a>
                </div>
            </div>
            
            <div class="other-models-section">
                <div class="other-models-grid">
                    ${otherModels.map(other => `
                        <a href="model.html?id=${other.id}" class="other-model-card">
                            ${other.image 
                                ? `<img src="${other.image}" alt="${other.title}">`
                                : `<div class="other-model-placeholder">${other.title.charAt(0)}</div>`
                            }
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error("Ошибка при загрузке страницы модели:", error);
        container.innerHTML = '<div style="text-align:center; padding:60px; color:var(--text-secondary);">Ошибка загрузки</div>';
    }
}

// Скачивание файла
function handleDownload(url, filename) {
    // Создаём невидимую ссылку и кликаем по ней
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Добавить в избранное со страницы модели
function toggleFavorite(modelId, btn) {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const index = favorites.indexOf(modelId);
    
    if (index > -1) {
        // Убираем из избранного
        favorites.splice(index, 1);
        btn.textContent = 'в избранное';
    } else {
        // Добавляем в избранное
        favorites.push(modelId);
        btn.textContent = 'в избранном';
    }
    
    // Сохраняем обратно в localStorage
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

// Добавить/убрать из избранного с главной
function toggleFavoriteFromGrid(modelId, btn) {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const index = favorites.indexOf(modelId);
    
    if (index > -1) {
        favorites.splice(index, 1);
        btn.textContent = 'сохранить';
        btn.classList.remove('saved');
    } else {
        favorites.push(modelId);
        btn.textContent = 'сохранено';
        btn.classList.add('saved');
    }
    
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

// Загрузка избранного
async function loadFavorites() {
    const grid = document.getElementById("favorites-grid");
    const empty = document.getElementById("favorites-empty");
    const loading = document.getElementById("favorites-loading");
    const countEl = document.getElementById("favorites-count");
    
    if (!grid) return;
    
    if (loading) loading.style.display = 'block';
    if (empty) empty.style.display = 'none';
    grid.innerHTML = '';
    
    try {
        const favoriteIds = JSON.parse(localStorage.getItem('favorites') || '[]');
        
        if (favoriteIds.length === 0) {
            if (loading) loading.style.display = 'none';
            if (empty) empty.style.display = 'block';
            if (countEl) countEl.textContent = '0 моделей';
            return;
        }
        
        if (!window.catalogData) window.catalogData = await fetchModelsData();
        
        const favoriteModels = window.catalogData.filter(m => favoriteIds.includes(m.id));
        
        if (countEl) countEl.textContent = `${favoriteModels.length} ${getModelsWord(favoriteModels.length)}`;
        
        if (favoriteModels.length === 0) {
            if (loading) loading.style.display = 'none';
            if (empty) empty.style.display = 'block';
            return;
        }
        
        grid.innerHTML = favoriteModels.map((model, index) => `
            <div class="masonry-item favorite-item" style="animation-delay: ${index * 0.05}s">
                <div class="masonry-image-wrapper">
                    <a href="model.html?id=${model.id}" class="masonry-link">
                        ${model.image 
                            ? `<img src="${model.image}" alt="${model.title}" loading="lazy">`
                            : `<div class="masonry-placeholder">${model.title.charAt(0)}</div>`
                        }
                    </a>
                    <div class="masonry-overlay">
                        <button class="overlay-btn overlay-save saved" onclick="removeFromFavorites(${model.id}, this)">
                            сохранено
                        </button>
                        <button class="overlay-btn overlay-download" onclick="handleDownload('${model.downloadSrc}', '${model.title}.glb')">
                            скачать
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error("Ошибка при загрузке избранного:", error);
        grid.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-secondary);">Ошибка загрузки</p>';
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

// Удалить из избранного
function removeFromFavorites(modelId, btn) {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const index = favorites.indexOf(modelId);
    
    if (index > -1) {
        favorites.splice(index, 1);
        localStorage.setItem('favorites', JSON.stringify(favorites));
        
        const card = btn.closest('.favorite-item');
        if (card) {
            card.style.transition = 'opacity 0.3s, transform 0.3s';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            setTimeout(() => {
                card.remove();
                updateFavoritesCount();
                
                const grid = document.getElementById("favorites-grid");
                if (grid && grid.children.length === 0) {
                    const empty = document.getElementById("favorites-empty");
                    if (empty) empty.style.display = 'block';
                }
            }, 300);
        }
    }
}

// Обновить счётчик
function updateFavoritesCount() {
    const countEl = document.getElementById("favorites-count");
    if (!countEl) return;
    
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    countEl.textContent = `${favorites.length} ${getModelsWord(favorites.length)}`;
}

// Склонение слова "модель"
function getModelsWord(count) {
    const lastTwo = count % 100;
    const lastOne = count % 10;
    
    if (lastTwo >= 11 && lastTwo <= 19) return 'моделей';
    if (lastOne === 1) return 'модель';
    if (lastOne >= 2 && lastOne <= 4) return 'модели';
    return 'моделей';
}

// Склонение слова "автор"
function getAuthorsWord(count) {
    const lastTwo = count % 100;
    const lastOne = count % 10;
    
    if (lastTwo >= 11 && lastTwo <= 19) return 'авторов';
    if (lastOne === 1) return 'автор';
    if (lastOne >= 2 && lastOne <= 4) return 'автора';
    return 'авторов';
}

// Страница авторов
async function loadAuthorsPage() {
    const container = document.getElementById("authors-page-content");
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:60px; color:var(--text-secondary);">Загрузка...</div>';
    
    try {
        // Загружаем данные если ещё не загружены
        if (!window.catalogData) window.catalogData = await fetchModelsData();
        
        // Группируем модели по авторам
        const authorsMap = {};
        window.catalogData.forEach(model => {
            if (!authorsMap[model.author]) {
                authorsMap[model.author] = [];
            }
            authorsMap[model.author].push(model);
        });
        
        // Проверяем что уже в избранном
        const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        
        // Рендерим страницу
        container.innerHTML = `
            <h1 class="authors-page-title">Авторы</h1>
            
            ${Object.entries(authorsMap).map(([authorName, models]) => `
                <div class="author-block">
                    <div class="author-card">
                        <a href="author.html?name=${encodeURIComponent(authorName)}" class="author-card-clickable">
                            <div class="author-card-left">
                                <div class="author-card-avatar">${authorName.charAt(0)}</div>
                                <div class="author-card-info">
                                    <h2 class="author-card-name">${authorName}</h2>
                                    <p class="author-card-stats">${models.length} ${getModelsWord(models.length)}</p>
                                </div>
                            </div>
                        </a>
                        <button class="toggle-models-btn" onclick="event.stopPropagation(); toggleAuthorModels('${authorName}', this)">
                            показать модели
                        </button>
                    </div>
                    
                    <div class="authors-models-row" id="author-models-${authorName}" style="display: none;">
                        ${models.slice(0, 10).map((model, index) => {
                            const isFavorite = favorites.includes(model.id);
                            return `
                                <div class="masonry-item">
                                    <div class="masonry-image-wrapper">
                                        <a href="model.html?id=${model.id}" class="masonry-link">
                                            ${model.image 
                                                ? `<img src="${model.image}" alt="${model.title}" loading="lazy">`
                                                : `<div class="masonry-placeholder">${model.title.charAt(0)}</div>`
                                            }
                                        </a>
                                        <div class="masonry-overlay">
                                            <button class="overlay-btn overlay-save ${isFavorite ? 'saved' : ''}" onclick="toggleFavoriteFromGrid(${model.id}, this)">
                                                ${isFavorite ? 'сохранено' : 'сохранить'}
                                            </button>
                                            <button class="overlay-btn overlay-download" onclick="handleDownload('${model.downloadSrc}', '${model.title}.glb')">
                                                скачать
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `).join('')}
        `;
        
    } catch (error) {
        console.error("Ошибка при загрузке страницы авторов:", error);
        container.innerHTML = '<div style="text-align:center; padding:60px; color:var(--text-secondary);">Ошибка загрузки</div>';
    }
}

// Раскрыть/скрыть модели автора
function toggleAuthorModels(authorName, btn) {
    const modelsRow = document.getElementById(`author-models-${authorName}`);
    if (!modelsRow) return;
    
    if (modelsRow.style.display === 'none') {
        modelsRow.style.display = 'flex';
        btn.textContent = 'скрыть модели';
    } else {
        modelsRow.style.display = 'none';
        btn.textContent = 'показать модели';
    }
}

// Страница одного автора
async function loadAuthorPage() {
    const container = document.getElementById("author-page-content");
    if (!container) return;
    
    // Получаем имя автора из URL
    const urlParams = new URLSearchParams(window.location.search);
    const authorName = urlParams.get("name");
    
    container.innerHTML = '<div style="text-align:center; padding:60px; color:var(--text-secondary);">Загрузка...</div>';
    
    try {
        // Загружаем данные если ещё не загружены
        if (!window.catalogData) window.catalogData = await fetchModelsData();
        
        // Фильтруем модели этого автора
        const authorModels = window.catalogData.filter(m => m.author === authorName);
        
        // Если автор не найден
        if (authorModels.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:60px; color:var(--text-secondary);">Автор не найден</div>';
            return;
        }
        
        // Проверяем что уже в избранном
        const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        
        // Проверяем подписку
        const subscriptions = JSON.parse(localStorage.getItem('subscriptions') || '[]');
        const isSubscribed = subscriptions.includes(authorName);
        
        // Рендерим страницу
        container.innerHTML = `
            <div class="author-header">
                <div class="author-header-top">
                    <div class="author-avatar-large">${authorName.charAt(0)}</div>
                    <div class="author-header-info">
                        <h1 class="author-name-large">${authorName}</h1>
                        <p class="author-stats">${authorModels.length} ${getModelsWord(authorModels.length)}</p>
                        <div class="author-buttons">
                            <button class="btn-secondary">Отправить сообщение</button>
                            <button class="btn-primary" id="subscribe-btn" onclick="toggleSubscription('${authorName}', this)">
                                ${isSubscribed ? 'Вы подписаны' : 'Подписаться'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="author-tabs">
                <button class="tab-btn active" onclick="switchTab('created', '${authorName}', this)">Созданные</button>
                <button class="tab-btn" onclick="switchTab('saved', '${authorName}', this)">Сохраненные</button>
            </div>
            
            <div id="author-models-container">
                <div class="masonry-grid">
                    ${authorModels.map((model, index) => {
                        const isFavorite = favorites.includes(model.id);
                        return `
                            <div class="masonry-item" style="animation-delay: ${index * 0.05}s">
                                <div class="masonry-image-wrapper">
                                    <a href="model.html?id=${model.id}" class="masonry-link">
                                        ${model.image 
                                            ? `<img src="${model.image}" alt="${model.title}" loading="lazy">`
                                            : `<div class="masonry-placeholder">${model.title.charAt(0)}</div>`
                                        }
                                    </a>
                                    <div class="masonry-overlay">
                                        <button class="overlay-btn overlay-save ${isFavorite ? 'saved' : ''}" onclick="toggleFavoriteFromGrid(${model.id}, this)">
                                            ${isFavorite ? 'сохранено' : 'сохранить'}
                                        </button>
                                        <button class="overlay-btn overlay-download" onclick="handleDownload('${model.downloadSrc}', '${model.title}.glb')">
                                            скачать
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error("Ошибка при загрузке страницы автора:", error);
        container.innerHTML = '<div style="text-align:center; padding:60px; color:var(--text-secondary);">Ошибка загрузки</div>';
    }
}

// Подписаться/отписаться
function toggleSubscription(authorName, btn) {
    let subscriptions = JSON.parse(localStorage.getItem('subscriptions') || '[]');
    const index = subscriptions.indexOf(authorName);
    
    if (index > -1) {
        // Отписаться
        subscriptions.splice(index, 1);
        btn.textContent = 'Подписаться';
    } else {
        // Подписаться
        subscriptions.push(authorName);
        btn.textContent = 'Вы подписаны';
    }
    
    localStorage.setItem('subscriptions', JSON.stringify(subscriptions));
}

// Переключить таб (Созданные / Сохраненные)
function switchTab(tab, authorName, btn) {
    // Обновляем активный таб
    const tabs = btn.parentElement.querySelectorAll('.tab-btn');
    tabs.forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    
    const container = document.getElementById("author-models-container");
    
    if (tab === 'created') {
        // Показываем модели автора
        const authorModels = window.catalogData.filter(m => m.author === authorName);
        const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
        
        container.innerHTML = `
            <div class="masonry-grid">
                ${authorModels.map((model, index) => {
                    const isFavorite = favorites.includes(model.id);
                    return `
                        <div class="masonry-item" style="animation-delay: ${index * 0.05}s">
                            <div class="masonry-image-wrapper">
                                <a href="model.html?id=${model.id}" class="masonry-link">
                                    ${model.image 
                                        ? `<img src="${model.image}" alt="${model.title}" loading="lazy">`
                                        : `<div class="masonry-placeholder">${model.title.charAt(0)}</div>`
                                    }
                                </a>
                                <div class="masonry-overlay">
                                    <button class="overlay-btn overlay-save ${isFavorite ? 'saved' : ''}" onclick="toggleFavoriteFromGrid(${model.id}, this)">
                                        ${isFavorite ? 'сохранено' : 'сохранить'}
                                    </button>
                                    <button class="overlay-btn overlay-download" onclick="handleDownload('${model.downloadSrc}', '${model.title}.glb')">
                                        скачать
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } else if (tab === 'saved') {
        // Показываем пустой список (без иконки)
        container.innerHTML = `
            <div style="text-align:center; padding:60px 20px;">
                <h2 style="font-size:24px; margin-bottom:8px;">Пока пусто</h2>
                <p style="color:var(--text-secondary);">У этого автора пока нет сохраненных моделей</p>
            </div>
        `;
    }
}

// Поиск с задержкой
function setupSearch() {
    const searchInput = document.querySelector('.search-input');
    if (!searchInput) return;
    
    let timeout = null;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            loadCatalog(e.target.value);
        }, 300);
    });
}

// Переключение тёмной/светлой темы
function setupTheme() {
    const themeBtn = document.getElementById("theme-toggle");
    if (themeBtn) {
        // Проверяем сохранённую тему
        if (localStorage.getItem("theme") === "dark") {
            document.body.classList.add("dark-theme");
        }
        
        themeBtn.addEventListener("click", () => {
            document.body.classList.toggle("dark-theme");
            const isDark = document.body.classList.contains("dark-theme");
            localStorage.setItem("theme", isDark ? "dark" : "light");
        });
    }
}

// Выпадающее меню пользователя
function setupUserMenu() {
    const avatarBtn = document.getElementById("avatar-toggle");
    const dropdown = document.getElementById("user-dropdown");
    
    if (avatarBtn && dropdown) {
        // Открыть/закрыть меню при клике на аватар
        avatarBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("show");
        });
        
        // Закрыть меню при клике в любом другом месте
        document.addEventListener("click", (e) => {
            if (!dropdown.contains(e.target) && e.target !== avatarBtn) {
                dropdown.classList.remove("show");
            }
        });
    }
}

// Запуск при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
    setupTheme();
    setupUserMenu();
    setupSearch();
    
    // Загружаем контент в зависимости от страницы
    if (document.getElementById("catalog")) loadCatalog();
    if (document.getElementById("model-page-content")) loadModelPage();
    if (document.getElementById("favorites-grid")) loadFavorites();
    if (document.getElementById("authors-page-content")) loadAuthorsPage();
    if (document.getElementById("author-page-content")) loadAuthorPage();
});