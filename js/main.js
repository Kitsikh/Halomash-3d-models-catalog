// Репозиторий с моделями на GitHub
const REPO_OWNER = "Kitsikh";
const REPO_NAME = "halomesh-assets";

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
        
        return {
            id: index + 1,
            title: formatTitle(glbFile.name),
            author: "Kitsikh",
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
    
    // Показываем "Загрузка..."
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
            console.log(`Найдено ${catalogData.length} моделей по запросу "${searchQuery}"`);
        }
        
        // Сохраняем в глобальную переменную
        window.catalogData = catalogData;
        if (catalogData.length === 0) {
            catalog.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-secondary); grid-column: 1/-1;">Ничего не найдено</p>';
            if (loading) loading.style.display = 'none';
            return;
        }
        
        // Рендерим карточки
        catalog.innerHTML = catalogData.map((model, index) => `
            <a href="model.html?id=${model.id}" class="masonry-item" style="animation-delay: ${index * 0.05}s">
                <div class="masonry-image-wrapper">
                    ${model.image 
                        ? `<img src="${model.image}" alt="${model.title}" loading="lazy">`
                        : `<div class="masonry-placeholder">${model.title.charAt(0)}</div>`
                    }
                    <!-- Меню с тремя точками (пока заглушка) -->
                    <div class="masonry-menu">
                        <button class="masonry-menu-btn" onclick="event.preventDefault(); event.stopPropagation();">⋯</button>
                    </div>
                </div>
            </a>
        `).join('');
        
        console.log(`Загружено ${catalogData.length} моделей`);
        
    } catch (error) {
        console.error("Ошибка при загрузке каталога:", error);
        catalog.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-secondary); grid-column: 1/-1;">Ошибка загрузки. Проверьте интернет.</p>';
    } finally {
        // Скрываем индикатор загрузки
        if (loading) loading.style.display = 'none';
    }
}

// страница модели
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
            <!-- 3D Вьювер -->
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
            
            <!-- Кнопки: Скачать и В избранное -->
            <div class="model-actions">
                <button class="btn-action btn-download" onclick="handleDownload('${model.downloadSrc}', '${model.title}.glb')">
                    Скачать
                </button>
                <button class="btn-action" onclick="toggleFavorite(${modelId}, this)">
                    ${isFavorite ? '✓ В избранном' : '☆ В избранное'}
                </button>
            </div>
            
            <!-- Информация: название, автор -->
            <div class="model-info-block">
                <h1 class="model-title">${model.title}</h1>
                <p class="model-subtitle">3D Model</p>
                
                <div class="author-row">
                    <a href="#" class="author-link" onclick="event.preventDefault();">
                        <div class="author-avatar-small">К</div>
                        <span class="author-name-small">${model.author}</span>
                    </a>
                </div>
            </div>
            
            <!-- Блок "Другие модели" (как на Pinterest) -->
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
    
    console.log(`Скачано: ${filename}`);
}

// Добавить/убрать из избранного
function toggleFavorite(modelId, btn) {
    let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const index = favorites.indexOf(modelId);
    
    if (index > -1) {
        // Убираем из избранного
        favorites.splice(index, 1);
        btn.textContent = '☆ В избранное';
    } else {
        // Добавляем в избранное
        favorites.push(modelId);
        btn.textContent = '✓ В избранном';
    }
    
    // Сохраняем обратно в localStorage
    localStorage.setItem('favorites', JSON.stringify(favorites));
    console.log(`Избранное обновлено: ${favorites.length} моделей`);
}

// настройки интерфейса 

// Поиск с задержкой (чтобы не дёргать API при каждом символе)
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
    console.log("HaloMesh загружен 🚀");
    
    // Инициализируем всё
    setupTheme();
    setupUserMenu();
    setupSearch();
    
    // Загружаем контент в зависимости от страницы
    if (document.getElementById("catalog")) {
        console.log("Загружаем каталог...");
        loadCatalog();
    }
    
    if (document.getElementById("model-page-content")) {
        console.log("Загружаем страницу модели...");
        loadModelPage();
    }
});